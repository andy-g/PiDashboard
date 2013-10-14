var	express = require('express'),
	fs = require('fs'),
	usage = require('./routes/usage'),
	https = require('https'),
	request = require('request'),
	_settings = require('./app.config.json'),
	schedule = require('node-schedule');

//Prevent the application from crashing due to any unhandled exceptions
process.on('uncaughtException', function(err) {
	console.error(new Date().toJSON() + ' unhandled exception!', err);
	console.log(err.stack);
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
    console.log(new Date().toJSON() + " Scheduled Job Starting: ")
	usage.GetCurrentUsage(function(err, current_usage){
		if (err) { 
			console.log(new Date().toJSON() + " save error: " + JSON.stringify(err));
		} else {
			usage.SaveUsageHistory(current_usage, function(message){
				console.log(message);
			});
		}
	});
});
console.log(new Date().toJSON() + ' Scheduled job started for time periods (hours of day): ' + rule.hour);

//-----listen for direct messages
if (_settings.twitter.enableTwitterBot){
	var twitterBot = require('./routes/twitterBot');
	twitterBot.on('tweet',function(data){
		if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot'){
			console.log(new Date().toJSON() + ' new tweet event handler: ' + data.direct_message.text);
			
			//--Retrieve Current public IP Address
			if (data.direct_message.text.match(/IP Address/gi) !== null){
				request(
					{ uri: 'http://checkip.dyndns.com/' },
					function(err, response, body){
						if (err){ console.log(err);	} else {
				   			twit.newDirectMessage(data.direct_message.sender_screen_name, 'My IP Address as at '+ moment().format('HH:mm:ss') +' is ' + body.match(/[0-9]+(?:\.[0-9]+){3}/)[0]);
						}
				    }
				);
			} 

			//--Queue or Dowload Torrent(s)
			else if (_settings.rss.enableRssListener && /DL #|QUEUE #/i.test(data.direct_message.text)) {
				data.direct_message.text.match(/#[0-9]+/gi).map(function(num){return num.replace(/#/,'')}).forEach(function(id){
					rssListener.AddDownload(id, /DL #/i.test(data.direct_message.text));
				})
			}
		}
	})
	twitterBot.StartTwitterListener();
}

//-----listen for rss
var rssListener;
if (_settings.rss.enableRssListener){
	rssListener = require('./routes/rssListener');
	rssListener.on('newTorrent',function(data){
		console.log(new Date().toJSON() + " New torrent event:" + data.title);
		twitterBot.SendDirectMessage("Would you like to 'QUEUE' or 'DL' '"+ data.title +"' ("+ (data.size / 1024 / 1024).toFixed(2) +"MB) #" + data.id);
	});
	rssListener.on('torrentAdded',function(data){
		if (data.status){
			console.log(new Date().toJSON() + " Torrent #"+ data.id +" successfuly added");
			twitterBot.SendDirectMessage("Torrent #"+ data.id + " has been successfully added");
		} else {
			console.log(new Date().toJSON() + " Torrent #"+ data.id +" not successfuly added:");
			console.log(error);
			twitterBot.SendDirectMessage("Torrent #"+ data.id +" could not be successfully added (" + data.error + ")");
		}
	});
	rssListener.RssCheck();
}