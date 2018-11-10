import FIC from "fastintcompression";
import SseMsg from "./SseMsg";

export default class SseDataManager {
    constructor() {

        SseMsg.register(this);
        this.LZW = {
            compress: function (uncompressed) {
                "use strict";
                // Build the dictionary.
                let i,
                    dictionary = {},
                    c,
                    wc,
                    w = "",
                    result = [],
                    dictSize = 256;
                for (i = 0; i < 256; i += 1) {
                    dictionary[String.fromCharCode(i)] = i;
                }

                for (i = 0; i < uncompressed.length; i += 1) {
                    c = uncompressed.charAt(i);
                    wc = w + c;
                    //Do not use dictionary[wc] because javascript arrays
                    //will return values for array['pop'], array['push'] etc
                    // if (dictionary[wc]) {
                    if (dictionary.hasOwnProperty(wc)) {
                        w = wc;
                    } else {
                        result.push(dictionary[w]);
                        // Add wc to the dictionary.
                        dictionary[wc] = dictSize++;
                        w = String(c);
                    }
                }

                // Output the code for w.
                if (w !== "") {
                    result.push(dictionary[w]);
                }
                return result;
            },


            decompress: function (compressed) {
                "use strict";
                // Build the dictionary.
                let i,
                    dictionary = [],
                    w,
                    result,
                    k,
                    entry = "",
                    dictSize = 256;
                for (i = 0; i < 256; i += 1) {
                    dictionary[i] = String.fromCharCode(i);
                }

                w = String.fromCharCode(compressed[0]);
                result = w;
                for (i = 1; i < compressed.length; i += 1) {
                    k = compressed[i];
                    if (dictionary[k]) {
                        entry = dictionary[k];
                    } else {
                        if (k === dictSize) {
                            entry = w + w.charAt(0);
                        } else {
                            return null;
                        }
                    }

                    result += entry;

                    // Add w+entry[0] to the dictionary.
                    dictionary[dictSize++] = w + entry.charAt(0);

                    w = entry;
                }
                return result;
            }
        }
    }

    objectToBytes(obj) {
        let payload = JSON.stringify(obj);
        payload = this.LZW.compress(payload);
        payload = FIC.compress(payload);
        return payload;
    }

    bytesToObject(bytes) {
        if (bytes.byteLength > 0) {
            const str = this.LZW.decompress(FIC.uncompress(bytes));
            return JSON.parse(str);
        } else return null;
    }


    saveBinaryFile(fileName, data) {
        const worker = new Worker("/SseDataWorker.js");
        worker.addEventListener("message", (arg) => {
            worker.terminate();
            //this.sendMsg("bottom-right-label", {message: "Sending..."})
            const binary = arg.data.result;
            if (!binary)
                return;

            const url = "/save" + fileName;
            const oReq = new XMLHttpRequest();
            oReq.open("POST", url, true);
            oReq.setRequestHeader("Content-Type", "application/octet-stream");
            oReq.send(binary);
        });
        worker.postMessage({operation: "compress", data});
    }

    loadBinaryFile(fileName) {
        const worker = new Worker("/SseDataWorker.js");

        const url = "/datafile" + fileName;
        const oReq = new XMLHttpRequest();

        oReq.responseType = "arraybuffer";
        oReq.open("GET", url, true);

        const prom = new Promise((res, rej) => {
            oReq.onloadend = (oEvent) => {
                if (oEvent.target.status != 200) {
                    rej();
                } else {
                    worker.addEventListener("message", (arg) => {
                        if (arg.data.operation == "uncompress") {
                            if (arg.data.result)
                                res(arg.data.result);
                            else
                                rej()
                        }
                    });
                    worker.postMessage({operation: "uncompress", data: oReq.response});
                }
            };
            oReq.send("nothing");
        });
        prom.then(() => worker.terminate(), ()=>(0/* Silent catch */));
        return prom;
    }
}