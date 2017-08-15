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
        loopfunc:true
      },
      main: ['gruntfile.js', 'test/**/*.js', 'public/resources/PiDashboard.js', 'app.js', 'routes/*.js']
    });

    grunt.config('csslint', {
      options: {
        'adjoining-classes': false,
        'box-sizing': false,
        'unqualified-attributes': false,
        'outline-none': false
      },
      main: ['public/**/*.css']
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
            src    : ['package.json','app.config.json','app.js','keys/**','public/**','routes/**'],
            dest   : 'distribute'
          }
        ]
      }
    });

    grunt.config('cssmin', {
      // combine: {
      //   files: {
      //     'distribute/public/resources/output.css': ['distribute/public/resources/PiDashboard.css', 'distribute/public/resources/other.css']
      //   }
      // },
      minify: {
        expand: true,
        cwd: 'distribute/public/resources',
        src: ['*.css', '!*.min.css'],
        dest: 'distribute/public/resources',
        ext: '.min.css',
        options: {
          report: 'gzip'
        }
      }
    });

    //grunt.registerTask('default', ['test', 'clean', 'copy', 'cssmin' ]);
    grunt.registerTask('default', ['test', 'clean', 'copy' ]);
    grunt.registerTask('test', ['jshint', 'nodeunit']);
  };
}());
