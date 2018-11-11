import {Meteor} from "meteor/meteor";
import {join} from "path";
import {mkdirSync, existsSync} from "fs";
import os from "os";
import download from "download";

const configurationFile = {};
const defaultClasses = [{
    "name": "33 Classes", "objects": [
        {"label": "VOID", "color": "#CFCFCF"},
        {"label": "Class 1"},
        {"label": "Class 2"},
        {"label": "Class 3"},
        {"label": "Class 4"},
        {"label": "Class 5"},
        {"label": "Class 6"},
        {"label": "Class 7"},
        {"label": "Class 8"},
        {"label": "Class 9"},
        {"label": "Class 10"},
        {"label": "Class 11"},
        {"label": "Class 12"},
        {"label": "Class 13"},
        {"label": "Class 14"},
        {"label": "Class 15"},
        {"label": "Class 16"},
        {"label": "Class 17"},
        {"label": "Class 18"},
        {"label": "Class 19"},
        {"label": "Class 20"},
        {"label": "Class 21"},
        {"label": "Class 22"},
        {"label": "Class 23"},
        {"label": "Class 24"},
        {"label": "Class 25"},
        {"label": "Class 26"},
        {"label": "Class 27"},
        {"label": "Class 28"},
        {"label": "Class 29"},
        {"label": "Class 30"},
        {"label": "Class 31"},
        {"label": "Class 32"}
    ]
}];
const init = ()=> {
    try {
        const config = Meteor.settings;

        if (config.configuration && config.configuration["images-folder"] != "") {
            configurationFile.imagesFolder = config.configuration["images-folder"].replace(/\/$/, "");
        }else{
            configurationFile.imagesFolder = join(os.homedir(), "sse-images");
        }

        if (!existsSync(configurationFile.imagesFolder)){
            mkdirSync(configurationFile.imagesFolder);
            download("https://raw.githubusercontent.com/Hitachi-Automotive-And-Industry-Lab/semantic-segmentation-editor/master/private/samples/bitmap_labeling.png", configurationFile.imagesFolder);
            download("https://raw.githubusercontent.com/Hitachi-Automotive-And-Industry-Lab/semantic-segmentation-editor/master/private/samples/pointcloud_labeling.pcd", configurationFile.imagesFolder);
        }

        if (config.configuration && config.configuration["internal-folder"] != "") {
            configurationFile.pointcloudsFolder = config.configuration["internal-folder"].replace(/\/$/, "");
        }else{

            configurationFile.pointcloudsFolder = join(os.homedir(), "sse-internal");
        }

        configurationFile.setsOfClassesMap = new Map();
        configurationFile.setsOfClasses = config["sets-of-classes"];
        if (!configurationFile.setsOfClasses){
            configurationFile.setsOfClasses = defaultClasses;
        }
        configurationFile.setsOfClasses.forEach(o => configurationFile.setsOfClassesMap.set(o.name, o));
        console.log("Semantic Segmentation Editor");
        console.log("Images (JPG, PNG, PCD) served from", configurationFile.imagesFolder);
        console.log("PCD binary segmentation data stored in", configurationFile.pointcloudsFolder);
        console.log("Number of available sets of object classes:", configurationFile.setsOfClasses.length);
        return configurationFile;
    }catch(e){
        console.error("Error while parsing settings.json:", e);
    }
};
export default init();
