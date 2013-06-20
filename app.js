var	express = require('express'),
	urlparser = require('url'),
	request = require('request'),
	fs = require('fs'),
	exec = require('child_process').exec;
	
var app = express();
app.use(express.cookieParser());
app.use(express.session({ secret: 'foobar' }));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

//-----settings-----
//on load - sync file read
var settings = JSON.parse(fs.readFileSync('app.config.json'));
console.log('settings loaded.');

//------------------	

var todaysUsage;
	
app.get('/', function(req, res){
	res.send('hello world');
});

app.get('/today', function(req, res){
	res.header("Access-Control-Allow-Origin", "*");
	//debugger;
	GetTodaysUsage(function(err,data){
		if (data){
			res.send(JSON.stringify(data));
		}else{
			console.log("today error: " + JSON.stringify(err));
			res.send({"err" : "Usage data not found for today."}); 
		}
	});
});

app.get('/save', function(req, res){
	res.header("Access-Control-Allow-Origin", "*");
	GetTodaysUsage(function (err, today_usage) {
		if (today_usage) 
			res.send({"err" : "Usage data already exists for today"}); 
		else{	
			GetCurrentUsage(function(err, current_usage){
				if (err) { 
					console.log("save error: " + JSON.stringify(err));
					res.send({ err: "Error saving usage data." });
				} else {
					SaveUsageHistory(current_usage, function(message){
						res.send(message);
					});
				}
			});
		}
	});
});

app.get('/request', function(req, res){
	res.header("Access-Control-Allow-Origin", "*");
	GetCurrentUsage(function (err, current_usage) {
		GetTodaysUsage(function(err,today_usage){
			//Iterate through current usage stats
			if (!current_usage){
				res.send({"err" : "Usage data could not be retrieved."});
				return;
			}
			current_usage.stats.forEach(function(value, index) {
				//Determine Today's usage for this device
				var today_device_usage = "-";
				if (today_usage){
					var filtered_device = today_usage.stats.filter(function (element, index, array) {  return (element.ip_add === value.ip_add); });
					if (filtered_device.length > 0)
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
			res.send(JSON.stringify(current_usage));	
		});
	});
});

app.get('/drives', function(req, res){
	res.header("Access-Control-Allow-Origin", "*");
	exec("df -h", function(error, stdout, stderr){
		if (error !== null) {
				console.log('exec error: ' + error);
				res.send({"err" : "Disk usage could not be retrieved."});
	    	}
   			GetDriveUsage(stdout, function(err, drive_usage){
    			res.send(drive_usage);
	    	})
	});
});

app.get('/serviceStatus', function(req, res){
	res.header("Access-Control-Allow-Origin", "*");
	var status = !req.query.status || !(/start|stop/g).test(req.query.status) ? "status" : req.query.status;
	exec("sudo /etc/init.d/transmission-daemon " + status, function(error, stdout, stderr){
		if (status != "status" && error !== null) {
			console.log('exec error: ' + error + ' stdout: ' + stdout + ' stderr: ' + stderr);
			res.send({"err" : "Service status could not be " + (status == "start" ? "started" : "stopped") +"."});
			return;
	    }
	    //If we're setting the status, just return what we've set it to (return can come back before service status is changed), otherwise verify output to determine service status
	    res.send({service: "transmission", status: (status == "status" ? (stdout.indexOf("transmission-daemon is running") > -1) : (status == "start"))});
	});
});

function formatBytes(bytes, precision)
{
    var units = ['b', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    var pwr = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pwr = Math.min(pwr, units.length - 1);
    bytes /= Math.pow(1024, pwr);
	return bytes.toFixed(precision) + ' ' + units[pwr];
}

//Load historic stats & filter to find today's record
function GetTodaysUsage(callback){
	if (todaysUsage && (new Date(todaysUsage.date).setHours(0,0,0,0) === new Date(Date.now()).setHours(0,0,0,0))){
		callback(undefined, todaysUsage);
	} else {
		GetUsageHistory(function (err, data) {
			if(err || !data){ 
				callback( { msg: "GetTodaysUsage: No data found for today.", "error": err } );
			}else{		
				var filtered = data.filter(function (element, index, array) {  return (new Date(element.date).setHours(0,0,0,0) === new Date(Date.now()).setHours(0,0,0,0)); });
				if (filtered.length > 0){ 
					todaysUsage = filtered[0];
					callback(err,todaysUsage);
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
	fs.readFile(settings.usageHistoryPath, function (err, data) {
		var usage_history = (!data || data.length == 0) ? new Array() : JSON.parse(data);
		callback(undefined, usage_history);
	});
};

function GetCurrentUsage(callback){
	request(
		{uri: settings.routerStatsUri},
		function(err, response, body){
			if (err){
				callback( { msg: "GetCurrentUsage: No response body.", "error": err } );
			} else {
				var current_usage = { "date": Date.now(), "uptime": "-", "stats": new Array() };
				//Iterate through current usage stats for each device
				var ip_row_collection = body.match(/"(?:[0-9]{1,3}\.){3}[0-9]{1,3}.*(?=,)/gi);
				for (i = 0; i < ip_row_collection.length; i++){
					var row_array = ip_row_collection[i].replace(/(\s|")/g,'').split(',');
					current_usage.stats[i] = {"ip_add" : row_array[0], "mac_add" : row_array[1], "device_name" : (settings.namedDevices[row_array[0]] || "unknown"), "total_bytes" : row_array[3] };
				}
				callback(err, current_usage);
			}
        }
	);
};

function SaveUsageHistory(currentUsage, callback){
	GetUsageHistory(function (err, data) {
		if (data){
			fs.writeFile(settings.usageHistoryPath, JSON.stringify(data.concat(currentUsage), null, "\t"), function(err) {
				callback( {"message" : "usage data saved successfully."} );
			});
		}
		else 
			callback( { msg: "SaveUsageHistory: No data found.", "error": err } );
	});
}

function GetDriveUsage(stdout, callback) {
	var drive_usage = { "date": Date.now(), "drives": new Array() };
	var drives = stdout.match(/\/dev.*/gi);
	drives.forEach(function(drive){
		var row_array = drive.split(/\s+/g);
		drive_usage.drives.push({"mount" : row_array[5], "size" : row_array[1], "avail" : row_array[3], "used" : row_array[4]});
	});
	callback(undefined, drive_usage);
}

app.listen(8080);
console.log('Listening on 8080');