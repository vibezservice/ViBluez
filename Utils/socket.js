var fs = require('fs');
var ps = require('ps-node');
var io = require("socket.io-client");
var _ = require('underscore');
var request = require("request");
var ps = require('ps-node');
var _ = require('underscore');
var exec = require('child_process').exec;
var cmd = require('node-cmd');
var utils = require('./utils');
var bleno = require('bleno');
var OLED_DISPLAY_OPERATION = utils.OLED_DISPLAY_OPERATION;
var bleno = require('bleno');
var Characteristic = bleno.Characteristic;

const establish = () => {
	var jsonString = fs.readFileSync('/etc/gearc.cfg', 'utf8');
	var json = JSON.parse(jsonString);
	if (json.activated && json.ownerId != null && json.ownerId != undefined) {
		var socket = io(utils.serviceEndpoint + "/gear", {
			transports: ['websocket', 'polling'],
			query: {
				'g-id': json.uniqueId,
				'c-id' : json.ownerId,
				'v-n' : json.version
			}
		});
		socket.on('connect', () => {
			console.log("Connected to socket");
			utils.currentConnectionStatus = true;
		});
		socket.on('disconnect', () => {
			console.log("Disconnected from socket");
			utils.currentConnectionStatus = false;
		});
		socket.on('unsetStream', (streamId) => {
			console.log("unset Stream");
			console.log(streamId);
			utils.currentStreamPoint = undefined;
			ps.lookup({
				command: 'avconv',
				psargs: 'lx'
			}, function (err, resultList) {
				console.log(err);
				console.log(resultList);
				if (!err) {
					var process = _.find(resultList, function (p) { return p.command == 'avconv' })
					console.log(process);
					if (process) {
						for (var i = 0; i < resultList.length; i++) {
							var p = resultList[i];
							ps.kill(p.pid, function (err) { });
						}
						utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);

					} else { }
					setTimeout(function(){
						request.get(utils.serviceEndpoint + "/api/stream/checkIfStreamIsStopped/" + streamId, function (error, response, body) {
						if (body && (response.statusCode == 200 || response.statusCode == 304)) {
							var parsed = JSON.parse(body);
							console.log(parsed);
							if (parsed.isSuccess) {
								const hasBeenFinished = parsed.resultObject;
								if (!hasBeenFinished) {
									setTimeout(function () {
										var cmd = 'sudo avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec aac -ab 160k -f flv ' + utils.streamEndpoint + streamId + '_audio';
										console.log(cmd);
										exec(cmd, { maxBuffer: 1024 * 1024 * 500 }, function (error, stdout, stderr) {
											console.log(error);
											console.log(stderr);
										});
										utils.currentStreamPoint = streamId;
										utils.changeScreen(OLED_DISPLAY_OPERATION.BROADCASTING);
									}, 2000);

								}
							}
						}
					})
					},2000);
					
				}
			});
		});

		socket.on('broadcast', (on, streamId, cb) => {
			if (utils.softwareUpdating) {
				return;
			}

			ps.lookup({
				command: 'avconv',
				psargs: 'lx'
			}, function (err, resultList) {
				if (err) { } else {
					const process = _.find(resultList, function (p) { return p.command == 'avconv' })
					if (process) {
							for (var i = 0; i < resultList.length; i++) {
								var p = resultList[i];
								ps.kill(p.pid, function (err) { });
							}
							utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);

					}
					if (on) {
						if (!process) {
							var cmd = 'sudo /etc/init.d/ntp stop && sudo ntpd -q -g && sudo /etc/init.d/ntp start';
							// var cmd = 'avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec libmp3lame -ab 196k -f flv ' + utils.streamEndpoint + streamId +'_audio';
							// var cmd = 'avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec libmp3lame -ab 196k -f flv ' + utils.streamEndpoint + streamId +'_audio';
							exec(cmd, { timeout : 25000 }, function (error, stdout, stderr) {
								console.log(error);
								console.log(stdout);
								console.log(stderr);
								var streamCmd = 'avconv -f alsa -ac 2 -ar 44100 -thread_queue_size 4096 -i hw:1,0 -acodec aac -ab 128k -f flv ' + utils.streamEndpoint + streamId + '_audio';
								var child = exec(streamCmd, {maxBuffer: 1024 * 1024 * 500});
								child.stdout.on('data', function (data) {
        							console.log(data);
    							})
						    	child.on('close', function (code) {
						        	console.log("Close code: " + code);
						    	})
								setTimeout(function(){
									console.log(child.pid);
									if(!utils.currentStreamPoint){
										utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);
										utils.kill(child.pid);
									}
								},15000);
							});

							utils.changeScreen(OLED_DISPLAY_OPERATION.BROADCASTING);
						} else { }
					} else {
						utils.currentStreamPoint = undefined;
						if (process) {
							for (var i = 0; i < resultList.length; i++) {
								var p = resultList[i];
								ps.kill(p.pid, function (err) { });
							}
							utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);

						} else { }
					}
				}
			});
		})

		socket.on("failure", () => {
			console.log("failure");
			ps.lookup({
				command: 'avconv',
				psargs: 'lx'
			}, function (err, resultList) {
				if (err) { } else {
					const process = _.find(resultList, function (p) { return p.command == 'avconv' })
					if (process) {
							for (var i = 0; i < resultList.length; i++) {
								var p = resultList[i];
								ps.kill(p.pid, function (err) { });
							}
							utils.changeScreen(OLED_DISPLAY_OPERATION.INFO);
					}
				}
			});
		});

		socket.on('streamPoint', (streamId) => {
			if (streamId) {
				utils.currentStreamPoint = streamId;
			}
		});
		socket.on('updatePackage', (packageName, version) => {
			utils.changeScreen(OLED_DISPLAY_OPERATION.UPDATING);
			if (packageName === "vibluez") {
				var jsonString = fs.readFileSync('/etc/gearc.cfg', 'utf8');
				var json = JSON.parse(jsonString);
				request.post(
					utils.serviceEndpoint + "/api/gear/setGearUpdating", { form: { uid: json.uniqueId, customerId: json.ownerId } },
					function (error, response, body) {
						if (body && (response.statusCode == 200 || response.statusCode == 304)) {
							utils.softwareUpdating = true;
							bleno.stopAdvertising();
							const cmd = "sudo npm update vibluez --unsafe-perm -g";
							var child = exec(cmd);
							child.stdout.on('data', function (data) {
								console.log("stdout: " + data);
							});
							child.stderr.on('data', function (data) {
								console.log("stderr: " + data);
							})
							child.on('close', function (code) {
								utils.softwareUpdating = false;
								console.log("closing code : " + code);
								var jsonString = fs.readFileSync('/etc/gearc.cfg', 'utf8');
								var json = JSON.parse(jsonString);
								json.version = version;
								fs.writeFileSync('/etc/gearc.cfg', JSON.stringify(json));
								exec("sudo reboot");
							})

							// exec(cmd, {maxBuffer : 1024 * 1024 * 500}, function(error, stdout, stderr){
							// 	if(stdout){
							// 		console.log(stdout);
							// 		var jsonString = fs.readFileSync('/etc/gearc.cfg','utf8');
							// 		var json = JSON.parse(jsonString);
							// 		json.version = version;
							// 		fs.writeFileSync('/etc/gearc.cfg',JSON.stringify(json));
							// 		exec("sudo reboot");
							// 	}
							// });
						} else {
							const stack = {
								t: 0,
								m: "An error occured, please try again"
							};
							// utils.errorStack = stack;
							// var result = Characteristic.RESULT_UNLIKELY_ERROR;
							// callback(result); 
						}

					}
				);

			}
		});
	}
}

module.exports = {
	"establish": establish
}
