var util = require('util');
var os = require('os');
var exec = require('child_process').exec;
var piWifi = require('pi-wifi')
var bleno = require('bleno');
var fs = require('fs');
var Descriptor = bleno.Descriptor;
var Characteristic = bleno.Characteristic;
var _ = require('underscore');
var os = require('os');
var ps = require('ps-node');
var async = require('async');
var request = require('request');
var sleep = require('sleep');
var intervalId;
var ping = require ("net-ping");
var network = require('network');
var utils = require("../Utils/utils");
var shell = require("shelljs");
var InformCharacteristic= function(){
	InformCharacteristic.super_.call(this, {
		uuid: '3172c864f14a11e78c3f9a214cf093ae',
		properties: ['notify']
	});
	
}
var registered = false;
var registeringRequest = false;

util.inherits(InformCharacteristic, Characteristic);
function chunkString(str, length) {
	return str.match(new RegExp('.{1,' + length + '}', 'g'));
}
function checkInternet(cb) {
    require('dns').resolve4('www.vibez.io',function(err) {
	console.log("resolved");
 if (err) {
	    console.log(err)
            cb(false);
        } else {
            cb(true);
        }
    })
}
function inform(updateValueCallback){
	var gearInfo = fs.readFileSync('/etc/gearc.cfg','utf8');
    var json = JSON.parse(gearInfo);
	async.series({
		i : function(callback){
            // var session = ping.createSession({
            // 	timeout: 2000 
            // });
            callback(null, utils.currentConnectionStatus ? 1 : 0);
            // session.pingHost (utils.pingPoint, function (error, target) {
            // 	session.close();
            //     if (error) {
            //         callback(null, 0);
            //         console.log(target + ": " + error.toString());
            //     }else {
            //         callback(null, 1)
            //         console.log(target + ": Alive");
            //     }
            // });
		},
		lb: function(callback){
			ps.lookup({
				command : 'avconv',
				psargs: 'lx'
  			}, function(err,resultList){
				if(err){
					var result = Characteristic.RESULT_UNLIKELY_ERROR;
					callback(result);
				}else{
					var process = _.find(resultList, function(p) { return p.command == 'avconv' })
					callback(null, process != null ? 1 : 0);
				}
			})		
		},
		ws: function(callback){
            network.get_active_interface(function(err, obj) {
				callback(null, err ? {} : obj)
            })
		},
		pri: function(callback){
            network.get_gateway_ip(function(err, ip) {
                callback(null, err ? "" : ip)
            })
		},
		pui: function(callback){
            network.get_public_ip(function(err, ip) {
                callback(null, err ? "" : ip)
            })
		},
		sw: function(callback){
            utils.getActiveWpaSupplicantNetwork(function(err, network){
                if(err || !network){
                    callback(null, "")
                }else{
                	if(network === "off/any"){
                        callback(null, "");
					}else{
						if(utils.currentConnectionStatus) {
							callback(null, network);
						} else {
							callback(null, 'Connecting to "' + network + '"');
						}

       //                  var session = ping.createSession ({
       //                  	timeout : 2000
       //                  });
       //                  session.pingHost (utils.pingPoint, function (error, target) {
       //                  	session.close();
							// if(error){
							// 	callback(null, 'Connecting to "' + network + '"');
							// }else{
							// 	callback(null, network);
							// }
       //                  });
					}
                }
            })
		},
		ic: function(callback){
            shell.exec("ifconfig wlan0", function(code, stdout, stderr){
				if(stdout){
                    var status = stdout.substring(stdout.indexOf("<")+1,stdout.indexOf(">"));
					var statusArray = status.split(",");
					var i = _.findIndex(statusArray, function(s){
						return s === "UP"
					});

                    callback(null, i != -1 ? true: false);
				}
            });
		},
		rs: function(callback){
			callback(null, json.registered);
		},
		as: function(callback){
			callback(null, json.activated);
		}
	}, function(err, results){
		if(err){		
			updateValueCallback(0);
		}else{
			var stringified = JSON.stringify(results);
console.log(stringified);
			var chunks = chunkString(stringified, 50);
			for (i in chunks){
				sleep.msleep(30);
				var dataToSend = "|" + (parseInt(i) + 1) + "/" + chunks.length + "|"  + chunks[i];

				var buffer = Buffer.from(dataToSend, 'utf8');
				updateValueCallback(buffer)
			}
		}
	});
	

}

InformCharacteristic.prototype.onSubscribe = function(maxSize, updateValueCallback)
{
	console.log("subscribed")
	inform(updateValueCallback);
	if (intervalId == null || intervalId == undefined){
		intervalId = setInterval(function(){
			inform(updateValueCallback);
		}, 3000);
	}
}

InformCharacteristic.prototype.onUnsubscribe = function(maxSize, updateValueCallback)
{
	console.log('unsubscribe');
	if (intervalId){
		clearInterval(intervalId);
		intervalId = null;
	}

}
module.exports = InformCharacteristic;
