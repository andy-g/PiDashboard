var exec = require('child_process').exec;

module.exports = function(){
	this.driveUsage = function(callback) {
		exec("df -h", function(error, stdout, stderr){
			if (error !== null) {
				console.log('exec error: ' + error);
				//res.json(500, {"err" : "Disk usage could not be retrieved."});
				callback({"err" : "Disk usage could not be retrieved."}, null);
			}
			formatDriveUsage(stdout, function(err, drive_usage){
				if (err) {
					//res.json(500, {"err" : "Disk usage could not be retrieved."});
					callback({"err" : "Disk usage could not be retrieved."}, null);
				} else	
					callback(null, drive_sage);//res.json(drive_usage);
			});
		});
	};

	function formatDriveUsage(stdout, callback) {
		var drive_usage = { "date": Date.now(), "drives": [] };
		var drives = stdout.match(/\/dev.*/gi);
		if (drives === null){
			callback("Drive usage could not be retrieved.", undefined);	
			return;
		}
		
		drives.forEach(function(drive){
			var row_array = drive.split(/\s+/g);
			drive_usage.drives.push({"mount" : row_array[5], "size" : row_array[1], "avail" : row_array[3], "used" : row_array[4]});
		});
		callback(undefined, drive_usage);
	}
}