var //util = require("util"),
	twitter = require('twitter'),
	//EventEmitter = require("events").EventEmitter,
	events = require("events"),
	domain = require('domain');

var d = domain.create();
d.on('error', function(er) {
	console.error(new Date().toJSON() + ' Caught twitterBot error!', er);
	console.log(er.stack);
	twitterBot.emit('error', er);
});



var twit = new twitter(global.settings.twitter.keys);
var streamRetryJob = null;
var twitterBot = new events.EventEmitter();
//function twitterBot () {
//	EventEmitter.call(this);
//}
//util.inherits(twitterBot, EventEmitter);

//twitterBot.prototype.SendDirectMessage = d.bind(function(message, recipient, callback){
twitterBot.SendDirectMessage = d.bind(function(message, recipient, callback){
	if (typeof recipient === 'function'){
		callback = recipient;
		recipient = null;
	}
	if (!recipient)
		recipient = global.settings.twitter.defaultRecipient;
		
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

//twitterBot.prototype.StartTwitterListener = d.bind(function(){
twitterBot.StartTwitterListener = d.bind(function(){
	//var instance = this;
	twit.stream('user', function(stream) {
		console.log(new Date().toJSON() + " Listening for tweets...");
		stream.on('data', function(data) {
			twitterBot.emit("tweet",data);
		});
		stream.on('error', function(data) {
			console.log(new Date().toJSON() + ' Twitter error, scheduling reconnect');
			console.log(data);
			stream.destroy();
			//streamRetryJob = setTimeout(function(){ twitterBot.StartTwitterListener(); }, 1000 * 30);
		});
		stream.on('close', function(data) { 
			console.log(new Date().toJSON() + ' Twitter Stream Closed on twitter end'); 
			console.log(data);
			stream.destroy();
			//streamRetryJob = setTimeout(function(){ twitterBot.StartTwitterListener(); }, 1000 * 30);
		});
		stream.on('end', function(data) { 
			console.log(new Date().toJSON() + ' Twitter Stream Ended'); 
			stream.destroy();
			//streamRetryJob = setTimeout(function(){ twitterBot.StartTwitterListener(); }, 1000 * 30);
		});
		stream.on('destroy', function(data) { 
			console.log(new Date().toJSON() + ' Twitter Stream Destroyed'); 
			streamRetryJob = setTimeout(function(){ twitterBot.StartTwitterListener(); }, 1000 * 30);
		});
	});
});

module.exports = twitterBot;