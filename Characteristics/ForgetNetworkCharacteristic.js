var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var utils = require("../Utils/utils");
var OLED_DISPLAY_OPERATION = utils.OLED_DISPLAY_OPERATION;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");
var shell = require("shelljs");
var intervalId;
var ping = require ("net-ping");

const CHUNK_REGEX = /\|(\d+)\/(\d+)\|/;
const CHUNK_PREFIX = 0;
const CHUNK_CURRENT = 1;
const CHUNK_TOTAL = 2;
var wifiInfoList = [];

var ForgetNetworkCharacteristic= function(){
    ForgetNetworkCharacteristic.super_.call(this, {
        uuid: 'ba67cb58901a4ea091150bf3296750e5',
        properties: ['write']
    });

}


util.inherits(ForgetNetworkCharacteristic, Characteristic);

ForgetNetworkCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
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
        var path = "/home/pi/vibezConnect/stsp.txt"
        fs.writeFileSync(path, str);
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
    console.log(str);
    wifiInfoList = [];

    utils.listWpaSupplicantNetworks(function(error,info,networkList){
        if(error){
            var result = Characteristic.RESULT_UNLIKELY_ERROR;
            callback(result);
        }else{
            utils.getActiveWpaSupplicantNetwork(function(err, ssid){
                if(err){
                    var result = Characteristic.RESULT_UNLIKELY_ERROR;
                    callback(result);
                }else{
                    var i = _.findIndex(networkList, function(n){
                            return n.ssid == Buffer.from(str,'utf8').toString('hex');
                    });

                    if(i !== -1){
                        var ssidString = utils.hex2a(networkList[i].ssid);
                        networkList.splice(i,1);
                        utils.removeAutoJoinItem(ssidString);  
                        ps.lookup({
                            command : 'avconv',
                            psargs: 'lx'
                        }, function(err,resultList){
                            if(!err){ 
                                var process = _.find(resultList, function(p) { return p.command == 'avconv' })
                                utils.currentStreamPoint = undefined;
                                if(process){
                                    for (var i=0; i<resultList.length; i++){
                                        var p = resultList[i];
                                        ps.kill(p.pid, function(err){});
                                    }
                                    utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);

                                    }else{ }        
                                            
                            }
                            if (ssidString == str){
                                for (var i = 0; i < networkList.length; i++){
                                    var network = networkList[i];
                                    var networkIdString = utils.hex2a(network.ssid);
                                    var autoJoinItem = utils.getAutoJoinItem(networkIdString);
                                    if(autoJoinItem && autoJoinItem.autoJoin){
                                        network.disabled = 0
                                    }else{
                                        network.disabled = 1
                                    }
                                }
                                utils.writeNetworksToWpaSupplicantFile(info, networkList, function(err, result){
                                    if(err){
                                        var result = Characteristic.RESULT_SUCCESS;
                                        callback(result);
                                    } else{
                                        shell.exec("wpa_cli -i wlan0 reconfigure", function(code, stdout, stderr){
                                            var result = Characteristic.RESULT_SUCCESS;
                                            callback(result);
                                        });
                                    }           
                                });
                            }else {
                                var result = Characteristic.RESULT_SUCCESS;
                                callback(result);
                            }
                        });  

                    }else{
                        var result = Characteristic.RESULT_SUCCESS;                         
                        callback(result);
                    }
                        
                }
            
        }); 
        }
        
    })
     
},


module.exports = ForgetNetworkCharacteristic;