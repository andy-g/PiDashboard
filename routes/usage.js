var
    exec = require('child_process').exec,
    System = require('./system'),
    schedule = require('node-schedule'),
    request = require('request');

//var heapdump = require('heapdump');
function ContentHandler(appSettings) {
    'use strict';

    var system = new System(appSettings);

    //try cache data, and load it on startup or when rewriting to the file
    this.usageSummary = function(req, res) {
        var runDate = !req.params['runDate'] ? new Date() : new Date(parseInt(req.params['runDate']));

        res.header("Access-Control-Allow-Origin", "*");
        system.getUsageSummary(runDate, function(error, data) {
            if (!data || error)
                res.json(500, { "err": "Current usage could not be retrieved - check router status." });
            else
                res.json(data);
        });
    };

    this.graphData = function(req, res) {
        var runDate = !req.params['runDate'] ? new Date() : new Date(isNaN(req.params['runDate']) ? req.params['runDate'] : Number(req.params['runDate']));

        res.header("Access-Control-Allow-Origin", "*");
        system.getGraphData(runDate, !req.query['new'], function(error, data) {
            if (!data || error)
                res.json(500, { "err": "Graph data could not be retrieved" });
            else
                res.json(data);
        });
    };

    this.drives = function(req, res) {
        res.header("Access-Control-Allow-Origin", "*");
        system.driveUsage(function(error, data) {
            if (error)
                res.json(500, error);
            else
                res.json(data);
        });
    };

    this.serviceStatus = function(req, res) {
        res.header("Access-Control-Allow-Origin", "*");

        var service = appSettings.services[req.body['service']];

        //If service isn't in config then exit 
        if (!service) {
            res.json(500, { "err": "Specified service is not configured" });
            return;
        }

        var status = !req.body['status'] || !(/start|stop/g).test(req.body['status']) ? "status" : req.body['status'];
        if (req.body['isScheduled']) {
            if (service.jobs) {
                service.jobs.forEach(function(job) { job.cancel(); });
                delete service.jobs;
            }
            if (req.body['isScheduled'] === 'true' && service.startSchedule && service.endSchedule) {
                var serviceStart = schedule.scheduleJob(service.serviceName + '-start', service.startSchedule, function() { system.execService(service.serviceName, 'start'); });
                var serviceStop = schedule.scheduleJob(service.serviceName + '-stop', service.endSchedule, function() { system.execService(service.serviceName, 'stop'); });
                service.jobs = [serviceStart, serviceStop];

                //if it's currently after startSchedule and before endSchedule, set status = "start"
                if (serviceStop.nextInvocation() < serviceStart.nextInvocation())
                    status = "start";
            }
        }

        var isScheduled = !!service.jobs;
        if (status != "status" && req.route.method != "put") {
            res.json(500, { "err": "Service status could not be set using a get request, please rather use a put request" });
            return;
        }

        system.execService(service.serviceName, status, function(output) {
            if (!output.err) {
                output.isScheduled = isScheduled;
                output.alias = req.body['service'];
                res.json(output);
            } else {
                res.json(500, output);
            }
        });
    };

    this.deviceStatus = function(req, res) {
        res.header("Access-Control-Allow-Origin", "*");

        var device = req.body['device'];
        var status = !req.body['status'] || !(/on|off/g).test(req.body['status']) ? "status" : req.body['status'];

        if (status != "status" && req.route.method != "put") {
            res.json(500, { "err": "Device status could not be set using a get request, please rather use a put request" });
            return;
        }

        var req_options = {
            uri: appSettings.adafruitio.url + '/' + device,
            headers: {
                "X-AIO-Key": appSettings.adafruitio.key
            },
            json: true,
        };
        if (status != "status") {
            req_options.uri = appSettings.adafruitio.url + '/' + device + "/data";
            req_options.method = "POST";
            req_options.body = {
                "value": status.toUpperCase()
            };
        }

        request(
            req_options,
            function(err, response, body) {
                if (err) {
                    res.json(500, { "err": "getDeviceStatus: No response body." });
                } else {
                    var device_status = ((body.last_value || body.value) === "ON");
                    res.json({
                        "device": device,
                        "status": device_status
                    });
                }
            }
        );
    };
}

module.exports = ContentHandler;
