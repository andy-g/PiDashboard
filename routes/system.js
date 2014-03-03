var	exec = require('child_process').exec,
	request = require('request'),
	fs = require('fs');

module.exports = function(appSettings){
	this.driveUsage = function(callback) {
		exec("df -h", function(error, stdout, stderr){
			if (error !== null) {
				console.log('exec error: ' + error);
				//res.json(500, {"err" : "Disk usage could not be retrieved."});
				callback({"err" : "Disk usage could not be retrieved."}, null);
				return;
			}
			formatDriveUsage(stdout, function(err, drive_usage){
				if (err) {
					//res.json(500, {"err" : "Disk usage could not be retrieved."});
					callback({"err" : "Disk usage could not be retrieved."}, null);
				} else	{
					callback(null, drive_sage);//res.json(drive_usage);
				}
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

	this.getCurrentNetworkUsage = function(callback){
		var current_usage = { "date": Date.now(), "stats": [] };
		request(
			{uri: appSettings.routerStatsUri, strictSSL: false},
			function(err, response, body){
				if (err){
					callback( { msg: "getCurrentUsage: No response body.", "error": err } );
				} else {
					//Iterate through current usage stats for each device
					var mac_row_collection = body.match(/"(?:[0-9]{1,3}\.){3}[0-9]{1,3}.*(?=,)/gi);
					for (var i = 0; i < mac_row_collection.length; i++){
						var row_array = mac_row_collection[i].replace(/(\s|")/g,'').split(',');
						current_usage.stats[i] = {"ip_add" : row_array[0], "mac_add" : row_array[1], "device_name" : (appSettings.namedDevices[row_array[1]] || "unknown"), "total_bytes" : parseInt(row_array[3]) };
					}
					callback(err, current_usage);
				}
			}
		);
	};

	this.getNetworkUsageHistory = function(callback){
		fs.readFile(appSettings.usageHistoryPath, function (err, data) {
			var usage_history = (!data || data.length === 0) ? [] : JSON.parse(data);
			callback(undefined, usage_history);
		});
	};

	this.saveCurrentNetworkUsage = function(callback){
		var system = this;
		system.getCurrentNetworkUsage(function(err, currentUsage){
			if (err) { 
				console.log(new Date().toJSON() + " save error: " + JSON.stringify(err));
			} else {
				system.getNetworkUsageHistory(function (err, data) {
					if (data){
						//If it's the first day of the month, backup the current file with a _YYYYMM suffix, eg: usage_history_201306.json
						var _date = new Date(currentUsage.date);
						if (_date.getDate() == 1 && _date.getHours() === 0){
							_date.setDate(_date.getDate()-1); //Move date back 1 day to determine previous month details
							fs.renameSync(
								appSettings.usageHistoryPath, 
								appSettings.usageHistoryPath.replace(".json","_" + _date.getFullYear() + formatHelper.padNumber(_date.getMonth() + 1, 2) + ".json")
							);
							//Reset data for the new month
							data = [];
						}

						fs.writeFile(appSettings.usageHistoryPath, JSON.stringify(data.concat(currentUsage), null, "\t"), function(err) {
							callback( {"message" : "usage data saved successfully."} );
						});

						//Nullify variable to force Garbage Collection
						data = null;
					}
					else {
						callback( { msg: "saveUsageHistory: No data found.", "error": err } );
					}
				});				
			}
		});		
	};

	this.getUsageSummary = function(runDate, callback){
		var system = this;
		system.getCurrentNetworkUsage(function (err, current_usage) {
			if (!current_usage){
				callback({"err" : "Current usage could not be retrieved - check router status."}, null);
				return;
			}

			system.getNetworkUsageHistory(function (err, data) {
				current_usage.isCurrent = true;
				data = data.concat(current_usage);

				//sort by date
				data.sort(function(a,b){ return a.date - b.date; });
				data.totals = {};

				//process each period
				data.forEach(function(currentPeriod){
					var periodUsage = 0;
					var jobPeriod = appSettings.timePeriods.filter(function (element, index, array) {  
							return currentPeriod.isCurrent ? 
								element.endHour > (new Date(currentPeriod.date)).getHours() :
								element.endHour >= (new Date(currentPeriod.date)).getHours();
						}).sort(function(a,b){ return a.endHour - b.endHour; })[0];
					var periodDate = new Date(currentPeriod.date);

					//group stats by device (some devices are duplicated for distinct IP's e.g. VPN)
					var periodStatsGrouped = {};
					currentPeriod.stats.forEach(function(device){
						if (!periodStatsGrouped[device.mac_add]) {
							periodStatsGrouped[device.mac_add] = {};
							periodStatsGrouped[device.mac_add].ip_add = device.ip_add;
							periodStatsGrouped[device.mac_add].device_name = device.device_name;
							periodStatsGrouped[device.mac_add].total_bytes = device.total_bytes;
						} else
							periodStatsGrouped[device.mac_add].total_bytes += device.total_bytes;
					});

					//process each mac address for period
					for (var mac_add in periodStatsGrouped) {
						var currentDevice = periodStatsGrouped[mac_add];
						
						if (!data.totals[mac_add]) {
							data.totals[mac_add] = { usageToDate: { total: 0 }, usageToday: { total: 0 }, lastTotal: 0 };
							data.totals[mac_add].device_name = appSettings.namedDevices[mac_add] || "unknown";
							data.totals[mac_add].ip_add = currentDevice.ip_add;
						}
						
				
						//If we're starting a new month, period usage should be forced to 0
						if (periodDate.getDate() != 1 || periodDate.getHours() !== 0){
							periodUsage = parseInt(currentDevice.total_bytes) - (data.totals[mac_add].lastTotal || 0);
							if (periodUsage < 0) { //if periodUsage is < 0, router must have been reset in the period, so just use the Total usage as a period usage
								periodUsage = parseInt(currentDevice.total_bytes);
							}
						}

						//Need to record this even if periodUsage = 0, otherwise opening balance is ignored and included in the next period usage
						data.totals[mac_add].lastTotal = parseInt(currentDevice.total_bytes);

						if (periodUsage === 0)
							continue;

						//Return latest IP Address
						data.totals[mac_add].ip_add = currentDevice.ip_add; 

						data.totals[mac_add].usageToDate[jobPeriod.name] = (data.totals[mac_add].usageToDate[jobPeriod.name] || 0) + periodUsage;
						data.totals[mac_add].usageToDate.total = data.totals[mac_add].usageToDate.total + periodUsage;
						
						//Get Today's (runDate) usage (only include if period date is after 00:01 - allow 1 minute delay in midnight run running)
						if (periodDate > new Date(runDate).setHours(0,1,0,0) && periodDate <= new Date(new Date(runDate).setDate(runDate.getDate()+1)).setHours(0,1,0,0)){
							data.totals[mac_add].usageToday[jobPeriod.name] = (data.totals[mac_add].usageToday[jobPeriod.name] || 0) + periodUsage;
							data.totals[mac_add].usageToday.total = data.totals[mac_add].usageToday.total + periodUsage;
						}
					}
				});

				//enrich and format
				data.output = { date: Date.parse(runDate), stats: [] };
				for (var prop in data.totals) {
					delete data.totals[prop].lastTotal;
					data.output.stats.push({
						"mac_add": prop, 
						"ip_add": data.totals[prop].ip_add, 
						"device_name": data.totals[prop].device_name, 
						"total_bytes": data.totals[prop].usageToDate.total,	//include for backwards compatibility
						"today_bytes": data.totals[prop].usageToday.total,	//include for backwards compatibility
						usageToDate: data.totals[prop].usageToDate, 
						usageToday: data.totals[prop].usageToday });
				}
				
				data.output.stats.sort(function(a,b){ 
					return b.usageToday.total != a.usageToday.total ? b.usageToday.total - a.usageToday.total :	b.usageToDate.total - a.usageToDate.total;
				});
				data.output.stats = data.output.stats.filter(function(element, index, array){ 
					return element.usageToDate.total !== 0;	
				});
				
				callback(null, data.output);
				//res.json(data.output);

				//Nullify variable to force Garbage Collection
				data = null;
			});
		});
	};

	this.execService = function(serviceName, status, callback){
		var d = require('domain').create();
		d.on('error', function(err){
			console.log('Exec Service Error:');
			console.log(err);
		});

		d.run(function(){
			exec("sudo /etc/init.d/" + serviceName + " " + status, function(error, stdout, stderr){
				//if (status != "status" && error !== null) {
				if (error !== null) {
					//console.log('exec error: ' + error + ' stdout: ' + stdout + ' stderr: ' + stderr);
					console.log('exec error: ' + error.stack);
					if (callback)
						callback({"err" : "Service status could not be " + (status == "start" ? "started" : "stopped") +"."});
					return;
				}

				//If we're setting the status, just return what we've set it to (return can come back before service status is changed), otherwise verify output to determine service status
				if (callback)
					callback({ service: serviceName, status: (status == "status" ? (stdout.indexOf(serviceName + " is running") > -1) : (status == "start")) });
			});
		});
	};
};