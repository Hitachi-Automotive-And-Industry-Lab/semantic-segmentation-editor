import SseGlobals from "./SseGlobals.jsx";

export default class SseSetOfClasses {
    constructor(config) {
        this._config = config;
        this.name = config.name;
        this._byLabel = new Map();
        this._labels = new Set();
        this._config.objects.forEach((desc, i) => {
            desc.classIndex = i;
            this._byLabel.set(desc.label, desc);
            this._labels.add(desc.label);
        })
    }

    get classesCount() {
        return this._config.objects.length;
    }

    get firstLabel() {
        return this._config.objects[0].label;
    }

    get descriptors() {
        return this._config.objects;
    }

    get byLabel() {
        return this._byLabel;
    }

    get labels() {
        return this._labels;
    }

    colorForLabel(label) {
        return this._byLabel.get(label).color;
    }

    indexForLabel(label) {
        return this._byLabel.get(label).index;
    }

    labelForIndex(idx) {
        return this._config.objects[idx].label;
    }

    colorForIndexAsHex(idx) {
        return this._config.objects[idx].color;
    }

    colorForIndexAsRGBArray(idx) {
        return SseGlobals.hex2rgb(this._config.objects[idx].color);
    }

    descriptorForLabel(lbl) {
        return this._byLabel.get(lbl);
    }

    descriptorForIndex(idx) {
        return this._config.objects[idx];
    }

    propsForIndex(idx) {
        const {label, color} = this._config.objects[idx];
        return {label, color};
    }

    get clone() {
        const cc = Object.assign({}, this._config);
        cc.objects = cc.objects.map(x => Object.assign({}, x));
        return new SseSetOfClasses(cc);
    }
}