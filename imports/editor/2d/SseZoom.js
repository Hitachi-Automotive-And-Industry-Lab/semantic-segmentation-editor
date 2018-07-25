import Paper from "paper";

export default class SseZoom {
    constructor(editor) {
        this.editor = editor;
        this.factor = 1.25;
        this.maxZoom = 80;
        $(Paper.project.view.element).on("wheel", (event) => {
            event = event.originalEvent;
            const mousePosition = new Paper.Point(event.offsetX, event.offsetY);
            this.zoom(event.deltaY, mousePosition);
        });
    }

    destroy() {
        $(Paper.project.view.element).off("wheel");
    }

    zoom(delta, mousePos) {

        const view = Paper.project.view;
        const oldZoom = view.zoom;
        const oldCenter = view.center;

        const viewPos = view.viewToProject(mousePos);
        let newZoom = delta > 0
            ? view.zoom * this.factor
            : view.zoom / this.factor;
        if (newZoom <= 1) {
            newZoom = 1;
            view.center = {x: this.editor.viewWidth / 2, y: this.editor.viewHeight / 2};
        }
        newZoom = Math.min(newZoom, this.maxZoom);
        if (newZoom != view.zoom) {
            view.zoom = newZoom;
            const zoomScale = oldZoom / newZoom;
            const centerAdjust = viewPos.subtract(oldCenter);
            const offset = viewPos.subtract(centerAdjust.multiply(zoomScale))
                .subtract(oldCenter);
            view.center = view.center.add(offset);
            this.editor.onZoom(newZoom);
        }
    }
}

