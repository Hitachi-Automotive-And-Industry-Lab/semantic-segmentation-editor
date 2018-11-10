import SseTool from "./SseTool";
import Paper from "paper";
import MagicWand from "./magicwand"
import simplify from "simplify-js";
import SseMsg from "../../../common/SseMsg";

export default class SseFloodTool extends SseTool {

    constructor(editor) {
        super(editor);
        this.colorThreshold = 15;
        this.blurRadius = 5;
        this.imageInfo = null;
        this.mask = null;
        this.downPoint = null;
        this.polygon = null;
        SseMsg.register(this);
        this.onMsg("flood-properties", (arg) => {
            this.colorThreshold = arg.threshold;
            this.blurRadius = arg.blurRadius;
            this.process();
        });
        this.cursor = "crosshair";
        this.bindCallbacks();
    }

    initCanvas(img) {
        const cvs = document.getElementById("filterCanvas");
        const cvs2 = document.getElementById("rasterCanvas");
        this.imageInfo = {
            width: img.width,
            height: img.height,
            context: cvs.getContext("2d"),
            context2: cvs2.getContext("2d")
        };
        this.mask = null;

        const tempCtx = document.createElement("canvas").getContext("2d");
        tempCtx.canvas.width = this.imageInfo.width;
        tempCtx.canvas.height = this.imageInfo.height;
        tempCtx.drawImage(img, 0, 0);
        this.imageInfo.data = tempCtx.getImageData(0, 0, this.imageInfo.width, this.imageInfo.height);
    }

    process(pt) {
        if (this.polygon)
            this.polygon.remove();
        if (!pt && this.downPoint)
            pt = this.downPoint;
        else if (!pt && !this.downPoint)
            return;
        pt.x = Math.round(pt.x);
        pt.y = Math.round(pt.y);
        this.downPoint = pt;
        this.flood(this.downPoint.x, this.downPoint.y, this.colorThreshold, this.blurRadius);
    }

    setColor(path) {
        path.strokeColor = "red";
        path.strokeWidth = 2;
        path.strokeScaling = false;
    }

    baseLayer() {
        return (this.editor.mainLayer.children.length == 0 || this.editor.mainLayer.children.filter(x => x.visible).length == 0) ? this.editor.mainLayer : this.editor.frontLayer;
    }

    flood(x, y, thr, rad) {
        if (!this.imageInfo) return;
        const image = {
            data: this.imageInfo.data.data,
            width: this.imageInfo.width,
            height: this.imageInfo.height,
            bytes: 4
        };

        this.mask = MagicWand.floodFill(image, x, y, thr);
        this.mask = MagicWand.gaussBlurOnlyBorder(this.mask, rad);
        let cs = MagicWand.traceContours(this.mask);

        cs = cs.filter(x => !x.inner);
        if (cs[0]) {
            let pts = cs[0].points;
            pts = pts.map(pt => ({x: pt.x + .5, y: pt.y + .5}));
            pts = simplify(pts, 1, true);

            this.baseLayer().activate();

            this.polygon = new Paper.Path(pts);
            this.polygon.closed = true;
            let ips = this.editor.geom.findIntersectingPolygons(this.polygon);
            if (ips) {
                let res = this.polygon.subtract(ips[0]);
                if (res.children && res.segments == null) {
                    // Compound Path not supported
                    res.remove();
                } else {
                    this.setColor(res);
                    //this.editor.frontLayer.addChild(res)
                    this.polygon.remove();
                    this.polygon = res;
                }
            }

            this.editor.mainLayer.activate();
            this.setColor(this.polygon);
            this.editor.newPath = this.polygon;
            this.editor.updateCommands();

        }
    }
    ;

    setImageData(imageData) {
        if (this.polygon)
            this.polygon.remove();
        this.imageInfo.data = imageData;
        this.process();
    }



    onMouseMove(event) {
        this.editor.zoomPoint = event.point;
    }

    onMouseDown(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDown(event);
        const pt = this.baseLayer().globalToLocal(event.point);
        this.process(pt);

    }


    onKeyDown(e) {
        if (e.key == "enter") {
            this.endPolygon();
            e.preventDefault();
        }
    }

    onMouseDrag(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDrag(event);
        const pt = this.baseLayer().globalToLocal(event.point);
        this.process(pt);

    }

    onMouseUp(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewUp(event);
    }

    endPolygon() {
        if (this.polygon) {
            const feature = {classIndex: this.editor.activeClassIndex, polygon: []};
            this.polygon.feature = feature;
            feature.path = this.polygon;
            feature.layer = this.editor.layerIndex;
            this.polygon.remove();
            this.polygon.strokeWidth = 1;
            this.editor.setColor(this.polygon, this.editor.activeColor);
            this.editor.setSelectedColor(this.polygon);
            this.editor.mainLayer.addChild(this.polygon);
            this.editor.clearActualSelection();
            this.editor.setActualSelectionAsync([this.polygon]);
            this.downPoint = this.editor.newPath = this.polygon = this.feature = null;
            this.editor.fixOrderingForOneItem();
            this.editor.fullUpdate();
            this.sendMsg("flood-properties", {threshold: 15, blurRadius: 5});
        }
    }

    cancel() {
        if (this.polygon)
            this.polygon.remove();
        this.editor.newPath = this.polygon = this.feature = null;
    }
}