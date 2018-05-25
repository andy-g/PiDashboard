var exec = require('child_process').exec,
	request = require('request'),
	fs = require('fs'),
	formatHelper = require('./formatHelper'),
	moment = require('moment');

module.exports = function (appSettings) {
	var system = this;

	this.driveUsage = function (callback) {
		exec("df -xtmpfs -xdevtmpfs", function (error, stdout, stderr) {
			if (error !== null) {
				system.log('exec error: ' + error);
				//res.json(500, {"err" : "Disk usage could not be retrieved."});
				callback({ "err": "Disk usage could not be retrieved." }, null);
				return;
			}

			// Mocked data
			var stdout = 'Filesystem     1K-blocks      Used Available Use% Mounted on\n/dev/mmcblk0p2  14935048   3320444  10832884  24% /\n/dev/mmcblk0p1    244988     56741    188248  24% /boot\n/dev/sda1      961299784 870673472  41771992  96% /mnt/media'
			system.formatDriveUsage(stdout, function (err, drive_usage) {
				if (err) {
					//res.json(500, {"err" : "Disk usage could not be retrieved."});
					callback({ "err": "Disk usage could not be retrieved." }, null);
				} else {
					callback(null, drive_usage);//res.json(drive_usage);
				}
			});
		});
	};

	this.formatDriveUsage = function (stdout, callback) {
		var drive_usage = { "date": Date.now(), "drives": [] };
		var drives = stdout.match(/\/dev\/.*/gi);
		if (drives === null) {
			callback("Drive usage could not be retrieved.", undefined);
			return;
		}

		drives.forEach(function (drive) {
			var row_array = drive.split(/\s+/g);
			drive_usage.drives.push({ "title": row_array[5], "allocated": parseInt(row_array[1]), "used": parseInt(row_array[2]) });
		});
		callback(undefined, drive_usage);
	};

	this.getServiceStatus = function (service, callback) {
		// Mocked data
		//return callback(null, [{ "title": "Transmission", "status": "stopped", "scheduled": true }, { "title": "Sickbeard", "status": "stopped", "scheduled": true }, { "title": "SABnzbd+", "status": "stopped", "scheduled": true }, { "title": "Kodi", "status": "started" }])

		var promises = [];
		var services = appSettings.services;

		// Filter down to only show the relevant service if specified
		if (service) {
			services = services.filter(s => s.title == service)
			if (services.length !== 1)
				return callback('service not found, or not unique')
		}

		services.forEach(service => {
			var promise = new Promise(function (resolve, reject) {
				var cmd
				if (service.title == 'kodi')
					cmd = 'sudo systemctl status mediacenter'
				else
					cmd = 'sudo service ' + service.serviceName + ' status'

				exec(cmd, function (error, stdout, stderr) {
					resolve({
						title: service.title,
						status: ((stdout.indexOf('Active: active (running)') > -1)) ? 'started' : 'stopped',
						scheduled: !service.startSchedule ? null : !!service.jobs,
					})
				})
			})
			promises.push(promise)
		})

		Promise.all(promises).then(function (values) {
			// console.log(values)
			return callback(null, values)
			// res.json({ "status": "promises complete: " + values });
		})
	}

	this.getIspNetworkUsage = function (runDate, callback) {
		request.post({
			uri: appSettings.ispStatsUri,
			form: {
				'action': "getdailyusage",
				'serviceAccountId': 1760,
				'displayMonth': 1525132800000
			}
		},
			function (err, response, body) {
				if (err) { system.log(err); }

				let source = JSON.parse(body)
				var formattedData = []
				for (let index = 0; index < Math.max(source.peakDailyUL.length, source.offPeakDailyUL.length, source.peakDailyDL.length, source.offPeakDailyDL.length); index++) {
					formattedData.push({
						"date": new Date((new Date(1525132800000)).setDate(index + 1)).toJSON(),
						"peak": {
							"up": source.peakDailyUL[index],
							"down": source.peakDailyDL[index]
						},
						"offPeak": {
							"up": source.offPeakDailyUL[index],
							"down": source.offPeakDailyDL[index]
						}
					})
				}

				callback(null, formattedData);
			}
		);
	}



	this.getIpAddress = function (callback) {
		request(
			{ uri: 'http://checkip.dyndns.com/' },
			function (err, response, body) {
				if (err) {
					system.log(err);
					callback(err, null);
				} else {
					var ipAddress = body.match(/[0-9]+(?:\.[0-9]+){3}/)[0];
					callback(null, ipAddress);
				}
			}
		);
	};

	this.sendPushNotification = function (message) {
		if (appSettings.boxcar2.enabled) {
			request.post({
				uri: 'https://new.boxcar.io/api/notifications/',
				form: { "user_credentials": appSettings.boxcar2.access_token, "notification[title]": message, "notification[icon_url]": appSettings.boxcar2.notification_icon }
				// can also add notification[long_message] (can include html formatting), notification[sound], notification[source_name],  notification[icon_url]"
				// check this url for details: http://help.boxcar.io/knowledgebase/articles/306788-how-to-send-a-notification-to-boxcar-users
			},
				function (err, response, body) {
					if (err) { system.log(err); }
				}
			);
		}
	};

	this.log = function (message) {
		console.log(moment().format('YYYY-MM-DD HH:mm:ss') + ' ' + message);
	};
};
