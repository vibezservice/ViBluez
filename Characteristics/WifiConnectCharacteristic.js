var util = require('util');
var exec = require('child_process').execSync;
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var _ = require('underscore');
var shell = require("shelljs");
var async = require("async");
var utils = require("../Utils/utils");
var OLED_DISPLAY_OPERATION = utils.OLED_DISPLAY_OPERATION;
var ps = require('ps-node');
const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];


var list = {
    "a1" : 5,
    "a2" : 8,
    "a3" : [4,5,6,7,8]
}

var strList = JSON.stringify(list)

var WifiConnectCharacteristic= function(){
    WifiConnectCharacteristic.super_.call(this, {
        uuid: '8eb0722ae13111e780c19a214cf093ae',
        properties: ['write']
    });
}

function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

util.inherits(WifiConnectCharacteristic, Characteristic);

WifiConnectCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
    var str = data.toString('utf8');
    var matches = str.match(CHUNK_REGEX);
    var goThrough = false;
    if(matches && matches.length > 0){
        var expectedParts = matches[CHUNK_TOTAL];
        var chunkInfo = matches[CHUNK_PREFIX];
        var incomingPart = parseInt(matches[CHUNK_CURRENT]);
        var content = str.replace(chunkInfo,"");

        wifiInfoList.push({ i : incomingPart, content : content });
        if (wifiInfoList.length == expectedParts){
            goThrough = true
            wifiInfoList = _.sortBy(wifiInfoList, 'i');
        }
    }else{
        callback(Characteristic.RESULT_SUCCESS);
        return;
    }
    if (!goThrough){
        var result = Characteristic.RESULT_SUCCESS;
        callback(result);
        return
    }
    var str = ""
    for (i in wifiInfoList){
        var cont = wifiInfoList[i].content;
        str += cont;
    }
    wifiInfoList = [];
    try{
        var json = JSON.parse(str);
        console.log(json.ssid);

        utils.connectingToWifi = true;
        
        var networkIdStr = Buffer.from(json.ssid,'utf8').toString('hex');
        utils.connectingWifiName = json.ssid;
        var pass = json.p;
        var isHidden = json.h;
        console.log(networkIdStr);
        const chunkedNetworkId = chunkString(networkIdStr, 2);

        var i;
        var networkId = "";
        for( i = 0; i < chunkedNetworkId.length; i++) {
                if (chunkedNetworkId[i] === "27"){
                        chunkedNetworkId[i] = "e28099";
                }
                networkId += chunkedNetworkId[i];
        }

        utils.listWpaSupplicantNetworks(function(err, info, networkList){
            if(err){
                var result = Characteristic.RESULT_UNLIKELY_ERROR;
                callback(result);
            }else{

                async.waterfall([
                    function(cb){
                        if(pass) {
                            var networkString = 'network={\n\tssid='+ networkId +'\n\t psk="'+ pass +'"\n}';
                            var network = utils.getNetworkObjectFromString(networkString);
                            console.log(network);
                            cb(null, network);
                        }else{
                            var networkString = 'network={\n\tssid='+ networkId +'\n\t key_mgmt=NONE\n}'
                            console.log(networkString);
                            var network = utils.getNetworkObjectFromString(networkString);
                            cb(null,network);
                        }
                    }, function(networkObj, cb){
                        _.each(networkList, function(n) {
                            n.disabled = 1;
                            n.priority = 1;
                        });
                        var network = _.find(networkList, function(n) {
                            var re = new RegExp('"', 'g');
                            return n.ssid.replace(re, '') == networkId;
                        });
                        if(network){
                            network.priority = 999;
                            if (pass) {
                                network.psk = networkObj.psk;
                            }
                            network.disabled = 0;
                        }else{
                            if (pass) {
                                network = {
                                    ssid: '' + networkId + '',
                                    psk: networkObj.psk,
                                    priority: 999,
                                    disabled: 0,
                                    id_str: '"' + networkId + '"'
                                }
                            }else{
                                network = {
                                    ssid: '' + networkId + '',
                                    key_mgmt: 'NONE',
                                    priority: 999,
                                    disabled: 0,
                                    id_str: '"' + networkId + '"'
                                }
                            }
                            networkList.push(network);
                        }


                        cb(null);
                    }, function(cb){
                        utils.writeNetworksToWpaSupplicantFile(info, networkList, function(err, result){
                            if(!err){
                                utils.setAutoJoinItem(utils.connectingWifiName, 1);
                                if(shell.which("wpa_cli")){
                                    console.log("hey");
                                    ps.lookup({
                                        command : 'avconv',
                                        psargs: 'lx'
                                    }, function(err,resultList){
                                        if(!err){
                                            var process = _.find(resultList, function(p) { return p.command == 'avconv' })
    
                                            if(process){
                                                for (var i=0; i<resultList.length; i++){
                                                    var p = resultList[i];
                                                    ps.kill(p.pid, function(err){});
                                                }
                                                utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);

                                            }else{ }        
                                            
                                        }
                                        shell.exec("wpa_cli -i wlan0 reconfigure", function(code, stdout, stderr){
                                            console.log("Exit code: ", code);
                                            console.log("Program stdout: ", stdout);
                                            if(stdout.trim() == "OK"){
                                                cb();
                                            }else {
                                                cb(new Error("Failed"));
                                                exec("ifconfig wlan0 down");
                                                setTimeout(function(){
                                                    exec("ifconfig wlan0 up");
                                                }, 1000);
                                            }
                                        });
                                    });
                                }else{
                                    cb(new Error("module not found"));
                                }
                            }else{
                                cb(err);
                            }
                        })
                    }
                ], function(err){
                    if(err){
                        var result = Characteristic.RESULT_UNLIKELY_ERROR;
                        callback(result);
                    }else{
                        var result = Characteristic.RESULT_SUCCESS;
                        callback(result);
                    }
                });
            }

        })

    } catch(e) {
        console.log(e);

    }
}

module.exports = WifiConnectCharacteristic;
