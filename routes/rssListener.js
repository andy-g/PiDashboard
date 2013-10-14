var	http = require('http'),
	parseString = require('xml2js').parseString,
	_settings = require('../app.config.json'),
	events = require("events"),
	twitterBot = require('./twitterBot'),
	exec = require('child_process').exec,
	domain = require('domain');

var d = domain.create();
d.on('error', function(er) {
  console.error(new Date().toJSON() + ' Caught rssListener error!', er);
  console.log(er.stack);
});

var retryJob = null;
var torrentList = [];
var rssListener = new events.EventEmitter(); 
rssListener.RssCheck = d.bind(function(retryCount){
	http.get(_settings.rss.rssPaths[0], function(res){
		var pageData = "";
		res.setEncoding('utf8');
  		res.on('data', function (chunk) { pageData += chunk; });
		res.on('end', function(){
			parseString(pageData, function (err, result) {
 				if (err){ //schedule re-run in 5 seconds, maximum of 3 retries
			 		if (retryCount >= 3){
			 			console.log(new Date().toJSON() + " Error retrieving rss, retrying count exceeded");
			 			console.log(err);
						retryJob = setTimeout(function(){ rssListener.RssCheck(); }, 1000 * 60 * 60);
			 			return;
			 		}
			 		console.log(new Date().toJSON() + " Error retrieving rss, retrying in 5 seconds:");
			 		retryJob = setTimeout(function(){ rssListener.RssCheck((!retryCount ? 0 : retryCount) + 1); }, 1000 * 5);
			 		return;
			 	} else {
			 		result.rss.channel[0].item.forEach(function(torrent){
			 			if (torrentList.indexOf(torrent.enclosure[0].$.url) > -1)
			 				console.log(new Date().toJSON() + " Ignoring old torrent: "+ torrent.title +"' ("+ (torrent['torrent:contentLength'] / 1024 / 1024).toFixed(2) +"MB)" );	
			 			else {
			 				torrentList.push(torrent.enclosure[0].$.url);
			 				rssListener.emit('newTorrent', { "title": torrent.title, "size": torrent['torrent:contentLength'], "id": torrentList.length -1 });
			 			}
			 		}) 
			 	}
				retryJob = setTimeout(function(){ rssListener.RssCheck(); }, 1000 * 60 * 60); //schedule re-run in 1 hours
			});

  		});
	});
	});

rssListener.AddDownload = d.bind(function(id, startDownload){//, callback){
	console.log(new Date().toJSON() + " Will queue or download torrent (from rssListener): " + torrentList[id]);

		exec("sudo service transmission-daemon status", function(error, stdout, stderr){
			var cmd = "transmission-remote --auth "+ _settings.rss.username +":"+ _settings.rss.password +
				//(startDownload ? " --no-start-paused" : " --start-paused") +
				" --no-start-paused" + //Always add the torrent unpaused, queued torrents won't leave the service running though
				" -a '" + torrentList[id] + "'";

			if (stdout.indexOf("is running") == -1)
				cmd = "sudo service transmission-daemon start; "+ cmd + (startDownload ? "" : "; sudo service transmission-daemon stop");

			exec(cmd, function(error, stdout, stderr){
						if (stdout.indexOf('duplicate torrent') > -1)
							error = "duplicate torrent";
					rssListener.emit('torrentAdded', { "error": error, "status": stdout.indexOf('responded: "success"') > -1, "id": id });
			});
		});
	});

module.exports = rssListener;