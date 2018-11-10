import SseTool from "./SseTool";
import Paper from "paper";
import simplify from "simplify-js";
import SseGlobals from "../../../common/SseGlobals";

export default class SseCutTool extends SseTool {

    constructor(editor) {
        super(editor);
        this.minDistance = 0;
        this.segmentsFromDivision = new Set(); // Keep segments created on existing polygons to be able to cancel
        this.fromSegment = null;
        this.toSegment = null;
        this.adjustedPolygon = null;
        this.bindCallbacks();
    }

    avoidCrossings() {
        if (this.editor.selectorPath.getCrossings(this.editor.selectorPath).length > 0) {
            this.cancel();
            return true;
        }
        return false;
    }

    onMouseDown(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDown(event);
        const pointHit = this.editor.hitInfos && (this.editor.hitInfos.type == "point" || this.editor.hitInfos.type == "line");
        const hitOtherPolygon = pointHit && this.fromSegment && this.fromSegment.path != this.editor.hitInfos.polygon;
        if (!this.editor.selectorPath && !pointHit) {
            this.editor.clearActualSelection();
            this.editor.setActualSelection(this.editor.pendingSelection);
        }

        if (!this.editor.selectorPath && pointHit) {
            // Start
            if (this.editor.hitInfos.type == "point") {
                this.fromSegment = this.editor.hitInfos.segment;
            } else if (this.editor.hitInfos.type == "line") {
                this.fromSegment = this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
                if (!this.fromSegment)
                    return;
                else
                    this.segmentsFromDivision.add(this.fromSegment);
            }

            this.adjustedPolygon = this.fromSegment.path;
            this.editor.frontLayer.activate();
            this.editor.selectorPath = new Paper.Path([this.fromSegment, this.fromSegment]);
            this.editor.selectorPath.strokeColor = "red";
            this.editor.selectorPath.strokeWidth = 2;
            this.editor.selectorPath.strokeScaling = false;
            this.editor.hitExcluded.add(this.editor.selectorPath);
            this.editor.mainLayer.activate();
        } else if (this.editor.selectorPath && (!pointHit || hitOtherPolygon)) {
            let localPoint = this.editor.keepPointInsideRaster(event.point);
            localPoint = this.editor.rasterLayer.globalToLocal(localPoint);
            this.editor.selectorPath.add(localPoint);
            this.avoidCrossings();
        } else if (pointHit) {
            if (this.editor.hitInfos.type == "point") {
                this.toSegment = this.editor.hitInfos.segment;
            } else if (this.editor.hitInfos.type == "line") {
                this.toSegment = this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
                if (!this.toSegment)
                    return;
                else
                    this.segmentsFromDivision.add(this.toSegment);
            }
            this.avoidCrossings();
            this.finalize();
        }

    }

    cancel() {
        this.fromSegment = this.toSegment = this.adjustedPolygon = null;
        this.segmentsFromDivision.forEach(s => s.remove());
        this.segmentsFromDivision.clear();
        if (this.editor.selectorPath) {
            this.editor.hitExcluded.delete(this.editor.selectorPath);
            this.editor.selectorPath.remove();
            this.editor.selectorPath = null;
        }
        this.editor.clearActualSelection();
    }

    onMouseDrag(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDrag(event);
        if (this.editor.selectorPath) {
            let localPoint = this.editor.keepPointInsideRaster(event.point);
            localPoint = this.editor.rasterLayer.globalToLocal(localPoint);
            this.editor.selectorPath.add(localPoint);
            this.avoidCrossings();
        }
    }

    onMouseMove(event) {
        this.editor.zoomPoint = event.point;
        if (this.editor.selectorPath) {
            let localPoint = this.editor.keepPointInsideRaster(event.point);
            if (this.editor.hitInfos && this.editor.hitInfos.point)
                localPoint = this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point);
            else
                localPoint = this.editor.rasterLayer.globalToLocal(localPoint);

            this.editor.selectorPath.lastSegment.point = localPoint;
        } else if (this.editor.hitInfos) {
            this.editor.setPendingSelection([this.editor.hitInfos.polygon]);
            if (this.editor.hitInfos.type == "polygon") {
                SseGlobals.setCursor("pointer");
            } else {
                SseGlobals.setCursor("crosshair");
                this.editor.snap(this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point), "white", "square");
            }
        } else {
            SseGlobals.setCursor("default");
            this.editor.unsnap();
            this.editor.setPendingSelection()
        }
    }

    finalize() {
        if (this.editor.selectorPath) {
            if (this.fromSegment.next == this.toSegment || this.fromSegment.previous == this.toSegment) {
                const artificialPoint = new Paper.Point((this.fromSegment.point.x + this.toSegment.point.x) / 2,
                    (this.fromSegment.point.y + this.toSegment.point.y) / 2);
                this.adjustedPolygon.divideAt(this.adjustedPolygon.getNearestLocation(artificialPoint));
            }

            let cur = this.fromSegment;
            const nextSide = [];
            const previousSide = [];
            while (this.toSegment && cur != this.toSegment.next) {
                nextSide.push(cur);
                cur = cur.next;
            }
            cur = this.fromSegment;
            while (this.toSegment && cur != this.toSegment.previous) {
                previousSide.push(cur);
                cur = cur.previous;
            }
            this.editor.selectorPath.lastSegment.remove();
            nextSide.reverse();
            previousSide.reverse();
            const simplifiedPoints = simplify(this.editor.selectorPath.segments.map(s => s.point), 0.5, true);
            const nextPath = new Paper.Path(simplifiedPoints.concat(nextSide));
            nextPath.closed = true;
            nextPath.strokeColor = "green";
            const previousPath = new Paper.Path(simplifiedPoints.concat(previousSide));
            previousPath.closed = true;
            previousPath.strokeColor = "blue";
            this.adjustedPolygon.removeSegments();
            if (Math.abs(previousPath.area) > Math.abs(nextPath.area)) {
                this.adjustedPolygon.addSegments(previousPath.segments.concat());
            } else {
                this.adjustedPolygon.addSegments(nextPath.segments.concat());
            }
            nextPath.remove();
            previousPath.remove();

            this.cancel();

            this.editor.fullUpdate();
        }
    }
}