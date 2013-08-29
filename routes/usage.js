var urlparser = require('url'),
	request = require('request'),
	exec = require('child_process').exec,
	fs = require('fs'),
	formatHelper = require('./formatHelper'),
	_settings = require('../app.config.json');

//cache usage snapsot at the start of today
var _dayStartUsage;

exports.saveUsage = function(req, res) {
    res.header("Access-Control-Allow-Origin", "*");
	GetTodaysUsage(function (err, today_usage) {
		if (today_usage) 
			res.json(500, {"err" : "Usage data already exists for today"}); 
		else{	
			GetCurrentUsage(function(err, current_usage){
				if (err) { 
					console.log("save error: " + JSON.stringify(err));
					res.json(500, { err: "Error saving usage data." });
				} else {
					SaveUsageHistory(current_usage, function(message){
						res.json(message);
					});
				}
			});
		}
	});
};

exports.todaysUsage = function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	GetCurrentUsage(function (err, current_usage) {
		GetTodaysUsage(function(err,today_usage){
			//Iterate through current usage stats
			if (!current_usage){
				res.json(500, {"err" : "Usage data could not be retrieved."});
				return;
			}
			current_usage.stats.forEach(function(value, index) {
				//Determine Today's usage for this device
				var today_device_usage = "-";
				if (today_usage){
					var filtered_device = today_usage.stats.filter(function (element, index, array) {  return (element.ip_add === value.ip_add); });
					if (filtered_device.length > 0 && parseInt(filtered_device[0].total_bytes) <= parseInt(value.total_bytes))
						today_device_usage = value.total_bytes - filtered_device[0].total_bytes;
					else
     					today_device_usage = value.total_bytes;
				}
				else
     					today_device_usage = value.total_bytes;
				value.today_bytes = today_device_usage;
			});
			current_usage.stats.sort(function(a,b){ return b.today_bytes - a.today_bytes; });
			res.type('json');
			res.json(current_usage);	
		});
	});
};

//try cache data, and load it on startup or when rewriting to the file
exports.usageSummary = function(req, res) {
	var runDate = !req.param('runDate') ? new Date() : new Date(parseInt(req.param('runDate')));

	res.header("Access-Control-Allow-Origin", "*");
	GetCurrentUsage(function (err, current_usage) {
		GetUsageHistory(function (err, data) {
			data = data.concat(current_usage);

			if(err || !data){ 
				console.log( { msg: "GetTodaysUsage: No data found for today.", "error": err } );
			} else {
				//sort by date
				data.sort(function(a,b){ return a.date - b.date; });
				data.totals = {};

				//process each period
				var total = data.reduce(function(previousValue, currentValue, index, array){
			  		var jobPeriod = _settings.timePeriods.filter(function (element, index, array) {  return (element.endHour > (new Date(currentValue.date)).getHours()); })[0];
					var periodDate = new Date(currentValue.date);

					//process each ip address for period
			  		var total = currentValue.stats.reduce(function(previousValue, currentValue, index, array){
			  			if (!data.totals[currentValue.ip_add])
			  				data.totals[currentValue.ip_add] = { usageToDate: { total: 0 }, usageToday: { total: 0 }, lastTotal: 0 };
			  				//data.totals[currentValue.ip_add] = { usageToDate: {}, usageToday: {}, lastTotal: 0 };

			  			data.totals[currentValue.ip_add].mac_add = currentValue.mac_add;
			  			data.totals[currentValue.ip_add].device_name = currentValue.device_name;

						//If we're starting a new month, period usage should be forced to 0
						var periodUsage = 0;
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
			  			return previousValue + parseInt(currentValue.total_bytes);
			  		},0);

			  		return previousValue + total;;
				},0);

				//enrich and format
				data.output = { date: Date.parse(new Date()), stats: [] };
				for (var prop in data.totals) {
					delete data.totals[prop].lastTotal;
					data.output.stats.push({
						"ip_add":prop, 
						"mac_add":data.totals[prop].mac_add, 
						"device_name":data.totals[prop].device_name, 
						"total_bytes": data.totals[prop].usageToDate.total,	//include for backwards compatibility
						"today_bytes": data.totals[prop].usageToday.total,	//include for backwards compatibility
						usageToDate:data.totals[prop].usageToDate, 
						usageToday:data.totals[prop].usageToday });
				}
				
				res.type('json');
				data.output.stats.sort(function(a,b){ return (b.usageToday.total || 0) - (a.usageToday.total || 0); });
				res.json(data.output);
			}
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

// exports.serviceStatus = function(req, res) {
//     var id = req.params.id;
// };

exports.serviceStatus = function(req, res) {
	res.header("Access-Control-Allow-Origin", "*");
	var status = !req.param('status') || !(/start|stop/g).test(req.param('status')) ? "status" : req.param('status');
	
	if (status != "status" && req.route.method != "put"){
		res.json(500, {"err" : "Service status could not be set using a get request, please rather use a put request"});
		return;
	}

	exec("sudo /etc/init.d/transmission-daemon " + status, function(error, stdout, stderr){
		if (status != "status" && error !== null) {
			console.log('exec error: ' + error + ' stdout: ' + stdout + ' stderr: ' + stderr);
			res.json(500, {"err" : "Service status could not be " + (status == "start" ? "started" : "stopped") +"."});
			return;
	    }
	    //If we're setting the status, just return what we've set it to (return can come back before service status is changed), otherwise verify output to determine service status
	    res.json({service: "transmission", status: (status == "status" ? (stdout.indexOf("transmission-daemon is running") > -1) : (status == "start"))});
	});
};

//Load historic stats & filter to find today's record
function GetTodaysUsage(callback){
	if (_dayStartUsage && (new Date(_dayStartUsage.date).setHours(0,0,0,0) === new Date(Date.now()).setHours(0,0,0,0))){
		callback(undefined, _dayStartUsage);
	} else {
		GetUsageHistory(function (err, data) {
			if(err || !data){ 
				callback( { msg: "GetTodaysUsage: No data found for today.", "error": err } );
			}else{		
				var filtered = data.filter(function (element, index, array) {  return (new Date(element.date).setHours(0,0,0,0) === new Date(Date.now()).setHours(0,0,0,0)); });
				if (filtered.length > 0){ 
					_dayStartUsage = filtered[0];
					callback(err,_dayStartUsage);
				}
				else{
					callback({ msg: "GetTodaysUsage: No data found for today.", "error": null });
					return;
				}
			}
		});
	}
}

function GetUsageHistory(callback){
	fs.readFile(_settings.usageHistoryPath, function (err, data) {
		var usage_history = (!data || data.length == 0) ? new Array() : JSON.parse(data);
		callback(undefined, usage_history);
	});
};

function GetCurrentUsage(callback){
	request(
		{uri: _settings.routerStatsUri, strictSSL: false},
		function(err, response, body){
			if (err){
				callback( { msg: "GetCurrentUsage: No response body.", "error": err } );
			} else {
				var current_usage = { "date": Date.now(), "stats": new Array() };
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
				_dayStartUsage = currentUsage;
				callback( {"message" : "usage data saved successfully."} );
			});
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