var express = require('express'),
    bodyParser = require('body-parser'),
    compression = require('compression'),
    cookieParser = require('cookie-parser'),
    fs = require('fs'),
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

app.set('jwtSecret', appSettings.jwtSecret);

app.use(compression());
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.static(__dirname + '/public'));

var system = new System(appSettings);

//-----routes-----
routes(app, appSettings);

//-----start server (comment out app.listen and uncomment previous lines to use https)-----
https = require('https');
var options = {
	key: fs.readFileSync(appSettings.cert.key),
	cert: fs.readFileSync(appSettings.cert.cert)
};
https.createServer(options, app).listen(443);
//app.listen(8080);
system.log('Listening on 443');

//-----start scheduled tasks
var rule = new schedule.RecurrenceRule();
rule.minute = 0;

var j = schedule.scheduleJob('network usage log', rule, function() {
    // If were catching up jobs (due to a datetime change), skip previous jobs & only run the last job
    if (j.nextInvocation() < new Date()) {
        system.log('skipping job');
        return;
    }

    system.log("Retrieving hourly usage: ");
    system.saveCurrentNetworkUsage(function(message) {
        system.log(message);
    });
});
system.log('Scheduled hourly job for logging usage');

//-----listen for direct messages
if (appSettings.twitter.enableTwitterBot) {
    var TwitterBot = require('./routes/twitterBot');
    var twitterBot = new TwitterBot(appSettings);

    twitterBot.on('tweet', function(data) {
        system.log('Tweet event received');
        if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot') {
            system.log('New tweet event handler: ' + data.direct_message.text);

            //--Retrieve Current public IP Address
            if (data.direct_message.text.match(/IP Address/gi) !== null) {
                system.getIpAddress(function(err, ipAddress) {
                    if (err) {
                        twitterBot.SendDirectMessage('IP address could not be retrieved.');
                    } else {
                        twitterBot.SendDirectMessage('My IP Address is ' + ipAddress, data.direct_message.sender_screen_name);
                    }
                });
            }
        }
    });
    twitterBot.StartTwitterListener();
}

//Send notifications that the PiDashboard is now up
system.getIpAddress(function(err, ipAddress) {
    if (err) {
        system.sendPushNotification('PiDashboard is up! IP address could not be retrieved.');
        if (appSettings.twitter.enableTwitterBot) {
            twitterBot.SendDirectMessage('PiDashboard is up! IP address could not be retrieved.');
        }
    } else {
        system.sendPushNotification('PiDashboard is up! IP Address is ' + ipAddress);
        if (appSettings.twitter.enableTwitterBot) {
            twitterBot.SendDirectMessage('PiDashboard is up! IP Address is ' + ipAddress);
        }
    }
});
