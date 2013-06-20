var	express = require('express'),
	fs = require('fs'),
	usage = require('./routes/usage');
	//_settings = require('../app.config.json');

var app = express();
app.use(express.cookieParser());
app.use(express.session({ secret: 'foobar' }));
app.use(express.bodyParser());
app.use(express.static(__dirname + '/public'));

//-----routes-----
app.get('/', function(req, res){ res.send('hello world'); });

app.get('/save', usage.saveUsage);
app.get('/today', usage.todaysUsage);
app.get('/drives', usage.drives);
app.get('/services/:service?/:status?', usage.serviceStatus);

//-----start server-----
app.listen(3000);
console.log('Listening on 8080');