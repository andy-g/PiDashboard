var	express = require('express'),
	fs = require('fs'),
	request = require('request'),
	schedule = require('node-schedule'),
	routes = require('./routes'),
	appSettings = require('./app.config.json');

//Prevent the application from crashing due to any unhandled exceptions
process.on('uncaughtException', function(err) {
	console.error(new Date().toJSON() + ' unhandled exception!', err);
	console.log(err.stack);
});

var app = express();
//app.use(express.cookieParser());
//app.use(express.session({ secret: 'foobar' }));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

//-----routes-----
routes(app, appSettings);

//-----start server (comment out app.listen and uncomment previous lines to use https)-----
//https = require('https');
//var options = {
//	key: fs.readFileSync('keys/server-key.pem'),
//	cert: fs.readFileSync('keys/server-cert.pem')
//};
//https.createServer(options, app).listen(8080);//(443);
app.listen(8080);
console.log('Listening on 8080');

//-----start scheduled tasks
var rule = new schedule.RecurrenceRule();
rule.hour = appSettings.timePeriods.map(function(element){ 
	return element.endHour % 24; 
});
rule.minute = 0;

var j = schedule.scheduleJob('network usage log',rule, function(){
	console.log(new Date().toJSON() + " Scheduled Job Starting: ");
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
if (appSettings.twitter.enableTwitterBot){
	var TwitterBot = require('./routes/twitterBot');
	var twitterBot = new TwitterBot(appSettings);

	twitterBot.on('tweet',function(data){
		console.log('Tweet event received');
		if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot'){
			console.log(new Date().toJSON() + ' new tweet event handler: ' + data.direct_message.text);
			
			//--Retrieve Current public IP Address
			if (data.direct_message.text.match(/IP Address/gi) !== null){
				request(
					{ uri: 'http://checkip.dyndns.com/' },
					function(err, response, body){
						if (err){ console.log(err);	} else {
							twitterBot.SendDirectMessage('My IP Address is ' + body.match(/[0-9]+(?:\.[0-9]+){3}/)[0], data.direct_message.sender_screen_name);
						}
					}
				);
			} 

			//--Queue or Dowload Torrent(s)
			else if (appSettings.rss.enableRssListener && /DL #|QUEUE #/i.test(data.direct_message.text)) {
				rssListener.AddDownloads(data.direct_message.text.match(/#[0-9]+/gi).map(function(num){ return num.replace(/#/,''); }), /DL #/i.test(data.direct_message.text));
			}
		}
	});
	twitterBot.StartTwitterListener();
}

//-----listen for rss
var rssListener;
if (appSettings.rss.enableRssListener){
	RssListener = require('./routes/rssListener');
	var rssListener = new RssListener(appSettings);

	rssListener.on('newTorrents',function(data){
		console.log(new Date().toJSON() + " New torrent event");
		if (appSettings.twitter.enableTwitterBot){
			twitterBot.SendDirectMessage("Adding" +
				data.reduce(function(prev, curr){ 
					return prev + " " + curr.title + " (" + (curr.size / 1024 / 1024).toFixed(2) + "MB),";
				}, "").slice(0,-1)
			);
		}
		rssListener.AddDownloads(
			data.map(function(element){ return element.id; }), 
			(!!appSettings.services.transmission.jobs && appSettings.services.transmission.jobs[1].nextInvocation() < appSettings.services.transmission.jobs[0].nextInvocation()) ? true : false
		);
	});
	rssListener.on('torrentAdded',function(data){
		if (data.status){
			console.log(new Date().toJSON() + " Torrent(s) successfuly queued" + (data.error ? " (" + data.error + ")" : ""));
			twitterBot.SendDirectMessage("Torrent(s) successfully queued" + (data.error ? " (" + data.error + ")" : ""));
		} else {
			console.log(new Date().toJSON() + " Torrent(s) not successfuly added");
			console.log(data.error);
			twitterBot.SendDirectMessage("Torrent(s) not successfully added" + (data.error ? " (" + data.error + ")" : ""));
		}
	});
	rssListener.RssCheck();
}