export default class MapSet {

    constructor() {
        this._umap = new Map();
        for (let name of Object.getOwnPropertyNames(Object.getPrototypeOf(this._umap))) {
            let method = this._umap[name];
            if (!(method instanceof Function) || method === Map) continue;
            this[name] = function () {
                return method.apply(this._umap, arguments);
            };
        }
    }

    map(key, obj) {
        const act = this._umap.get(key);
        if (act) {
            act.add(obj);
        } else {
            this._umap.set(key, new Set([obj]));
        }

    }

    unmap(key, obj) {
        const act = this._umap.get(key);
        if (act) {
            act.delete(obj);
        }
        if (act.size == 0) {
            this._umap.delete(key);
        }
    }

    getMap() {
        return this._umap;
    }

    size() {
        return this._umap.size;
    }

}