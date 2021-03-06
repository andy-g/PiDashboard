var	util = require("util"),
	http = require('http'),
	parseString = require('xml2js').parseString,
	EventEmitter = require("events").EventEmitter,
	twitterBot = require('./twitterBot'),
	exec = require('child_process').exec,
	domain = require('domain');

function RssListener (appSettings) {
	'use strict';

	EventEmitter.call(this);

	var retryJobId = null;
	var torrentList = [];

	var d = domain.create();
	d.on('error', function(er) {
		console.log(new Date().toJSON() + ' Caught rssListener error!');
		console.error(er.stack);
		
		//Clear an existing scheduled timeout (if present), and then reschedule
		clearTimeout(retryJobId);
		retryJobId = setTimeout(function(){ this.RssCheck(); }, appSettings.rss.interval);
	});

	this.RssCheck = d.bind(function(){
		var rssListener = this;
		http.get(appSettings.rss.rssPaths[0], function(res){
			if (res.statusCode != 200){
				console.log(new Date().toJSON() + " Error retrieving rss, http statusCode: " + res.statusCode);
				retryJobId = setTimeout(function(){ rssListener.RssCheck(); }, appSettings.rss.interval);
				return;
			}

			var pageData = "";
			res.setEncoding('utf8');
			res.on('data', function (chunk) { pageData += chunk; });
			res.on('end', function(){
				parseString(pageData, function (err, result) {
					if (err){ 
						console.log(new Date().toJSON() + " Error parsing rss");
						console.log(err);
					} else {
						var torrents = [];
						result.rss.channel[0].item.forEach(function(torrent){
							if (torrentList.indexOf(torrent.enclosure[0].$.url) > -1)
								console.log(new Date().toJSON() + " Ignoring old torrent: "+ torrent.title +"' ("+ (torrent['torrent:contentLength'] / 1024 / 1024).toFixed(2) +"MB)" );	
							else {
								torrentList.push(torrent.enclosure[0].$.url);
								torrents.push({ "title": torrent.title, "size": torrent['torrent:contentLength'], "id": torrentList.length -1 });
							}
						});
						if (torrents.length > 0)
							rssListener.emit('newTorrents', torrents); 
					}
					retryJobId = setTimeout(function(){ rssListener.RssCheck(); }, appSettings.rss.interval);
				});
			});
		});
	});

	this.AddDownloads = d.bind(function(ids, startDownload){
		//console.log(new Date().toJSON() + " Will queue or download torrent (from rssListener): " + torrentList[id]);
		var rssListener = this;
		exec("sudo service transmission-daemon status", function(error, stdout, stderr){
			var cmd = '';
			ids.forEach(function(id){
				cmd = cmd + " transmission-remote --auth "+ appSettings.rss.username +":"+ appSettings.rss.password +
					" --no-start-paused" + //Always add the torrent unpaused, queued torrents won't leave the service running though
					" -a '" + torrentList[id] + "'; ";
			});
			
			if (stdout.indexOf("is running") == -1)
				cmd = "sudo service transmission-daemon start; "+ cmd + (startDownload ? "" : "sudo service transmission-daemon stop");

			exec(cmd, function(error, stdout, stderr){
					console.error(error,stdout,stderr);
					if (error){
						rssListener.emit('torrentAdded', { "error": error, "status": false }); 
						return;
					}
					
					if (stdout.indexOf('duplicate torrent') > -1)
							error = "duplicate torrent";
					rssListener.emit('torrentAdded', { "error": error, "status": stdout.match(/responded: \"success\"/gi).length == (ids.length * 2), "ids": ids });
			});
		});
	});
}
util.inherits(RssListener, EventEmitter);

module.exports = RssListener;