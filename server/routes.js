var express = require('express'),
    config  = require('./config'),
    auth  = require('./services/auth'),
    system  = require('./services/system');

var app = module.exports = express.Router();

ContentHandler = require('../routes/usage');
var contentHandler = new ContentHandler(config);

app.post('/login', auth.login)

app.use(auth.decodeToken)      // check for a token and decode
app.use(auth.authenticateUser) // Verify user

app.get('/summary/:runDate?', contentHandler.usageSummary);
app.get('/graph_data/:runDate?', contentHandler.graphData);
app.get('/drives', contentHandler.drives);
app.get('/services/:service?', system.getServiceStatus);
app.put('/services/:service', system.setServiceStatus);
app.get('/devices/:device?', contentHandler.deviceStatus);
app.put('/devices/:device?', contentHandler.deviceStatus);