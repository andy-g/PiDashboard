var fs = require('fs'),
	formatHelper = require('../routes/formatHelper'),
	ContentHandler = require('../routes/usage'),
	System = require('../routes/system');

exports.group = {
	//setUp: function (callback) {
	//	this.foo = 'bar';
	//	callback();
	//},
	//tearDown: function (callback) {
	//	// clean up
	//	callback();
	//},
	appExists: function(test){
		test.expect(1);

		test.ok(fs.existsSync('app.js'), 'app.js exists');

		test.done();
	},
	formatHelper: function(test){
		test.expect(5);

		test.equal(formatHelper.padNumber(3, 2), '03',  'Format Helper - Pad Number');
		test.equal(formatHelper.padNumber(20033, 4), '20033',  'Format Helper - Pad Number');
		test.equal(formatHelper.padNumber(20033, 10), '0000020033',  'Format Helper - Pad Number');
		test.equal(formatHelper.formatBytes(24723.123, 2), '24.14 KB',  'Format Helper - Pad Number');
		test.equal(formatHelper.formatBytes(1213412341, 2), '1.13 GB',  'Format Helper - Format Bytes');

		test.done();
	},
	drives: function(test){
		test.expect(1);

		var appSettings = {	};
		var system = new System(appSettings);

		var stdout = "Filesystem Size  Used Avail Use% Mounted on\n"+
			"/dev/mmcblk0p2  7.2G  1.2G  5.6G  18% /\n" +
			"/dev/mmcblk0p1   69M  8.9M   61M  13% /boot\n" +
			"/dev/sda2       459G  366G   93G  80% /media/drive1\n" +
			"/dev/sda1       466G  460G  6.5G  99% /media/drive2\n";

		system.formatDriveUsage(stdout, function(err, drive_usage){
			driveUsage = drive_usage;
			driveUsage.date = 1393856054512;
			test.deepEqual( driveUsage, JSON.parse('{"date": 1393856054512, "drives": [{"mount": "/","size": "7.2G","avail": "5.6G","used": "18%"},{"mount": "/boot","size": "69M","avail": "61M","used": "13%"},{"mount": "/media/drive1","size": "459G","avail": "93G","used": "80%"},{"mount": "/media/drive2","size": "466G","avail": "6.5G","used": "99%"}]}', 'Format Drive Usage') );
			test.done();
		});
	},
	networkUsage: function(test){
		test.expect(1);

		var appSettings = {
			"timePeriods":[{"name":"Night Surfer","periods":[{"start":0,"stop":5},{"start":23,"stop":24}]},{"name":"Peak","periods":[{"start":5,"stop":23}]}],
			"namedDevices": { "00-00-00-00-00-67": "Raspberry Pi" }
		};
		
		var system = new System(appSettings);
		system.getCurrentNetworkUsage = function(reset, callback){
			callback(null, JSON.parse('{"date":1393943806320,"devices":[{"ip":"192.168.1.150","mac":"00-00-00-00-00-67","total_bytes":100},{"ip":"192.168.1.111","mac":"00-00-00-00-00-9C","total_bytes":200}]}'));
		};
		system.getNetworkUsageHistory = function(callback){
			callback(null, JSON.parse('{"1393797600000":{"devices":{"00-00-00-00-00-67":{"ip":"192.168.1.150","hourly_usage":[0,6]},"00-00-00-00-00-9C":{"ip":"192.168.1.111","hourly_usage":[0,5]}}},"1393884000000":{"devices":{"00-00-00-00-00-67":{"ip":"192.168.1.150","hourly_usage":[0,12]},"00-00-00-00-00-9C":{"ip":"192.168.1.111","hourly_usage":[0,10]}}}}'));
		};

		system.getUsageSummary(new Date(parseInt(1393884000000)), function(error, data){
			data.date = 1393884000000;

			data.devices.sort(function(a,b){ return a.mac_add > b.mac_add; });
			test.deepEqual(data, JSON.parse('{"date": 1393884000000,"devices": [{"mac": "00-00-00-00-00-67","ip": "192.168.1.150","device_name": "Raspberry Pi","total_bytes": 118,"today_bytes": 112,"usageToDate": {"Night Surfer": 18,"Peak": 100},"usageToday": {"Night Surfer": 12,"Peak": 100}},{"mac": "00-00-00-00-00-9C","ip": "192.168.1.111","device_name": "unknown","total_bytes": 215,"today_bytes": 210,"usageToDate": {"Night Surfer": 15,"Peak": 200},"usageToday": {"Night Surfer": 10,"Peak": 200}}]}', 'Network Usage Summary') );
			test.done();
		});
	}
};