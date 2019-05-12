var util = require('util');

var bleno = require('bleno');

var BlenoPrimaryService = bleno.PrimaryService;

var WifiListCharacteristic = require('../Characteristics/WifiListCharacteristic.js');
var WifiConnectCharacteristic = require('../Characteristics/WifiConnectCharacteristic.js');
var BroadcastCharacteristic = require('../Characteristics/BroadcastCharacteristic.js');
var InformCharacteristic = require('../Characteristics/InformCharacteristic.js');
var WifiCheckCharacteristic = require('../Characteristics/WifiCheckCharacteristic');
var WifiConnectionCheckerCharacteristic = require("../Characteristics/WifiConnectionCheckerCharacteristic");
var DisconnectFromWifiCharacteristic = require("../Characteristics/DisconnectFromWifiCharacteristic");
var WifiSwitchCharacteristic = require("../Characteristics/WifiSwitcherCharacteristic");
var AutoJoinCharacteristic = require("../Characteristics/AutoJoinCharacteristic");
var ForgetNetworkCharacteristic = require("../Characteristics/ForgetNetworkCharacteristic");
var RegisterCharacteristic = require("../Characteristics/RegisterCharacteristic");
var ActivateCharacteristic = require("../Characteristics/ActivateCharacteristic");
var ErrorStackCharacteristic = require("../Characteristics/ErrorStackCharacteristic");
var SecureDeviceCharacteristic = require("../Characteristics/SecureDeviceCharacteristic");
var ListRecordsCharacteristic = require("../ListRecordsCharacteristic");
function RadioStarterService(){ 
	RadioStarterService.super_.call(this, {
		uuid: '6674d28ae11111e780c19a214cf093ae',
		characteristics : [
			new WifiListCharacteristic(),
			new WifiConnectCharacteristic(),
			new BroadcastCharacteristic(),
			new InformCharacteristic(),
			new WifiCheckCharacteristic(),
			new WifiConnectionCheckerCharacteristic(),
			new DisconnectFromWifiCharacteristic(),
			new WifiSwitchCharacteristic(),
			new AutoJoinCharacteristic(),
			new ForgetNetworkCharacteristic(),
			new RegisterCharacteristic(),
			new ActivateCharacteristic(),
			new ErrorStackCharacteristic(),
			new SecureDeviceCharacteristic(),
			new ListRecordsCharacteristic()
		]
	})
}

util.inherits(RadioStarterService, BlenoPrimaryService);

module.exports = RadioStarterService;
