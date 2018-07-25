export default class Sse3dSelector {
    constructor(scene) {
        this.scene = scene;
        this.polygon = [];
    }

    pushPoint(x, y) {
        this.polygon.push([x, y]);
    }

    deactivate() {
        this.polygon.length = 0;
    }

}