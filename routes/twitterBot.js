var 
	_settings = require('../app.config.json'),
	twitter = require('twitter'),
	events = require("events"),
	domain = require('domain');

var d = domain.create();
d.on('error', function(er) {
  console.error(new Date().toJSON() + ' Caught twitterBot error!', er);
  console.log(er.stack);
});

var twit = new twitter(_settings.twitter.keys);
var streamRetryJob = null;
var twitterBot = new events.EventEmitter();
twitterBot.SendDirectMessage = d.bind(function(message, recipient, callback){
	if (typeof recipient === 'function'){
		callback = recipient;
		recipient = null;
	}
	if (!recipient)
		recipient = _settings.twitter.defaultRecipient;
		
	twit.newDirectMessage(recipient, message, function(data) { 
		if (data instanceof Error) {
			console.log(data);
			console.log(data.stack);
		}

		if (callback)
			callback({ error: null, sent: true });
	});	
});

twitterBot.StartTwitterListener = d.bind(function(){
	twit.stream('user', function(stream) {
		console.log(new Date().toJSON() + " Listening for tweets...");
		stream.on('data', function(data) {
			twitterBot.emit("tweet",data);
	    });
		stream.on('error', function(data) {
			console.log(new Date().toJSON() + ' Twitter error, scheduling reconnect');
			console.log(data);
			stream.destroy();
			streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
		});
		stream.on('end', function(data) { 
			console.log(new Date().toJSON() + ' Twitter Stream Ended'); 
			console.log(data);
			stream.destroy();
			streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
		});
	});
});

module.exports = twitterBot;