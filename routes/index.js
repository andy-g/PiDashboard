var ContentHandler = require('./usage'),
    jwt = require('jsonwebtoken');

module.exports = exports = function(app, appSettings) {
    var contentHandler = new ContentHandler(appSettings);

    // route middleware to check for a token and decode
    app.use(function(req, res, next) {
        var token = req.cookies.access_token || req.body.token || req.query.token || req.headers['x-access-token'];
        if (token) {
            req.token = token;
            // verifies secret and checks exp
            jwt.verify(token, app.get('jwtSecret'), function(err, decoded) {
                if ( ! err) {
                    req.user = decoded;
                }
                next();
            });
        } else {
            next();
        }
    });

    app.get('/', function(req, res) {
        if ( ! req.user)
            res.redirect(302, '/login.html');
        else
            res.redirect(302, '/PiDashboard.html');
    });

    app.post('/login', function(req, res) {
        var user = {
            name: 'andyg',
            password: 'roam.home',
            admin: true
        };

        if (req.body.name != user.name || req.body.password != user.password) {
            res.redirect(302, '/login.html');
        } else {
            delete user.password;
            var token = jwt.sign(user, app.get('jwtSecret'), {
                expiresIn: "30 days"
            });
            res.cookie('access_token', token, { httpOnly: true, maxAge: 2592000000 });
            res.redirect(302, '/PiDashboard.html');
        }
    });

    // route middleware to verify user (based on token verified above)
    app.use(function(req, res, next) {
        if ( ! req.token) {
            return res.status(403).send({ success: false, message: 'No token provided.' });
        } else if ( ! req.user) {
            return res.status(403).send({ success: false, message: 'Failed to authenticate token.' });
        } else {
            next();
        }
    });

    app.get('/summary/:runDate?', contentHandler.usageSummary);
    app.get('/graph_data/:runDate?', contentHandler.graphData);
    app.get('/drives', contentHandler.drives);
    app.get('/services/:service?/:status?', contentHandler.getServices);
    app.put('/services/:service?/:status?', contentHandler.serviceStatus);
    app.get('/devices/:device?/:status?', contentHandler.deviceStatus);
    app.put('/devices/:device?/:status?', contentHandler.deviceStatus);
};
