var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var piWifi = require('pi-wifi')
var bleno = require('bleno');
var fs = require('fs');
var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd=require('node-cmd');
var utils = require("../Utils/utils");
var BroadcastCharacteristic= function(){ 
	BroadcastCharacteristic.super_.call(this, {
		uuid: '63fea914e3b311e780c19a214cf093ae',
		properties: ['write']
	});
	
}

util.inherits(BroadcastCharacteristic, Characteristic);

BroadcastCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback){
  var str = data.toString('utf8');

  ps.lookup({
	command : 'avconv',
	psargs: 'lx'
  }, function(err,resultList){
	if(err){
		var result = Characteristic.RESULT_UNLIKELY_ERROR;
		callback(result);
	}else{
		var process = _.find(resultList, function(p) { return p.command == 'avconv' })
		console.log(process);
		if(str == "1"){
			if(!process){
                console.log("BROADCASTING ++++ " + str);
				var cmd = 'avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec aac -ab 192k -f flv ' + utils.streamEndpoint + 'audio';
				exec(cmd, {maxBuffer: 1024 * 1024 * 500},function(error, stdout, stderr){
					console.log(stdout);
					console.log()
				});

				var result = Characteristic.SUCCESS;
				callback(result);
			}else{
				var result = Characteristic.SUCCESS;
				callback(result);
			}
		}else{
			if(process){
				for (var i=0; i<resultList.length; i++){
					var p = resultList[i];
                    ps.kill(p.pid, function(err){});
                    var result = Characteristic.SUCCESS;
                    callback(result);
				}

			}else{
				var result = Characteristic.SUCCESS;
				callback(result);				
			}		
		} 
		
	
		resultList.forEach(function( process ){
        		if( process ){
            			console.log( 'PID: %s, COMMAND: %s, ARGUMENTS: %s', process.pid, process.command, process.arguments );
        		}
    		});
		}
	});
}
module.exports = BroadcastCharacteristic;
