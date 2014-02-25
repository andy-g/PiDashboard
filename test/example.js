var fs = require('fs');

exports.testAppExists = function(test){
  test.expect(1);
  test.ok(fs.existsSync('source/app.js'), 'app.js exists');
  test.done();
};