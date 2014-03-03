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
			"timePeriods":[{ "name": "Night Surfer", "endHour": 5 },{ "name": "Peak", "endHour": 23 },{ "name": "Night Surfer", "endHour": 24 }],
			"namedDevices": { "00-00-00-00-00-67": "Raspberry Pi" }
		};
		
		var system = new System(appSettings);
		system.getCurrentNetworkUsage = function(callback){
			callback(null, JSON.parse('{"date":1393857406320,"stats":[{"ip_add":"192.168.1.150","mac_add":"00-00-00-00-00-67","device_name":"Raspberry Pi","total_bytes":126129},{"ip_add":"192.168.1.111","mac_add":"00-00-00-00-00-9C","device_name":"unknown","total_bytes":289547}]}'));
		};
		system.getNetworkUsageHistory = function(callback){
			callback(null, JSON.parse('[{"date":1393852980263,"stats":[{"ip_add":"192.168.1.150","mac_add":"00-00-00-00-00-67","device_name":"Raspberry Pi","total_bytes":126129},{"ip_add":"192.168.1.111","mac_add":"00-00-00-00-00-9C","device_name":"unknown","total_bytes":289547}]},{"date":1393853010249,"stats":[{"ip_add":"192.168.1.150","mac_add":"00-00-00-00-00-67","device_name":"Raspberry Pi","total_bytes":126129},{"ip_add":"192.168.1.111","mac_add":"00-00-00-00-00-9C","device_name":"unknown","total_bytes":289547}]}]'));
		};

		system.getUsageSummary(new Date(parseInt(1393857406320)), function(error, data){
			data.date = 1393857712000;
			data.stats.sort(function(a,b){ return a.mac_add > b.mac_add; });
			test.deepEqual(data, JSON.parse('{"date": 1393857712000,"stats": [{"mac_add": "00-00-00-00-00-67","ip_add": "192.168.1.150","device_name": "Raspberry Pi","total_bytes": 126129,"today_bytes": 126129,"usageToDate": {"total": 126129,"Peak": 126129},"usageToday": {"total": 126129,"Peak": 126129}},{"mac_add": "00-00-00-00-00-9C","ip_add": "192.168.1.111","device_name": "unknown","total_bytes": 289547,"today_bytes": 289547,"usageToDate": {"total": 289547,"Peak": 289547},"usageToday": {"total": 289547,"Peak": 289547}}]}', 'Network Usage Summary') );
			test.done();
		});
	}
};