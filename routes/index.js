var ContentHandler = require('./usage');

module.exports = exports = function(app, appSettings) {
	var contentHandler = new ContentHandler(appSettings);

	// Middleware to see if a user is logged in
	//app.use(sessionHandler.isLoggedInMiddleware);

	app.get('/', function(req, res){ res.send('hello world'); });
	app.get('/summary/:runDate?', contentHandler.usageSummary);
	app.get('/graph_data/:runDate?', contentHandler.graphData);
	app.get('/drives', contentHandler.drives);
	app.get('/services/:service?/:status?', contentHandler.serviceStatus);
	app.put('/services/:service?/:status?', contentHandler.serviceStatus);
	app.get('/devices/:device?/:status?', contentHandler.deviceStatus);
	app.put('/devices/:device?/:status?', contentHandler.deviceStatus);

	// Error handling middleware
	//app.use(ErrorHandler);
};
