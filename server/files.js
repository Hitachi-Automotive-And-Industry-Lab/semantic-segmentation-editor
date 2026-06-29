import {Meteor} from "meteor/meteor";
import shell from "shelljs";
import serveStatic from "serve-static";
import bodyParser from "body-parser";
import {createWriteStream} from "fs";
import {dirname} from "path";
import configurationFile from "./config";
import {resolveInside} from "./pathUtils";
const demoMode = Meteor.settings.configuration["demo-mode"];

Meteor.startup(() => {

const {imagesFolder, pointcloudsFolder} = configurationFile;
    WebApp.connectHandlers.use("/file", serveStatic(imagesFolder, {fallthrough: false}));
    WebApp.connectHandlers.use("/datafile", serveStatic(pointcloudsFolder, {fallthrough: true}));
    WebApp.connectHandlers.use("/datafile", (req,res)=>{
        res.end("");
    });

    WebApp.connectHandlers.use(bodyParser.raw({limit: "200mb", type: 'application/octet-stream'}));
    WebApp.connectHandlers.use('/save', function (req, res) {
        if (demoMode) {
            res.statusCode = 403;
            res.end("Demo mode is read-only.");
            return;
        }
        let fileToSave;
        try {
            fileToSave = resolveInside(pointcloudsFolder, req.url.replace(/^\/save(?=\/|$)/, ""));
        } catch (err) {
            res.statusCode = 400;
            res.end("Invalid save path.");
            return;
        }
        const dir = dirname(fileToSave);
        shell.mkdir('-p', dir);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");

        let finished = false;
        const finish = (statusCode, message) => {
            if (finished)
                return;
            finished = true;
            res.statusCode = statusCode;
            res.end(message);
        };

        const wstream = createWriteStream(fileToSave);
        wstream.on('error', (err) => {
            console.error('[SSE] Cannot write', fileToSave, err.code, err.message);
            finish(500, 'Write error: ' + err.message);
        });
        wstream.write(req.body);
        wstream.end(() => finish(200, "Sent: " + fileToSave));
    });
});
