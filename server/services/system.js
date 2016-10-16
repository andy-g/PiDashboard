var	exec = require('child_process').exec,
	request = require('request'),
	fs = require('fs'),
    moment = require('moment'),
    _     = require('lodash'),
	ServiceManager  = require('./ServiceManager')
    config  = require('../config')
    formatHelper = require('../../routes/formatHelper');

_.each(config.services,(serice, alias) => {
    //console.log(serice)
    new ServiceManager.Service(serice.serviceName)    
})

new ServiceManager.Service('nginx')

function getServiceStatus(req, res) {
    var service = ServiceManager.services[req.params['service']];
    if ( ! service) {
        res.status(500).send({ "err": "Specified service is not configured" });
        return;
    }

    service.status(function(is_running){
        res.send({'running': is_running})
    })
}

function setServiceStatus(req, res) {
    var service = ServiceManager.services[req.params['service']];
    if ( ! service) {
        res.status(500).send({ "err": "Specified service is not configured" });
        return;
    }

    console.log(req.body['status'])
    if (req.body['status'] == 'start') {
        service.start(function(is_running){
            res.send({'running': is_running})
        })
    } else if (req.body['status'] == 'stop') {
        service.stop(function(is_running){
            res.send({'running': is_running})
        })        
    } else {
        return res.status(500).send({ "err": "Invalid status" });
    }
}

module.exports.getServiceStatus = getServiceStatus
module.exports.setServiceStatus = setServiceStatus