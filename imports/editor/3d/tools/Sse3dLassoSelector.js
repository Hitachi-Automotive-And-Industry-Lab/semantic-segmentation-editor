import Sse3dSelector from "./Sse3dSelector";

export default class extends Sse3dSelector {
    mouseDown(ev) {
        if (ev.which == 3) {
            this.pushPoint(ev.offsetX, ev.offsetY);
        }
    }

    mouseUp(ev) {
        if (ev.which == 3) {
            this.scene.selectByPolygon(this.polygon);
            this.polygon.length = 0;
        }
    }

    mouseDrag(ev) {
        if (ev.which == 3) {
            this.pushPoint(ev.offsetX, ev.offsetY);
        }
    }


}