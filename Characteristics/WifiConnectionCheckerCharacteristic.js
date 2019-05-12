var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");
var shell = require("shelljs");
var intervalId;
var ping = require ("net-ping");
var WifiConnectionCheckerCharacteristic= function(){
    WifiConnectionCheckerCharacteristic.super_.call(this, {
        uuid: '06e21b9fd3074852b33ed2a198be7cec',
        properties: ['notify']
    });

}

var offAnyOperationInProgress = false;

function chunkString(str, length) {
    return str.match(new RegExp('.{1,' + length + '}', 'g'));
}

util.inherits(WifiConnectionCheckerCharacteristic, Characteristic);

function inform(updateValueCallback){
    var session = ping.createSession ({
                timeout: 2000 
            });
    session.pingHost (utils.pingPoint, function (error, target) {
        if (error) {
            utils.getActiveWpaSupplicantNetwork(function(err, ssid){
                if(ssid != utils.connectingWifiName){
                    utils.listWpaSupplicantNetworks(function(error,info,networkList){
                        if(error){
                           
                        }else{
                            clearInterval(intervalId);
                            intervalId = null;
                            setTimeout(function(){ 
                                var index = undefined;
                                for(var i = 0; i < networkList.length; i++){
                                    var n = networkList[i];
                                    var hex = Buffer.from(utils.connectingWifiName,'utf8').toString('hex')
                                    if (n.ssid === hex){
                                        index = i;
                                        continue;
                                    }else{
                                        var autoJoinItem = utils.getAutoJoinItem(utils.connectingWifiName);
                                        if(autoJoinItem && autoJoinItem.autoJoin === 1){
                                            n.disabled = 0;
                                        }else{
                                            n.disabled = 1;    
                                        }
                                        
                                    }
                                } 
                                if(index){
                                    var s = utils.hex2a(networkList[index].ssid);
                                    networkList.splice(index, 1);
                                    console.log("SPLICEEE " + utils.connectingWifiName);
                                    utils.removeAutoJoinItem(s);
                                }
                                utils.writeNetworksToWpaSupplicantFile(info, networkList, function(err, data){
                                    if(ssid == "off/any"){
                                        var buffer = Buffer.from("2", 'utf8');
                                        updateValueCallback(buffer);
                                        shell.exec("wpa_cli -i wlan0 reconfigure", function(code, stdout, stderr){
                                            setTimeout(function(){
                                                utils.getActiveWpaSupplicantNetwork(function(err, ssid){
                                                    if(err){
                                                        var buffer = Buffer.from("4", 'utf8');
                                                        updateValueCallback(buffer);                
                                                    }else{
                                                        if(ssid === "off/any"){
                                                            var buffer = Buffer.from("4", 'utf8');
                                                            updateValueCallback(buffer);
                                                        }else{
                                                            var buffer = Buffer.from(ssid, 'utf8');
                                                            updateValueCallback(buffer);
                                                            setTimeout(function(){
                                                                session.pingHost (utils.pingPoint, function (error, target) {
                                                                    if(error){
                                                                        var buffer = Buffer.from("3", 'utf8');
                                                                        updateValueCallback(buffer);
                                                                    }   else{
                                                                        var buffer = Buffer.from("1", 'utf8');
                                                                        updateValueCallback(buffer);
                                                                    }   
                                                                });
                                                            }, 4000);
                                                        }
                                                    }
                                                })
                                            }, 3000);

                                        });
                                    }else{
                                       // utils.connectingWifiName = ssid;
                                        if(ssid){
                                            var buffer = Buffer.from(ssid, 'utf8');
                                            updateValueCallback(buffer);
                                        }
                                    }
                                });
                            }, 15000);
                        }
                    });
                    
                           
                            
                }
            });
        }else {
            var buffer = Buffer.from("1", 'utf8');
            updateValueCallback(buffer);
        }
    });
}
WifiConnectionCheckerCharacteristic.prototype.onSubscribe = function(maxSize, updateValueCallback)
{
    if (intervalId == null || intervalId == undefined){
        setTimeout(function(){
            intervalId = setInterval(function(){
                inform(updateValueCallback);
            }, 1500);    
        },3000);
        
    }
}

WifiConnectionCheckerCharacteristic.prototype.onUnsubscribe = function(maxSize, updateValueCallback)
{
    if (intervalId){
        clearInterval(intervalId);
        intervalId = null;
    }

}

module.exports = WifiConnectionCheckerCharacteristic;