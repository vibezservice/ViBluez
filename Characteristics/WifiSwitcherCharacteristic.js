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

var list = {
    "a1" : 5,
    "a2" : 8,
    "a3" : [4,5,6,7,8]
}

var strList = JSON.stringify(list)

var WifiSwitcherCharacteristic= function(){
    WifiSwitcherCharacteristic.super_.call(this, {
        uuid: 'e55a9b149a9944bd83c910bdf653e2a1',
        properties: ['write']
    });

}


util.inherits(WifiSwitcherCharacteristic, Characteristic);

WifiSwitcherCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
    console.log("Disconnect");
    var str = data.toString("utf8");
    if (str === "1"){
        exec("ifconfig wlan0 up");

    }else{
        exec("ifconfig wlan0 down");
        ps.lookup({
            command : 'avconv',
            psargs: 'lx'
        }, function(err,resultList){
            if(err){ }else{
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
        });
    }
    var result = Characteristic.RESULT_UNLIKELY_ERROR;
    callback(result);
}

module.exports = WifiSwitcherCharacteristic;