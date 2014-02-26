var util = require("util"),
	twitter = require('twitter'),
	EventEmitter = require("events").EventEmitter,
	domain = require('domain');

function TwitterBot(appSettings) {
	'use strict';

	EventEmitter.call(this);

	var twit = new twitter(appSettings.twitter.keys);
	var retryJobId = null;

	var d = domain.create();
	d.on('error', function(er) {
		console.error(new Date().toJSON() + ' Caught twitterBot error!', er);
		console.log(er.stack);
		//this.emit('error', er);

		//Clear an existing scheduled timeout (if present), and then reschedule
		clearTimeout(retryJobId);
		retryJobId = setTimeout(function(){ this.StartTwitterListener(); }, 1000 * 30);
	});

	this.SendDirectMessage = d.bind(function(message, recipient, callback){
		if (typeof recipient === 'function'){
			callback = recipient;
			recipient = null;
		}
		if (!recipient)
			recipient = appSettings.twitter.defaultRecipient;
			
		message = message.substr(0,140);
		twit.newDirectMessage(recipient, message, function(data) { 
			var err;
			if (data instanceof Error) {
				err = data;
				console.log(data);
				console.log(message);
				console.log(data.stack);
			}

			if (callback)
				callback({ error: err, message: message, recipient: recipient });
		});	
	});

	this.StartTwitterListener = d.bind(function(){
		var twitterBot = this;
		twit.stream('user', function(stream) {
			console.log(new Date().toJSON() + " Listening for tweets...");
			stream.on('data', function (data) {
				//console.log('Tweet Received:');
				twitterBot.emit("tweet",data);
			});
			stream.on('error', function(error) {
				console.log(new Date().toJSON() + ' Twitter error, scheduling reconnect');
				console.log(error.stack);
				stream.destroy();
			});
			stream.on('close', function(data) { 
				console.log(new Date().toJSON() + ' Twitter Stream Closed on twitter end'); 
				//console.log(data);
				stream.destroy();
			});
			stream.on('end', function(data) { 
				console.log(new Date().toJSON() + ' Twitter Stream Ended'); 
				stream.destroy();
			});
			stream.on('destroy', function(data) { 
				console.log(new Date().toJSON() + ' Twitter Stream Destroyed'); 
				retryJobId = setTimeout(function(){ twitterBot.StartTwitterListener(); }, 1000 * 30);
			});
		});
	});	
}
util.inherits(TwitterBot, EventEmitter);

module.exports = TwitterBot;