var 
	_settings = require('../app.config.json'),
	twitter = require('twitter'),
	moment = require('moment'),
	events = require("events");

var twit = new twitter(_settings.twitter.keys);

var streamRetryJob = null;

var twitterBot = new events.EventEmitter();

twitterBot.SendDirectMessage = function(message, recipient, callback){
	if (typeof recipient === 'function'){
		callback = recipient;
		recipient = null;
	}
	if (!recipient)
		recipient = _settings.twitter.defaultRecipient;
	
	twit.newDirectMessage(recipient, message, function(data) { 
		if (callback)
			callback({ error: null, sent: true });
	});	

}

twitterBot.StartTwitterListener = function(){
	twit.stream('user', function(stream) {
		console.log(moment().format('DD/MM/YYYY HH:mm:ss') + " Listening for tweets...");
	    stream.on('data', function(data) {
	    	twitterBot.emit("tweet",data);
	    });
	    stream.on('error', function(data) {
	    	stream.destroy();
	    	console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ' Twitter error, scheduling reconnect');
	    	console.log(data);
	    	streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
	    });
	    stream.on('end', function(data) { 
	    	stream.destroy();
	    	console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ' Twitter Stream Ended'); 
	    	console.log(data);
	    	streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
	    });
	});
}

module.exports = twitterBot;