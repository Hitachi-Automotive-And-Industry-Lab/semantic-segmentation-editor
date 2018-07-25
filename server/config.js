import {readFileSync} from "fs";

const configurationFile = {};
const init = ()=> {
    try {
        let configFile = readFileSync(process.env.PWD + "/config.json", {encoding: "utf8"});
        configFile = configFile.replace(/\/\/.*/g, "");
        const config = JSON.parse(configFile);
        configurationFile.imagesFolder = config.configuration["input-folder"].replace(/\/$/, "");
        configurationFile.pointcloudsFolder = config.configuration["output-folder"].replace(/\/$/, "");
        configurationFile.setsOfClassesMap = new Map();
        configurationFile.setsOfClasses = config["sets-of-classes"];
        config["sets-of-classes"].forEach(o => configurationFile.setsOfClassesMap.set(o.name, o));
        console.log("Semantic Segmentation Editor");
        console.log("Images (JPG, PNG, PCD) folder:", configurationFile.imagesFolder);
        console.log("3D Segmentation Data folder:", configurationFile.pointcloudsFolder);
        console.log(config["sets-of-classes"].length + " sets of object classes");
        return configurationFile;
    }catch(e){
        console.error("Error while parsing config.json");
    }
};
export default init();
