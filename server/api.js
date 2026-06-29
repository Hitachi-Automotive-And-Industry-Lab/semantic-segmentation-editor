import SseDataWorkerServer from "./SseDataWorkerServer";
import configurationFile from "./config";
import {basename} from "path";
import {readFile} from "fs";
import * as THREE from 'three';
import SsePCDLoader from "../imports/editor/3d/SsePCDLoader";
import {resolveInside} from "./pathUtils";

WebApp.connectHandlers.use("/api/json", generateJson);
WebApp.connectHandlers.use("/api/pcdtext", generatePCDOutput.bind({fileMode: false}));
WebApp.connectHandlers.use("/api/pcdfile", generatePCDOutput.bind({fileMode: true}));
WebApp.connectHandlers.use("/api/listing", imagesListing);

const {imagesFolder, pointcloudsFolder, setsOfClassesMap} = configurationFile;
new SsePCDLoader(THREE);

function logPCDExportError(message, context, err) {
    const details = Object.assign({}, context);
    if (err) {
        details.errorCode = err.code;
        details.errorMessage = err.message;
    }
    console.error("[SSE] PCD export failed:", message, details);
}

function finishPCDExportError(res, statusCode, message) {
    if (!res.headersSent) {
        res.statusCode = statusCode;
    }
    res.end(message);
}

function imagesListing(req, res, next) {
    const all = SseSamples.find({}, {
        fields: {
            url: 1,
            folder: 1,
            file: 1,
            tags: 1,
            firstEditDate: 1,
            lastEditDate: 1
        }
    }).fetch();
    res.end(JSON.stringify(all, null, 1));
}

function generateJson(req, res, next) {
    res.setHeader('Content-Type', 'application/json');
    const item = SseSamples.findOne({url: req.url});
    if (item) {
        const soc = setsOfClassesMap.get(item.socName);
        item.objects.forEach(obj => {
            obj.label = soc && soc.objects[obj.classIndex] ? soc.objects[obj.classIndex].label : String(obj.classIndex);
        });
        res.end(JSON.stringify(item, null, 1));
    } else {
        res.end("{}");
    }
}

function generatePCDOutput(req, res, next) {
    let decodedUrl;
    let pcdFile;
    let labelFile;
    let objectFile;
    try {
        const requestPath = (req.url || "").split(/[?#]/)[0];
        decodedUrl = decodeURIComponent(requestPath);
        pcdFile = resolveInside(imagesFolder, requestPath);
        labelFile = resolveInside(pointcloudsFolder, requestPath, ".labels");
        objectFile = resolveInside(pointcloudsFolder, requestPath, ".objects");
    } catch (err) {
        finishPCDExportError(res, 400, "Invalid PCD export path.");
        return;
    }
    const fileName = basename(pcdFile);
    const exportContext = {
        url: req.url,
        decodedUrl,
        mode: this.fileMode ? "file" : "text",
        pcdFile,
        labelFile,
        objectFile
    };

    if (this.fileMode) {
        res.setHeader('Content-disposition', 'attachment; filename=DOC'.replace("DOC", fileName));
        res.setHeader('Content-type', 'text/plain');
        res.charset = 'UTF-8';
    }


    readFile(pcdFile, (err, content) => {
        if (err) {
            logPCDExportError("Cannot read PCD file.", exportContext, err);
            finishPCDExportError(res, 404, "Error while parsing PCD file.");
            return;
        }

        const loader = new THREE.PCDLoader(true);
        let pcdContent;
        try {
            pcdContent = loader.parse(content.buffer, "");
        } catch (parseErr) {
            logPCDExportError("Cannot parse PCD file.", exportContext, parseErr);
            finishPCDExportError(res, 500, "Error while parsing PCD file.");
            return;
        }
        const hasRgb = pcdContent.rgb.length > 0;
        const head = pcdContent.header;
        const rgb2int = rgb => rgb[2] + 256 * rgb[1] + 256 * 256 * rgb[0];

        let out = "VERSION .7\n";
        out += hasRgb ? "FIELDS x y z rgb label object\n" : "FIELDS x y z label object\n";
        out += hasRgb ? "SIZE 4 4 4 4 4 4\n" : "SIZE 4 4 4 4 4\n";
        out += hasRgb ? "TYPE F F F I I I\n" : "TYPE F F F I I\n";
        out += hasRgb ? "COUNT 1 1 1 1 1 1\n" : "COUNT 1 1 1 1 1\n";
        out += "WIDTH " + pcdContent.header.width + "\n";
        out += "HEIGHT " + pcdContent.header.height + "\n";
        out += "POINTS " + pcdContent.header.width*pcdContent.header.height + "\n";
        out += "VIEWPOINT " + head.viewpoint.tx;
        out += " " + head.viewpoint.ty;
        out += " " + head.viewpoint.tz;
        out += " " + head.viewpoint.qw;
        out += " " + head.viewpoint.qx;
        out += " " + head.viewpoint.qy;
        out += " " + head.viewpoint.qz + "\n";
        out += "DATA ascii\n";
        readFile(labelFile, (labelErr, labelContent) => {
            if (labelErr) {
                logPCDExportError("Cannot read labels file.", exportContext, labelErr);
                finishPCDExportError(res, 404, "Error while parsing labels file.");
                return;
            }

            let labels;
            try {
                labels = SseDataWorkerServer.uncompress(labelContent);
            } catch (uncompressErr) {
                logPCDExportError("Cannot uncompress labels file.", exportContext, uncompressErr);
                finishPCDExportError(res, 500, "Error while parsing labels file.");
                return;
            }

            readFile(objectFile, (objectErr, objectContent) => {
                let objectsAvailable = true;
                if (objectErr) {
                    objectsAvailable = false;
                    console.warn("[SSE] PCD export objects file unavailable; using object=-1.", Object.assign({}, exportContext, {
                        errorCode: objectErr.code,
                        errorMessage: objectErr.message
                    }));
                }

                const objectByPointIndex = new Map();

                if (objectsAvailable) {
                    let objects;
                    try {
                        objects = SseDataWorkerServer.uncompress(objectContent);
                    } catch (uncompressErr) {
                        logPCDExportError("Cannot uncompress objects file.", exportContext, uncompressErr);
                        finishPCDExportError(res, 500, "Error while parsing objects file.");
                        return;
                    }
                    objects.forEach((obj, objIndex) => {
                        obj.points.forEach(ptIdx => {
                            objectByPointIndex.set(ptIdx, objIndex);
                        })
                    });
                }
                let obj;
                res.write(out);
                out = "";

                pcdContent.position.forEach((v, i) => {
                    const position = Math.floor(i / 3);

                    switch (i % 3) {
                        case 0:
                            if (hasRgb) {
                                obj = {rgb: pcdContent.rgb[position], x: v};
                            }else{
                                obj = {x: v};
                            }
                            break;
                        case 1:
                            obj.y = v;
                            break;
                        case 2:
                            obj.z = v;
                            out += obj.x + " " + obj.y + " " + obj.z + " ";
                            if (hasRgb) {
                                out += rgb2int(obj.rgb) + " ";
                            }
                            out += labels[position] + " ";
                            const assignedObject = objectByPointIndex.get(position);
                            if (assignedObject != undefined)
                                out += assignedObject;
                            else
                                out += "-1";
                            out += "\n";
                            res.write(out);
                            out = "";
                            break;
                    }
                });

                res.end()
            })
        });
    });
}
