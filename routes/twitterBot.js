var 
	_settings = require('../app.config.json'),
	twitter = require('twitter'),
	request = require('request'),
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
	    	if (data.direct_message && data.direct_message.sender_screen_name != 'PiTweetBot'){
	    		if (data.direct_message.text.match(/IP Address/gi) !== null){
					request(
						{ uri: 'http://checkip.dyndns.com/' },
						function(err, response, body){
							if (err){ console.log(err);	} 
							else {
								var ipAdd = body.match(/[0-9]+(?:\.[0-9]+){3}/)[0];
					   			twit.newDirectMessage(data.direct_message.sender_screen_name, 'My IP Address as at '+ moment().format('HH:mm:ss') +' is ' + ipAdd, function(data) { console.log(data.text); });
							}
					    }
					);
	    		}
	    	}
	    });
	    stream.on('error', function(data) {
	    	stream.destroy();
	    	console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ' Twitter error, scheduling reconnect');
	    	streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
	    });
	    stream.on('end', function(data) { 
	    	stream.destroy();
	    	console.log(moment().format('DD/MM/YYYY HH:mm:ss') + ' Twitter Stream Ended'); 
	    	streamRetryJob = setTimeout(function(){ StartTwitterListener(); }, 1000 * 30);
	    });
	});
}

module.exports = twitterBot;