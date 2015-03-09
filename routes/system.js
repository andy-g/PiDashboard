var	exec = require('child_process').exec,
	request = require('request'),
	fs = require('fs'),
	formatHelper = require('./formatHelper'),
	moment = require('moment');

module.exports = function(appSettings){
	var system = this;

	this.driveUsage = function(callback) {
		exec("df -h", function(error, stdout, stderr){
			if (error !== null) {
				system.log('exec error: ' + error);
				//res.json(500, {"err" : "Disk usage could not be retrieved."});
				callback({"err" : "Disk usage could not be retrieved."}, null);
				return;
			}
			system.formatDriveUsage(stdout, function(err, drive_usage){
				if (err) {
					//res.json(500, {"err" : "Disk usage could not be retrieved."});
					callback({"err" : "Disk usage could not be retrieved."}, null);
				} else	{
					callback(null, drive_usage);//res.json(drive_usage);
				}
			});
		});
	};

	this.formatDriveUsage = function(stdout, callback) {
		var drive_usage = { "date": Date.now(), "drives": [] };
		var drives = stdout.match(/\/dev\/.*/gi);
		if (drives === null){
			callback("Drive usage could not be retrieved.", undefined);	
			return;
		}
		
		drives.forEach(function(drive){
			var row_array = drive.split(/\s+/g);
			drive_usage.drives.push({"mount" : row_array[5], "size" : row_array[1], "avail" : row_array[3], "used" : row_array[4]});
		});
		callback(undefined, drive_usage);
	};

	this.getCurrentNetworkUsage = function(reset, callback){
		var current_usage = { "date": Date.now(), "devices": [] };
		request(
			{uri: appSettings.routerStatsUri + (reset ? '?reset' : ''), strictSSL: false},
			function(err, response, body){
				if (err){
					callback( { msg: "getCurrentUsage: No response body.", "error": err } );
				} else {
					JSON.parse(body).devices.forEach(function(device){
						current_usage.devices.push({
							"ip": device.ip,
							"mac": device.mac.toUpperCase(),
							"total_bytes": parseInt(device.in) + parseInt(device.out)
						});
					});
					callback(err, current_usage);
				}
			}
		);
	};

	this.getNetworkUsageHistory = function(callback){
		fs.readFile(appSettings.usageHistoryPath, function (err, data) {
			var usage_history = (!data || data.length === 0) ? {} : JSON.parse(data);
			callback(undefined, usage_history);
		});
	};

	// Get the historic usage and merge in the current usage
	this.getMergedUsage = function(previous_period, reset, callback){
		system.getNetworkUsageHistory(function (err, historic_usage) {
			if (err && ! historic_usage){
				callback(err);
				return;
			}

			system.getCurrentNetworkUsage(reset, function(err, current_usage){
				if (err && ! current_usage){
					callback(err);
					return;
				}
				var _now = new Date(current_usage.date);

				// If this is an adhoc call (not on the hour), include current usage for current hours, not previous hour
				if ( ! previous_period)
					_now.setHours(_now.getHours()+1);

				var _today = new Date(new Date(_now).setHours(0,0,0,0));

				// Retrieve or create entry for today (or yesterday if the hour is 0), and set the usage for each device
				var hour = _now.getHours();
				if (_now.getHours() === 0){
					_today.setDate(_today.getDate()-1);
					hour = 24;
				}

				//If we're logging for the first day of the month, don't include previous data
				if (_now.getDate() == 1 && hour === 1)
					historic_usage = {};

				var today_usage = historic_usage[_today.valueOf()] || (historic_usage[_today.valueOf()] = { "devices": {} });
				current_usage.devices.forEach(function(device){
					if ( ! today_usage.devices[device.mac])
						today_usage.devices[device.mac] = { "hourly_usage": [] };
					today_usage.devices[device.mac].ip = device.ip;
					today_usage.devices[device.mac].hourly_usage[hour] = device.total_bytes;

					// Replace empty elements with 0
					for (var i = 0; i < today_usage.devices[device.mac].hourly_usage.length; i++) {
						if (today_usage.devices[device.mac].hourly_usage[i] === undefined)
							today_usage.devices[device.mac].hourly_usage[i] = 0;
					}
				});

				callback(undefined, historic_usage);
			});
		});
	};

	this.saveCurrentNetworkUsage = function(callback){
		system.getMergedUsage(true, true, function(err, usage){
			if (err && ! usage){
				system.log("saveCurrentNetworkUsage Error: " + JSON.stringify(err));
				return;
			}

			var _now = new Date();

			//If we're logging for the first day of the month, backup the current file with a _YYYYMM suffix, eg: usage_history_201306.json
			if (_now.getDate() == 1 && _now.getHours() === 1){
				var _yesterday = new Date(_now.setDate(_now.getDate()-1));
				fs.renameSync(
					appSettings.usageHistoryPath,
					appSettings.usageHistoryPath.replace(".json","_" + _yesterday.getFullYear() + formatHelper.padNumber(_yesterday.getMonth() + 1, 2) + ".json")
				);
			}

			fs.writeFile(appSettings.usageHistoryPath, JSON.stringify(
				usage,
				function(key, value){
					return (Array.isArray(this) && value === undefined) ? 0 : value;
				},
				"\t"), function(err) {
				callback("Save hourly usage: usage data saved successfully.");
			});


		});
	};

	this.getUsageSummary = function(runDate, callback){
		system.getMergedUsage(false, false, function(err, usage){
			if (err && ! usage) {
				system.log("getUsageSummary Error: " + JSON.stringify(err));
				return;
			}

			var summary = { "date": runDate.valueOf(), "devices": {} };

			function populateByPeriod(timePeriod){
				if ( ! summary.devices[mac].usageToDate[timePeriod.name])
					summary.devices[mac].usageToDate[timePeriod.name] = 0;
				if ( ! summary.devices[mac].usageToday[timePeriod.name])
					summary.devices[mac].usageToday[timePeriod.name] = 0;

				timePeriod.periods.forEach(function(period){
					_usage_in_period = usage[day].devices[mac].hourly_usage.slice(period.start + 1, period.stop + 1);
					if (_usage_in_period.length > 0){
						usage[day].devices[mac].hourly_usage.slice(period.start + 1, period.stop + 1).forEach(function(hour_usage){
							summary.devices[mac].usageToDate[timePeriod.name] += hour_usage;
							summary.devices[mac].total_bytes += hour_usage;
							if (is_rundate){
								summary.devices[mac].usageToday[timePeriod.name] += hour_usage;
								summary.devices[mac].today_bytes += hour_usage;
							}
						});
					}
				});
			}

			for (var day in usage) {
				var is_rundate = (day == runDate.setHours(0,0,0,0));
				for (var mac in usage[day].devices) {
					device = usage[day].devices[mac];
					if ( ! summary.devices[mac])
						summary.devices[mac] = { "mac": mac, "ip": device.ip, "total_bytes": 0, "today_bytes": 0, "usageToDate": {}, "usageToday": {} };

					// Populate usage by period
					appSettings.timePeriods.forEach(populateByPeriod);
				}
			}

			// Add device name
			for (var device in summary.devices) {
				summary.devices[device].device_name = appSettings.namedDevices[summary.devices[device].mac] || "unknown";
			}

			// Add the latest IP address for the mac

			// move the day usage to an array to sort by usage desc
			var device_array = [];
			for (var device_item in summary.devices)
				device_array.push(summary.devices[device_item]);
			device_array.sort(function(a,b){ return b.total_usage - a.total_usage; });
			summary.devices = device_array;

			callback(null, summary);
		});
	};

	this.getGraphData = function(runDate, old, callback){
		system.getMergedUsage(false, false, function(err, usage){
			var json = [];
			var dayUsage = usage[runDate.setHours(0,0,0,0)];
			for (var mac in dayUsage.devices) {
				var item = { "name": appSettings.namedDevices[mac] || "unknown", "data": [] };
				if (old)
					item = { "key": appSettings.namedDevices[mac] || "unknown", "values": [] };	
				dayUsage.devices[mac].hourly_usage.forEach(function(bytes, index){
					if (old)
						item.values.push({ "x": index, "y": bytes});
					else
						item.data.push(bytes);
				});
				json.push(item);
			}

			callback(null, json);
		});
	};

	this.execService = function(serviceName, status, callback){
		if (status != "status")
			system.log("execService: " + status + "ing " + serviceName);

		var d = require('domain').create();
		d.on('error', function(err){
			system.log('Exec Service Error:');
			console.log(err);
		});

		d.run(function(){
			var cmd = '';
			if (serviceName == 'kodi')
				cmd = "sudo initctl " + status + " " + serviceName;
			else
				cmd = "sudo /etc/init.d/" + serviceName + " " + status;

			exec(cmd, function(error, stdout, stderr){
				if (status != "status" && error !== null) {
					system.log('exec error: ' + error.stack);
					if (callback)
						callback({"err" : "Service status could not be " + (status == "start" ? "started" : "stopped") +"."});
					return;
				}

				//If we're setting the status, just return what we've set it to (return can come back before service status is changed), otherwise verify output to determine service status
				if (callback)
					callback({ service: serviceName, status: (status == "status" ? ((stdout.indexOf(" is running") > -1) || (stdout.indexOf("start/running") > -1)) : (status == "start")) });
			});
		});
	};

	this.getIpAddress = function(callback){
		request(
			{ uri: 'http://checkip.dyndns.com/' },
			function(err, response, body){
				if (err){ 
					system.log(err);
					callback(err, null);
				} else {
					var ipAddress = body.match(/[0-9]+(?:\.[0-9]+){3}/)[0];
					callback(null, ipAddress);
				}
			}
		);
	};

	this.sendPushNotification = function(message){
		if (appSettings.pushCo.enabled){
			request.post({
					uri: 'https://api.push.co/1.0/push',
					form: { api_key: appSettings.pushCo.keys.api_key, api_secret: appSettings.pushCo.keys.api_secret, message: message }
				},
				function(err, response, body){
					if (err){ system.log(err);	}
				}
			);
		}
		if (appSettings.boxcar2.enabled){
			request.post({
					uri: 'https://new.boxcar.io/api/notifications/',
					form: { "user_credentials": appSettings.boxcar2.access_token, "notification[title]": message, "notification[icon_url]": appSettings.boxcar2.notification_icon }
					// can also add notification[long_message] (can include html formatting), notification[sound], notification[source_name],  notification[icon_url]"
					// check this url for details: http://help.boxcar.io/knowledgebase/articles/306788-how-to-send-a-notification-to-boxcar-users
				},
				function(err, response, body){
					if (err){ system.log(err);	}
				}
			);
		}
	};

	this.log = function(message){
		console.log(moment().format('YYYY-MM-DD HH:mm:ss') + ' ' + message);
	};
};
