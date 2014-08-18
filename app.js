var	express = require('express'),
	fs = require('fs'),
	request = require('request'),
	schedule = require('node-schedule'),
	routes = require('./routes'),
	appSettings = require('./app.config.json'),
	System = require('./routes/system');

//Prevent the application from crashing due to any unhandled exceptions
process.on('uncaughtException', function(err) {
	console.error(new Date().toJSON() + ' unhandled exception!', err);
	console.log(err.stack);
});

var app = express();
//app.use(express.cookieParser());
//app.use(express.session({ secret: 'foobar' }));
app.use(express.urlencoded());
app.use(express.json());
app.use(express.static(__dirname + '/public'));

var system = new System(appSettings);

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
system.log('Listening on 8080');

//-----start scheduled tasks
var rule = new schedule.RecurrenceRule();
rule.minute = 0;

var j = schedule.scheduleJob('network usage log',rule, function(){
	system.log("Retrieving hourly usage: ");
	system.saveCurrentNetworkUsage(function(message){
		system.log(message);
	});
});
system.log('Scheduled hourly job for logging usage');

//-----listen for direct messages
if (appSettings.twitter.enableTwitterBot){
	var TwitterBot = require('./routes/twitterBot');
	var twitterBot = new TwitterBot(appSettings);

	twitterBot.on('tweet',function(data){
		system.log('Tweet event received');
		if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot'){
			system.log('New tweet event handler: ' + data.direct_message.text);
			
			//--Retrieve Current public IP Address
			if (data.direct_message.text.match(/IP Address/gi) !== null){
				system.getIpAddress(function(err, ipAddress){
					if (err){
						twitterBot.SendDirectMessage('IP address could not be retrieved.');
					} else {
						twitterBot.SendDirectMessage('My IP Address is ' + ipAddress, data.direct_message.sender_screen_name);
					}
				});
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
		system.log("New torrent event");
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
			system.log("Torrent(s) successfuly queued" + (data.error ? " (" + data.error + ")" : ""));
			twitterBot.SendDirectMessage("Torrent(s) successfully queued" + (data.error ? " (" + data.error + ")" : ""));
		} else {
			system.log("Torrent(s) not successfuly added");
			system.log(data.error);
			twitterBot.SendDirectMessage("Torrent(s) not successfully added" + (data.error ? " (" + data.error + ")" : ""));
		}
	});
	rssListener.RssCheck();
}

//Send notifications that the PiDashboard is now up
system.getIpAddress(function(err, ipAddress){
	if (err){
		system.sendPushNotification('PiDashboard is up! IP address could not be retrieved.');
		if (appSettings.twitter.enableTwitterBot){
			twitterBot.SendDirectMessage('PiDashboard is up! IP address could not be retrieved.');
		}
	} else {
		system.sendPushNotification('PiDashboard is up! IP Address is ' + ipAddress);
		if (appSettings.twitter.enableTwitterBot){
			twitterBot.SendDirectMessage('PiDashboard is up! IP Address is ' + ipAddress);
		}
	}
});
