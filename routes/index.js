var ContentHandler = require('./usage'),
    jwt = require('jsonwebtoken');

module.exports = exports = function(app, appSettings) {
    var contentHandler = new ContentHandler(appSettings);

    app.get('/', function(req, res) { res.send('hello world'); });

    app.post('/login', function(req, res) {
        var user = {
            name: 'andyg',
            password: 'roam.home',
            admin: true
        };

        if (req.body.name != user.name || req.body.password != user.password) {
            res.json({ success: false, message: 'Authentication failed. Wrong password.' });
        } else {
            delete user.password;
            var token = jwt.sign(user, app.get('jwtSecret'), {
                expiresIn: "30 days"
            });
            res.cookie('access_token', token, { httpOnly: true });
            res.json({
                success: true,
                token: token
            });
        }
    });

    // route middleware to verify a token
    app.use(function(req, res, next) {
        var token = req.cookies.access_token || req.body.token || req.query.token || req.headers['x-access-token'];
        if (token) {
            // verifies secret and checks exp
            jwt.verify(token, app.get('jwtSecret'), function(err, decoded) {
                if (err) {
                    return res.json({ success: false, message: 'Failed to authenticate token.' });
                } else {
                    req.decoded = decoded;
                    next();
                }
            });
        } else {
            return res.status(403).send({
                success: false,
                message: 'No token provided.'
            });
        }
    });

    app.get('/summary/:runDate?', contentHandler.usageSummary);
    app.get('/graph_data/:runDate?', contentHandler.graphData);
    app.get('/drives', contentHandler.drives);
    app.get('/services/:service?/:status?', contentHandler.serviceStatus);
    app.put('/services/:service?/:status?', contentHandler.serviceStatus);
    app.get('/devices/:device?/:status?', contentHandler.deviceStatus);
    app.put('/devices/:device?/:status?', contentHandler.deviceStatus);
};
