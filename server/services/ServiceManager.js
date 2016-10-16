var exec = require('child_process').exec;

var services = {};

function Service(name, runningCheck) {
    this.name = name;
    this.runningCheck = runningCheck || /is started|running/

    services[name] = this;
}

Service.prototype.is_running = function(output){
    // console.log('output: ', output)
    var re = new RegExp(this.runningCheck)
    return re.test(output);
}

Service.prototype.exec_service = function(action, callback){
    exec('service ' + this.name + ' ' + action, (error, stdout, stderr) => {
        // console.log('service is running: ', this.is_running(stdout || error))
        callback(this.is_running(stdout || error))
    });
}

Service.prototype.start = function(callback){
    // console.log('starting: ', this.name)
    this.exec_service('start', callback)
}

Service.prototype.stop = function(callback){
    this.exec_service('stop', callback)
}

Service.prototype.status = function(callback){
    this.exec_service('status', callback)
}

// var nginx = new Service('nginx')

// if (process.argv[2] == 'start')
//     nginx.start()
// else if (process.argv[2] == 'status')
//     nginx.status()
// else if (process.argv[2] == 'stop')
//     nginx.stop()
// else
//     console.log(new Error('Invalid status'))


/* Public API */
module.exports.services = services;
module.exports.Service = Service;