var //SessionHandler = require('./session')
  //, 
  ContentHandler = require('./usage');
  //, ErrorHandler = require('./error').errorHandler;

module.exports = exports = function(app, appSettings) {

    //var sessionHandler = new SessionHandler(db);
    var contentHandler = new ContentHandler(appSettings);

    // Middleware to see if a user is logged in
    //app.use(sessionHandler.isLoggedInMiddleware);

	app.get('/', function(req, res){ res.send('hello world'); });
	app.get('/summary/:runDate?', contentHandler.usageSummary);
	app.get('/drives', contentHandler.drives);
	app.get('/services/:service?/:status?', contentHandler.serviceStatus);
	app.put('/services/:service?/:status?', contentHandler.serviceStatus);
};