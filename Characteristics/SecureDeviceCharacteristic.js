var util = require('util');
var bleno = require('bleno');
var fs = require('fs');
var Characteristic = bleno.Characteristic;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");

var SecureDeviceCharacteristic = function(){
    SecureDeviceCharacteristic.super_.call(this, {
        uuid: 'f880a9ba1524419f94fe8f13368828c7',
        properties: ['write']
    });
}

util.inherits(SecureDeviceCharacteristic, Characteristic);

SecureDeviceCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	var gearInfo = fs.readFileSync('/etc/gearc.cfg','utf8');
   	var json = JSON.parse(gearInfo);
   	var str = data.toString('utf8');

   	console.log(str);

   	if(json.ownerId){
   		if(json.ownerId == str){
   			var result = Characteristic.RESULT_SUCCESS;
        	callback(result);
   		}else{
   			var result = Characteristic.RESULT_UNLIKELY_ERROR;
        	callback(result);
   		}
   	}else{
   		var result = Characteristic.RESULT_SUCCESS;
        callback(result);
   	}
}

module.exports = SecureDeviceCharacteristic