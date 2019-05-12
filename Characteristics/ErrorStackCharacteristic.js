var bleno = require('bleno');
var fs = require('fs');
var util = require('util');
var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;
var utils = require("../Utils/utils");
var sleep = require('sleep');

var ErrorStackCharacteristic= function(){
	ErrorStackCharacteristic.super_.call(this, {
		uuid: '672ed9c4a64e4dc6a2c449ea079b03ee',
		properties: ['notify']
	});
	
}
var registered = false;
var registeringRequest = false;

util.inherits(ErrorStackCharacteristic, Characteristic);
function chunkString(str, length) {
	return str.match(new RegExp('.{1,' + length + '}', 'g'));
}


ErrorStackCharacteristic.prototype.onSubscribe = function(maxSize, updateValueCallback)
{
	if(utils.errorStack){
		var stringified = JSON.stringify(utils.errorStack);
		var chunks = chunkString(stringified, 50);
		for (i in chunks){
			sleep.msleep(30);
			var dataToSend = "|" + (parseInt(i) + 1) + "/" + chunks.length + "|"  + chunks[i];
			var buffer = Buffer.from(dataToSend, 'utf8');
			updateValueCallback(buffer);
		}	
	}else{
		var buffer = Buffer.from("0", 'utf8');
	}
	
}

module.exports = ErrorStackCharacteristic;
