var request = require('request'),
	exec = require('child_process').exec,
	fs = require('fs'),
	formatHelper = require('./formatHelper'),
	_settings = require('../app.config.json'),
	schedule = require('node-schedule');


//try cache data, and load it on startup or when rewriting to the file
exports.usageSummary = function(req, res) {
	var runDate = !req.param('runDate') ? new Date() : new Date(parseInt(req.param('runDate')));

	res.header("Access-Control-Allow-Origin", "*");
	GetCurrentUsage(function (err, current_usage) {
		if (!current_usage){
			res.json(500, {"err" : "Current usage could not be retrieved - check router status."});
			return;
		}

		GetUsageHistory(function (err, data) {
			current_usage.isCurrent = true;
			data = data.concat(current_usage);

			//sort by date
			data.sort(function(a,b){ return a.date - b.date; });
			data.totals = {};

			//process each period
			data.reduce(function(previousValue, currentValue, index, array){
		  		var periodUsage = 0;
		  		var jobPeriod = _settings.timePeriods.filter(function (element, index, array) {  
						return currentValue.isCurrent ? 
							element.endHour > (new Date(currentValue.date)).getHours() :
							element.endHour >= (new Date(currentValue.date)).getHours();
		  			}).sort(function(a,b){ return a.endHour - b.endHour; })[0];
				var periodDate = new Date(currentValue.date);

				//process each ip address for period
		  		currentValue.stats.reduce(function(previousValue, currentValue, index, array){
		  			if (!data.totals[currentValue.ip_add])
		  				data.totals[currentValue.ip_add] = { usageToDate: { total: 0 }, usageToday: { total: 0 }, lastTotal: 0 };

		  			data.totals[currentValue.ip_add].mac_add = currentValue.mac_add;
		  			data.totals[currentValue.ip_add].device_name = currentValue.device_name;

					//If we're starting a new month, period usage should be forced to 0
					if (periodDate.getDate() != 1 || periodDate.getHours() != 0){
						periodUsage = parseInt(currentValue.total_bytes) - (data.totals[currentValue.ip_add].lastTotal || 0);
						if (periodUsage < 0) { //if periodUsage is < 0, router must have been reset in the period, so just use the Total usage as a period usage
							periodUsage = parseInt(currentValue.total_bytes);
						}
		  			}

		  			data.totals[currentValue.ip_add].usageToDate[jobPeriod.name] = (data.totals[currentValue.ip_add].usageToDate[jobPeriod.name] || 0) + periodUsage;
		  			data.totals[currentValue.ip_add].usageToDate.total = data.totals[currentValue.ip_add].usageToDate.total + periodUsage;
		  			data.totals[currentValue.ip_add].lastTotal = parseInt(currentValue.total_bytes);

					//Get Today's (runDate) usage (only include if period date is after 00:01 - allow 1 minute delay in midnight run running)
					if (periodDate > new Date(runDate).setHours(0,1,0,0) && periodDate <= new Date(new Date(runDate).setDate(runDate.getDate()+1)).setHours(0,1,0,0)){
		  				data.totals[currentValue.ip_add].usageToday[jobPeriod.name] = (data.totals[currentValue.ip_add].usageToday[jobPeriod.name] || 0) + periodUsage;
		  				data.totals[currentValue.ip_add].usageToday.total = data.totals[currentValue.ip_add].usageToday.total + periodUsage;
		  			}
		  		},0);
			},0);

			//enrich and format
			data.output = { date: Date.parse(runDate), stats: [] };
			for (var prop in data.totals) {
				delete data.totals[prop].lastTotal;
				data.output.stats.push({
					"ip_add": prop, 
					"mac_add": data.totals[prop].mac_add, 
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
				return element.usageToDate.total != 0;	
			});
			res.json(data.output);

			//Nullify variable to force Garbage Collection
			data = null;
		});
	});
};


exports.drives = function(req, res) {
   	res.header("Access-Control-Allow-Origin", "*");
	exec("df -h", function(error, stdout, stderr){
		if (error !== null) {
				console.log('exec error: ' + error);
				res.json(500, {"err" : "Disk usage could not be retrieved."});
	    	}
   			GetDriveUsage(stdout, function(err, drive_usage){
   				if (err) {
					res.json(500, {"err" : "Disk usage could not be retrieved."});
	    		} else	
    				res.json(drive_usage);
	    	})
	});
};

exports.serviceStatus = function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");

	var service = _settings.services[req.param('service')];

	//If service isn't in config then exit 
	if (!service){
		res.json(500, {"err" : "Specified service is not configured"});
		return;
	}

	var status = !req.param('status') || !(/start|stop/g).test(req.param('status')) ? "status" : req.param('status');
	if (req.param('isScheduled')){
		if (service.jobs) {
			service.jobs.forEach(function(job){ job.cancel(); });
			delete service.jobs;
		} 
		if (req.param('isScheduled') === 'true' && service.startSchedule && service.endSchedule){
			var serviceStart = schedule.scheduleJob(service.serviceName + '-start', service.startSchedule, function(){ ExecService(service.serviceName, 'start'); });
			var serviceStop  = schedule.scheduleJob(service.serviceName + '-stop', service.endSchedule,   function(){ ExecService(service.serviceName, 'stop'); });
			service.jobs = [serviceStart, serviceStop];

			//if it's currently after startSchedule and before endSchedule, set status = "start"
			if (serviceStop.nextInvocation() < serviceStart.nextInvocation())
				status = "start";
		}
	} 

	var isScheduled = !!service.jobs;
	if (status != "status" && req.route.method != "put"){
		res.json(500, {"err" : "Service status could not be set using a get request, please rather use a put request"});
		return;
	}

	ExecService(service.serviceName, status, function(output){ 
		if (!output.err) {
			output.isScheduled = isScheduled;
			res.json(output);
		} else {
			res.json(500, output);
		}
	});
};

function ExecService(serviceName, status, callback){
	var d = require('domain').create();
	d.on('error', function(err){
		console.log('Exec Service Error:');
		console.log(err);
	});

	d.run(function(){
		exec("sudo /etc/init.d/" + serviceName + " " + status, function(error, stdout, stderr){
			if (status != "status" && error !== null) {
				console.log('exec error: ' + error + ' stdout: ' + stdout + ' stderr: ' + stderr);
				if (callback)
					callback({"err" : "Service status could not be " + (status == "start" ? "started" : "stopped") +"."});
				return;
		    }

		    //If we're setting the status, just return what we've set it to (return can come back before service status is changed), otherwise verify output to determine service status
			if (callback)
				callback({ service: serviceName, status: (status == "status" ? (stdout.indexOf(serviceName + " is running") > -1) : (status == "start")) });
		});
	});
}

function GetUsageHistory(callback){
	fs.readFile(_settings.usageHistoryPath, function (err, data) {
		var usage_history = (!data || data.length == 0) ? new Array() : JSON.parse(data);
		callback(undefined, usage_history);
	});
};

function GetCurrentUsage(callback){
	var current_usage = { "date": Date.now(), "stats": new Array() };
	request(
		{uri: _settings.routerStatsUri, strictSSL: false},
		function(err, response, body){
			if (err){
				callback( { msg: "GetCurrentUsage: No response body.", "error": err } );
			} else {
				//Iterate through current usage stats for each device
				var ip_row_collection = body.match(/"(?:[0-9]{1,3}\.){3}[0-9]{1,3}.*(?=,)/gi);
				for (i = 0; i < ip_row_collection.length; i++){
					var row_array = ip_row_collection[i].replace(/(\s|")/g,'').split(',');
					current_usage.stats[i] = {"ip_add" : row_array[0], "mac_add" : row_array[1], "device_name" : (_settings.namedDevices[row_array[0]] || "unknown"), "total_bytes" : parseInt(row_array[3]) };
				}
				callback(err, current_usage);
			}
        }
	);
};
exports.GetCurrentUsage = GetCurrentUsage;

function SaveUsageHistory(currentUsage, callback){
	GetUsageHistory(function (err, data) {
		if (data){
			//If it's the first day of the month, backup the current file with a _YYYYMM suffix, eg: usage_history_201306.json
			var _date = new Date(currentUsage.date);
			if (_date.getDate() == 1 && _date.getHours() == 0){
				_date.setDate(_date.getDate()-1); //Move date back 1 day to determine previous month details
				fs.renameSync(
					_settings.usageHistoryPath, 
					_settings.usageHistoryPath.replace(".json","_" + _date.getFullYear() + formatHelper.padNumber(_date.getMonth() + 1, 2) + ".json")
				);
				//Reset data for the new month
				data = new Array();
			}

			fs.writeFile(_settings.usageHistoryPath, JSON.stringify(data.concat(currentUsage), null, "\t"), function(err) {
				callback( {"message" : "usage data saved successfully."} );
			});

			//Nullify variable to force Garbage Collection
			data = null;
		}
		else 
			callback( { msg: "SaveUsageHistory: No data found.", "error": err } );
	});
}
exports.SaveUsageHistory = SaveUsageHistory;

function GetDriveUsage(stdout, callback) {
	var drive_usage = { "date": Date.now(), "drives": new Array() };
	var drives = stdout.match(/\/dev.*/gi);
	if (drives == null){
		callback("Drive usage could not be retrieved.", undefined);	
		return;
	}
	
	drives.forEach(function(drive){
		var row_array = drive.split(/\s+/g);
		drive_usage.drives.push({"mount" : row_array[5], "size" : row_array[1], "avail" : row_array[3], "used" : row_array[4]});
	});
	callback(undefined, drive_usage);
}