var config  = require('../config'),
    jwt     = require('jsonwebtoken');

exports = module.exports = {
    login:  function(req, res) {
        var user = {
            name: 'andyg',
            password: 'roam.home',
            admin: true
        };

        if (req.body.name != user.name || req.body.password != user.password) {
            return res.status(401).send({ success: false, message: 'Invalid username or password' });
        } else {
            delete user.password;
            var token = jwt.sign(user, config.jwtSecret, {
                expiresIn: "30 days"
            });
            // res.cookie('access_token', token, { httpOnly: true, maxAge: 2592000000 });
            return res.status(201).send({ id_token: token });
        }
    },

    decodeToken: function(req, res, next) {
        var token = (req.cookies && req.cookies.access_token) || req.body.token || req.query.token || req.headers['x-access-token'];
        if (token) {
            req.token = token;
            // verifies secret and checks exp
            jwt.verify(token, config.jwtSecret, function(err, decoded) {
                // console.log(token, decoded, err)
                if ( ! err) {
                    req.user = decoded;
                }
                next();
            });
        } else {
            next();
        }
    },

    authenticateUser: function(req, res, next) {
        if ( ! req.token) {
            return res.status(401).send({ success: false, message: 'No token provided.' });
        } else if ( ! req.user) {
            return res.status(401).send({ success: false, message: 'Failed to authenticate token.' });
        } else {
            next();
        }
    }
}