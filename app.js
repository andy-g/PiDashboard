var	express = require('express'),
	fs = require('fs'),
	usage = require('./routes/usage'),
	https = require('https'),
	_settings = require('./app.config.json'),
	schedule = require('node-schedule');

var options = {
  key: fs.readFileSync('keys/server-key.pem'),
  cert: fs.readFileSync('keys/server-cert.pem')
};

var app = express();
app.use(express.cookieParser());
app.use(express.session({ secret: 'foobar' }));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

//-----routes-----
app.get('/', function(req, res){ res.send('hello world'); });
app.get('/summary/:runDate?', usage.usageSummary);
app.get('/drives', usage.drives);
app.get('/services/:service?/:status?', usage.serviceStatus);
app.put('/services/:service?/:status?', usage.serviceStatus);

//-----start server (comment out https and use app.listen line if you don't have https keys in the keys folder)-----
//app.listen(8080);
https.createServer(options, app).listen(8080);//(443);
console.log('Listening on 8080');

//-----start scheduled tasks
var rule = new schedule.RecurrenceRule();
rule.hour = _settings.timePeriods.map(function(element){ 
	return element.endHour % 24; 
});
rule.minute = 0;

var j = schedule.scheduleJob('network usage log',rule, function(){
    console.log("Scheduled Job Starting: " + new Date())
	usage.GetCurrentUsage(function(err, current_usage){
		if (err) { 
			console.log("save error: " + JSON.stringify(err));
		} else {
			usage.SaveUsageHistory(current_usage, function(message){
				console.log(message);
			});
		}
	});
});
console.log('Scheduled job started for time periods (hours of day): ' + rule.hour);

//-----listen for direct messages
if (_settings.twitter.enableTwitterBot){
	var twitterBot = require('./routes/twitterBot');
	twitterBot.StartTwitterListener();
}