exports.formatBytes = function(bytes, precision)
{
    var units = ['b', 'KB', 'MB', 'GB', 'TB'];
    bytes = Math.max(bytes, 0);
    var pwr = Math.floor((bytes ? Math.log(bytes) : 0) / Math.log(1024));
    pwr = Math.min(pwr, units.length - 1);
    bytes /= Math.pow(1024, pwr);
	return bytes.toFixed(precision) + ' ' + units[pwr];
}

exports.padNumber = function(number, pad) {
	var N = Math.pow(10, pad);
	return number < N ? ("" + (N + number)).slice(1) : "" + number
}