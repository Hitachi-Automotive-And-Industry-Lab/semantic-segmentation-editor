import SseTool from "./SseTool";
import Paper from "paper";

export default class SseRectangleTool extends SseTool {

    constructor(editor) {
        super(editor);
        this.editingPath = null; // The path currently created
        this.editingPoint = null; // The second point for defining a rectangle
        this.isDrawing = null; // True if a polygon is being created
        this.snapOther = null; // True if the mouse snap something but the first point of the polygon being created
        this.editingFeature = null; // Plain object to store the new polygon attributes
        this.minDistance = 0;
        this.cursor = "crosshair";
        this.bindCallbacks();
    }


    cancel() {
        if (!this.editingPath) {
            return;
        }

        this.editor.deletePolygon(this.editingPath);

        this.editingPath = this.editor.newPath = this.editingPoint = this.editingFeature = null;
        this.isDrawing = this.snapOther = false;
        this.editor.updateGeometry(false);
        this.editor.updateCommands();
    }

    onMouseMove(event) {
        this.editor.zoomPoint = event.point;
        let point = this.editor.keepPointInsideRaster(event.point);
        let localPoint = this.editor.rasterLayer.globalToLocal(point);


        this.snapOther = this.editor.hitInfos && this.editor.hitInfos.type != "polygon";

        if (this.snapOther) {
            localPoint = this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point);
            if (this.editor.hitInfos.type == "line")
                this.editor.snap(localPoint, "white", "circle", this.editor.hitInfos.segment);
            else
                this.editor.snap(localPoint, "white", "square", this.editor.hitInfos.segment);
        } else {
            this.editor.unsnap();
        }

        if (this.editingPath) {
            this.editingPath.segments[1].point.x = localPoint.x;
            this.editingPath.segments[2].point.x = localPoint.x;
            this.editingPath.segments[2].point.y = localPoint.y;
            this.editingPath.segments[3].point.y = localPoint.y;
        }
        if (this.editingPath && this.editingPath.lastSegment) {
            this.editor.pendingSegment = this.editingPath.lastSegment;
        }
    }

    onMouseDrag(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDrag(event);
    }

    onMouseUp(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewUp(event);
    }

    onMouseDown(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDown(event);
        let point;
        if (this.editor.snapIndicator) {
            point = this.editor.snapPoint;
        }
        else
            point = this.editor.rasterLayer.globalToLocal(this.editor.keepPointInsideRaster(event.point));

        if (this.isDrawing) {
            this.endRectangle()
        } else {
            // First point of the rectangle
            this.editingFeature = {classIndex: this.editor.activeClassIndex, polygon: []};
            this.editingPath = new Paper.Path();
            this.editor.initPathProperties(this.editingPath);
            this.editingPath.fullySelected = true;
            this.editor.setColor(this.editingPath, this.editor.activeColor);
            if (this.editor.hitInfos && this.editor.hitInfos.type == "line") {
                this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
                this.editor.updateGeometry(true);
            }

            this.editingPath.add(point);
            this.editingPath.add(point);
            this.editingPath.add(point);
            this.editingPath.add(point);
            this.editingPath.closed = true;
            this.isDrawing = true;

        }
    }

    endRectangle() {
        this.editor.setActualSelectionAsync([this.editingPath]);
        //this.editingPath.fullySelected = false;
        this.editor.unsnap();
        this.editingFeature.path = this.editingPath;
        this.editingPath.feature = this.editingFeature;
        this.editingFeature.layer = this.editor.layerIndex;
        this.editingPath = null;
        this.editor.currentSample.objects.push(this.editingFeature);
        this.isDrawing = false;
        this.editor.pendingSegment = null;
        this.editor.fixOrderingForOneItem();
        this.editor.saveData();
        this.editor.updateGeometry(false);
        this.editor.clearActualSelection();

    };

}