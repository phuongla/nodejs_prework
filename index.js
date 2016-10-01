/**
 * Created by phuongle on 9/29/2016.
 */
"use strict";
let http = require("http");
let request = require("request");
let path = require("path");
let fs = require("fs");
let stream = require("stream");
let chalk = require("chalk");
let https = require("https");
https.globalAgent.options.secureProtocol = 'SSLv3_method';


let argv = require("yargs")
    .help('h')
    .alias('h', 'help')
    .usage('Usage: node ./index.js [options]')
    .default("host", '127.0.0.1')
    .describe("host", "Specify a forwarding host")
    .alias('x', 'host')
    .default("host-ssl", '127.0.0.1')
    .describe("host-ssl", "Specify a forwarding secure host (https)")
    .alias('xs', 'host-ssl')
    .default("port", '8000')
    .describe("port", "Specify a forwarding port")
    .alias('p', 'port')
    .default("port-ssl", '9000')
    .describe("port-ssl", "Specify a forwarding secure port (https)")
    .alias('ps', 'port-ssl')
    .describe("url", "Specify a forwarding address")
    .alias('u', 'url')
    .describe("logFile", "Specify a output log file")
    .alias('l', 'logFile')
    .describe("logLevel", "Specify log level write to file (Emergency->Alert->Critical->Error->Warning->Notice->Informational->Debug)")
    .default("logLevel", "Debug")
    .alias('lv', 'logLevel')
    .describe("exec", "Specify a process to proxy instead")
    .alias('e', 'exec')
    .example('node index.js -u 127.0.0.1:9999 -l proxy.log', 'run proxy route to 127.0.0.1:9999 and log write to ./proxy.log')
    .epilog('copyright@ 2016 CoderSchool')
    .argv;

let Severity = {
    Emergency: 0,
    Alert: 1,
    Critical: 2,
    Error: 3,
    Warning: 4,
    Notice: 5,
    Informational: 6,
    Debug: 7
};

let logPath = argv.logFile && path.join(__dirname, argv.logFile);
let logStream = logPath ? fs.createWriteStream(logPath) : process.stdout;

var levelLog = Severity.Debug;
if(argv.logLevel && Severity[argv.logLevel]){
    levelLog = Severity[argv.logLevel];
}

function getChalkSeverity(level) {
    switch(level){
        case Severity.Emergency:
        case Severity.Alert:
        case Severity.Critical:
        case Severity.Error:
            return chalk.red;
        case Severity.Warning:
            return chalk.yellow;
        case Severity.Notice:
        case Severity.Informational:
            return chalk.blue;
        case Severity.Debug:
            return chalk.grey;
        default:
            return chalk.green;
    }
}


function log(level, msg) {

    if(level > levelLog){
        return;
    }

    if(typeof msg === "string"){
        if(logPath){
            logStream.write("\n" + msg);
        } else{
            let color = getChalkSeverity(level);
            logStream.write(color("\n" + msg));
        }
    } else if(msg instanceof stream.Readable){
        logStream.write("\n");
        msg.pipe(logStream, {end: false});
    }
}

function echoServerHandler(req, res) {
    for(let headerName in req.headers){
        res.setHeader(headerName, req.headers[headerName]);
    }
    req.pipe(res);
}


if(argv.exec){
    log(Severity.Informational, "\n-----------Active CLI Mode--------");
} else{

    let port = 8001;
    let securePort = 9001;

    let scheme = 'http://';
    let secureScheme = 'https://';


    let desPort = argv.host === '127.0.0.1' ? 8000 : 80;
    let destinationUrl = argv.url || scheme + argv.host + ':' + desPort;

    let desSecurePort = argv.xs === '127.0.0.1' ? 9000 : 443;
    let destinationSecureUrl = secureScheme + argv.xs + ':' + desSecurePort;

    log(Severity.Informational, `\nDestinationUrl: ${destinationUrl}`);
    log(Severity.Informational, `\nDestinationSecureUrl: ${destinationSecureUrl}`);

    let secureOptions = {
        key: fs.readFileSync('server-key.pem'),
        cert: fs.readFileSync('server-crt.pem'),
        ca: fs.readFileSync('ca-crt.pem')
    };



    http.createServer(echoServerHandler).listen(desPort, ()=>{
        log(Severity.Informational, "\nEcho server listen on port: " + desPort);
    });


    https.createServer(secureOptions, echoServerHandler).listen(desSecurePort, ()=>{
        log(Severity.Informational, "\nEcho server https listen on port: " + desSecurePort);
    });



    http.createServer((req, res) => {
        let url = destinationUrl;

        if(req.headers['x-destination-url']){
            url = scheme + req.headers['x-destination-url'];
            log(Severity.Debug, `\n\nOverride destinationUrl: ${url}`);
        }

        log(Severity.Debug, '\n\nRequest header: ' + JSON.stringify(req.headers));
        log(Severity.Debug, req);

        let options = {
            headers: req.headers,
            url: `${url}${req.url}`,
            method: req.method
        };

        log(Severity.Debug, "Request options: " + JSON.stringify(options));

        let downstreamRes = req.pipe(request(options));
        log(Severity.Debug, '\nResponse header: ' + JSON.stringify(downstreamRes.headers));

        log(Severity.Debug, downstreamRes);
        log(Severity.Debug,'\n');
        downstreamRes.pipe(res);

    }).listen(port, ()=>{
        log(Severity.Informational, "\nProxy server listen on port: " + port);
    });


    https.createServer(secureOptions, (req, res) => {
        let url = destinationSecureUrl;

        if(req.headers['x-destination-url']){
            url = secureScheme + req.headers['x-destination-url'];
            log(Severity.Debug, `\n\nOverride secureDestinationUrl: ${url}`);
        }

        log(Severity.Debug, '\n\nRequest header: ' + JSON.stringify(req.headers));
        log(Severity.Debug, req);

        let options = {
            headers: req.headers,
            url: `${url}${req.url}`,
            method: req.method,
            ca: fs.readFileSync('ca-crt.pem')
        };

        //log(Severity.Debug, "Request options: " + JSON.stringify(options));

        let downstreamRes = req.pipe(request(options));
        log(Severity.Debug, '\nResponse header: ' + JSON.stringify(downstreamRes.headers));

        log(Severity.Debug, downstreamRes);
        log(Severity.Debug,'\n');
        downstreamRes.pipe(res);

    }).listen(securePort, ()=>{
        log(Severity.Informational, "\nProxy server https listen on port: " + securePort);
    });


}



