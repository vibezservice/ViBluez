var util = require('util');
var exec = require('child_process').execSync;
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var _ = require('underscore');
var shell = require("shelljs");
var async = require("async");
var utils = require("../Utils/utils");

var list = {
    "a1" : 5,
    "a2" : 8,
    "a3" : [4,5,6,7,8]
}

var strList = JSON.stringify(list)

var DisconnectFromWifiCharacteristic= function(){
    DisconnectFromWifiCharacteristic.super_.call(this, {
        uuid: '7b541844587545409a860081d1be1916',
        properties: ['write']
    });

}


util.inherits(DisconnectFromWifiCharacteristic, Characteristic);

DisconnectFromWifiCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
    console.log("Disconnect");
    utils.listWpaSupplicantNetworks(function(err, info, networkList){
        if(err){
            var result = Characteristic.RESULT_UNLIKELY_ERROR;
            callback(result);
            return;
        }

       _.forEach(networkList, function(network){
            network.disabled = 1
       })

        utils.writeNetworksToWpaSupplicantFile(info, networkList, function(err, result){
            if(!err){
                if(shell.which("wpa_cli")){
                    console.log("hey");
                    shell.exec("wpa_cli -i wlan0 reconfigure", function(code, stdout, stderr){
                        console.log("Exit code: ", code);
                        console.log("Program stdout: ", stdout);
                        if(stdout.trim() == "OK"){
                            var result = Characteristic.RESULT_SUCCESS;
                            callback(result);
                        }else {
                            var result = Characteristic.RESULT_UNLIKELY_ERROR;
                            callback(result);
                            exec("ifconfig wlan0 down");
                            setTimeout(function(){
                                exec("ifconfig wlan0 up");
                            }, 1000);
                        }
                    });

                }else{
                    var result = Characteristic.RESULT_UNLIKELY_ERROR;
                    callback(result);
                }
            }else{
                var result = Characteristic.RESULT_UNLIKELY_ERROR;
                callback(result);
            }
        })
    });
}

module.exports = DisconnectFromWifiCharacteristic;