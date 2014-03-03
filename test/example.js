var fs = require('fs'),
	formatHelper = require('../routes/formatHelper'),
	ContentHandler = require('../routes/usage');

exports.group = {
	//setUp: function (callback) {
	//	this.foo = 'bar';
	//	callback();
	//},
	//tearDown: function (callback) {
	//	// clean up
	//	callback();
	//},
	appExists: function(test){
		test.expect(1);

		test.ok(fs.existsSync('app.js'), 'app.js exists');

		test.done();
	},
	formatHelper: function(test){
		test.expect(5);

		test.equal(formatHelper.padNumber(3, 2), '03',  'Format Helper - Pad Number');
		test.equal(formatHelper.padNumber(20033, 4), '20033',  'Format Helper - Pad Number');
		test.equal(formatHelper.padNumber(20033, 10), '0000020033',  'Format Helper - Pad Number');
		test.equal(formatHelper.formatBytes(24723.123, 2), '24.14 KB',  'Format Helper - Pad Number');
		test.equal(formatHelper.formatBytes(1213412341, 2), '1.13 GB',  'Format Helper - Format Bytes');

		test.done();
	},
	drives: function(test){
		test.expect(1);

		var appSettings = {	};
		var contentHandler = new ContentHandler(appSettings);
		contentHandler.drives = function(req, res) {
			res.header("Access-Control-Allow-Origin", "*");
			res.json({"date": 1377848728838,"drives": [{"mount":"/","size":"7.3G","avail":"5.7G","used":"18%"},{"mount":"/boot","size":"69M","avail":"63M","used":"9%"},{"mount":"/media/video","size":"466G","avail":"16G","used":"97%"},{"mount":"/media/timemachine","size":"466G","avail":"101G","used":"79%"}]});
		};

		var ResultStub = function() { 
				var _json = '';
				this.header = function(){};
				this.json = function(jsonIn){ 
					//console.log('settings _json');
					//console.log(jsonIn);
					this._json = jsonIn; 
				};
		};
		var resultStub = new ResultStub();
		var ch = contentHandler.drives(null,resultStub);
		//console.log(resultStub._json);
		//console.log('afer run...');

		test.deepEqual( resultStub._json, JSON.parse('{"date": 1377848728838,"drives": [{"mount": "/","size": "7.3G","avail": "5.7G","used": "18%"},{"mount": "/boot","size": "69M","avail": "63M","used": "9%"},{"mount": "/media/video","size": "466G","avail": "16G","used": "97%"},{"mount": "/media/timemachine","size": "466G","avail": "101G","used": "79%"}]}', 'Drive Usage') );

		test.done();
	}
};
