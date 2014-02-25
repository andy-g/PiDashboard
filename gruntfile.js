(function () {
  'use strict';

  //console.log( require('fs').existsSync('app.js') );

  module.exports = function (grunt) {
    require('time-grunt')(grunt);
    require('load-grunt-tasks')(grunt);

    grunt.config('jshint', {
      options: {
        globals: {
          module: true,
          require: true
        },
      },
      main: ['gruntfile.js', 'test/**/*.js', 'source/public/resources/PiDashboard.js', 'source/app.js', 'source/routes/*.js']
    });

    grunt.config('csslint', {
      options: {
        'adjoining-classes': false
      },
      main: ['css/main.css']//,'source/**/*.css']
    });

    grunt.config('nodeunit', {
      main: ['test/**/*.js'],
      options: {
        //
      }
    });

    grunt.config('clean', {
      main: ['distribute']
    });

    grunt.config('copy', {
      main: {
        files: [
          {
            expand : true,
            cwd    : 'source',
            src    : ['**', '**/.*'],
            dest   : 'distribute'
          },
          {
            expand : true,
            src    : ['package.json'],
            dest   : 'distribute'
          }
        ]
      }
    });

    grunt.registerTask('default', ['test', 'clean', 'copy']);
    grunt.registerTask('test', ['jshint', 'csslint', 'nodeunit']);
  };
}());