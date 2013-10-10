var	express = require('express'),
	fs = require('fs'),
	usage = require('./routes/usage'),
	https = require('https'),
	_settings = require('./app.config.json'),
	schedule = require('node-schedule');

//Prevent the application from crashing due to any unhandled exceptions
process.on('uncaughtException', function(err) {
    console.log('Unhandled exception:');
    console.log(err);
});

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
	twitterBot.on('tweet',function(data){
		if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot'){
			console.log('new tweet event handler' + data.direct_message.text);
			
			if (_settings.rss.enableRssListener && /DL #|QUEUE #/i.test(data.direct_message.text)) {
				//should probably rather allow for sending an array of id's to the queue function and can queue them together and report on that
				data.direct_message.text.match(/#[0-9]+/gi).map(function(num){return num.replace(/#/,'')}).forEach(function(id){
					console.log("Will queue or download torrent (from app): " + id);
					rssListener.Queue(id, function(error, status, id){
						if (status){
							console.log("Torrent successfuly added event:" + data.title);
							twitterBot.SendDirectMessage("Torrent #"+ id + " has been successfully queued");
						} else {
							console.log("Torrent not successfuly added event:" + data.title);
							twitterBot.SendDirectMessage("Torrent #"+ id + " couold not besuccessfully queued (" + error + ")");
						}
					});
				})
			}
		}
	})
	twitterBot.StartTwitterListener();
}

//-----listen for rss
var rssListener;
if (_settings.rss.enableRssListener){
	rssListener = require('./rssListener');
	rssListener.on('newTorrent',function(data){
		console.log("New torrent event:" + data.title);
		twitterBot.SendDirectMessage("Would you like to 'QUEUE' or 'DL' '"+ data.title +"' ("+ (data.size / 1024 / 1024).toFixed(2) +"MB) #" + data.id);
	})
	rssListener.RssCheck();
}

//heapdump.writeSnapshot();