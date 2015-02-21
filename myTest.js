var express = require('express'),
    app = express(),
    path = require('path'),
    bodyParser = require('body-parser'),
    fs = require('fs'),
    spawn = require('child_process').spawn,
    exec = require('child_process').exec,
    Q = require('q'),
    bodyParser = require('body-parser'),
    cors = require('cors'),
    fs = require('fs'),
    util = require('util');


var vodDir = '/home/ncl/Documents/vod/';
var logger = util.debuglog('logger');  //NODE_DEBUG=logger node app.js

app.use(cors());
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());

//app.use('/vod/', express.static('/home/ncl/Documents/vod/') );
app.use(express.static(path.join(__dirname, 'public')));

app.get('/vod/:file', function(req, res){
    var file = req.params.file;

    logger(file);
    fs.exists(path.join(vodDir, file), function(exists){
        if(exists){
            logger(exists);
            logger('sendFile: ' + file);
            res.sendFile(path.join(vodDir, file));
        }
    });

});

/*
 *  FFMPEG - VERSION : 2.5.4 "Bohr"
 */
app.post('/register/', function(req, res){;tw
    var file = req.body.file;
    console.log(file);

    res.send('accepted: ' + file);

    extractSound(file)
        .then(function() {
            return Q.all([
                vp9Encoder(file, '160x90', '250k'),
                vp9Encoder(file, '320x180', '500k'),
                vp9Encoder(file, '640x360', '750k'),
                vp9Encoder(file, '640x360', '1000k'),
                vp9Encoder(file, '1280x720', '500k')
            ]);
        }, function(error){
            console.error(error);
        })
        .spread(function(){
            return makeManifest(file);
        }, function(error){
            console.error(error);
        })
        .done(function(){

        });

    function extractSound(file){
        var d = Q.defer(),
            fileName = path.basename(file, path.extname(file)),
            command =  '-y -async 1 -i ' + path.join(vodDir, file) +' -b:a 128k -ar 44100 -vn -c:a libvorbis -ac 2 ' +
                path.join(vodDir, fileName+'_audio_128k.webm');

        var child = spawn('ffmpeg', command.split(" "));
        child.stdout.on('data', function(data){
            var buffer = new Buffer(data);
            logger("spawnSTDOUT: " + buffer.toString('utf8'));
        });

        child.on("exit", function(code){
            logger("Audio Extraction : " + code);

            if(code != 0 ){
                d.reject(code);
            }else{
                d.resolve();
            }
        });
        return d.promise;
    }//end extractSound

    function vp9Encoder(file, videoSize, bitrate){
        var d = Q.defer(),
            fileName = path.basename(file, path.extname(file)),
            command = '-y -vsync 1 -i ' + path.join(vodDir,file) + ' -r 30000/1001 -an -c:v libvpx -s ' +videoSize+ ' -b:v ' + bitrate + ' -keyint_min 150 -g 150 ' +
                '-tile-columns 4 -frame-parallel 1 -cpu-used 16 '+ path.join(vodDir, fileName+'_' +videoSize +'_' + bitrate + '.webm');
        console.log(command);
        var child = spawn('ffmpeg', command.split(" "));
        child.stdout.on('data', function(data){
            var buffer = new Buffer(data);
            logger("spawnSTDOUT: " + buffer.toString('utf8'));
        });

        child.stderr.on('data', function(data){
            var buffer = new Buffer(data);
            logger("spawnSTDOUT: " + buffer.toString('utf8'));
        });
        child.on("exit", function(code){
            console.log("conversion success : " + code);

            if(code != 0 ){
                d.reject(code);
            }else{
                d.resolve();
            }
        });
        return d.promise;
    }//end vp9Encoder

    function makeManifest(file){
        var d = Q.defer(),
            fileName = path.basename(file, path.extname(file)),

            command = 'export PATH=/home/ncl/Documents/libwebm:/home/ncl/Documents/webm-tools/webm_dash_manifest:$PATH ;cd ' + vodDir + ';' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_160x90_250k.webm')+' -o '+path.join(vodDir, fileName+'_160x90_250k-final.webm')+' ;' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_320x180_500k.webm')+' -o '+path.join(vodDir, fileName+'_320x180_500k-final.webm')+' ;' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_640x360_750k.webm')+' -o '+path.join(vodDir, fileName+'_640x360_750k-final.webm')+' ;' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_640x360_1000k.webm')+' -o '+path.join(vodDir, fileName+'_640x360_1000k-final.webm')+' ;' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_1280x720_500k.webm')+' -o '+path.join(vodDir, fileName+'_1280x720_500k-final.webm')+' ;' +
                'samplemuxer -i '+path.join(vodDir, fileName+'_audio_128k.webm')+' -o '+path.join(vodDir, fileName+'_audio_128k-final.webm')+' -output_cues 1 -cues_on_audio_track 1 -max_cluster_duration 2 -audio_track_number;' +
                'echo [done] ;' +
                'webm_dash_manifest -o '+path.join( fileName+'_manifest.mpd')+' \
              -as id=0,lang=eng \
              -r id=0,file='+fileName+'_1280x720_500k-final.webm'+' \
              -r id=1,file='+fileName+'_640x360_1000k-final.webm'+' \
              -r id=2,file='+fileName+'_640x360_750k-final.webm'+' \
              -r id=3,file='+fileName+'_320x180_500k-final.webm'+' \
              -r id=4,file='+ fileName+'_160x90_250k-final.webm'+' \
              -as id=1,lang=eng \
              -r id=5,file='+fileName+'_audio_128k-final.webm';

        var child = exec(command, function(err, stdout, stderr){
            if(err){
                d.reject(err);
                throw err;
            }else{
                console.log('manifest file generated for ' + file);
                d.resolve();
            }
        });
        return d.promise;
    }//end makeManifest
});

app.listen(55555, function(){
    console.log('This server is running on the port ' + this.address().port );

});

