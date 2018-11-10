import SseTool from "./SseTool";
import Paper from "paper";
import simplify from "simplify-js";

export default class SsePolygonTool extends SseTool {
    constructor(editor) {
        super(editor);
        this.editingPath = null; // The currently editing path
        this.readyToClose = null; // True if the mouse position makes the polygon ready to close
        this.isDrawing = null; // True if a polygon is being created
        this.snapOther = null; // True if the mouse snap something but the first point of the polygon being created
        this.editingFeature = null; // Plain object to store the new polygon attributes
        this.segmentsFromDivision = new Set(); // Keep segments created on existing polygons to be able to cancel
        this.lastFreePoint = null; // The last point created in sweeping mode
        this.minDistance = 0;
        this.doubleClickTiming = 300;
        this.cursor = "crosshair";
        this.bindCallbacks();
    }

    onMouseDrag(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDrag(event);
        this.editor.zoomPoint = event.point;
        let point = this.editor.keepPointInsideRaster(event.point);
        let localPoint = this.editor.rasterLayer.globalToLocal(point);

        if (this.editingPath) {
            if (!this.lastFreePoint) {
                this.lastFreePoint = localPoint;
                this.editingPath.lastSegment.point = localPoint;
            } else {
                if (localPoint.getDistance(this.lastFreePoint) > 1) {
                    this.editingPath.add(new Paper.Segment(localPoint));
                    this.lastFreePoint = localPoint;
                }
            }
        }
    }

    onMouseMove(event) {
        this.editor.zoomPoint = event.point;
        let point = this.editor.keepPointInsideRaster(event.point);
        let localPoint = this.editor.rasterLayer.globalToLocal(point);

        if (event.modifiers.shift) {
            if (this.editingPath) {
                if (!this.lastFreePoint) {
                    this.lastFreePoint = localPoint;
                    this.editingPath.lastSegment.point = localPoint;
                } else {
                    if (localPoint.getDistance(this.lastFreePoint) > 1) {
                        this.editingPath.add(new Paper.Segment(localPoint));
                        this.lastFreePoint = localPoint;
                    }
                }

            }
        }
        else {
            if (this.editingPath)
            // A flag which indicates that the polygon is ready for closing, i.e. first point snapping + at least 3 vertices
                this.readyToClose =
                    this.editor.hitInfos &&
                    this.editor.hitInfos.type == "point" &&
                    this.editor.hitInfos.polygon == this.editingPath &&
                    this.editor.hitInfos.segment.index == 0 &&
                    this.editingPath.segments.length > 3;

            // Otherwise check if there is something else to snap to
            this.snapOther = !this.readyToClose && this.editor.hitInfos && this.editor.hitInfos.type != "polygon";

            if (this.readyToClose) {
                this.editingPath.lastSegment.point = this.editingPath.firstSegment.point;
                this.editor.snap(this.editingPath.firstSegment.point, "red", "square", this.editingPath.firstSegment);

            }
            else if (this.snapOther) {
                localPoint = this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point);
                if (this.editor.hitInfos.type == "line")
                    this.editor.snap(localPoint, "white", "circle", this.editor.hitInfos.segment);
                else
                    this.editor.snap(localPoint, "red", "square", this.editor.hitInfos.segment);
            } else {
                this.editor.unsnap();
            }

            if (this.readyToClose) {

            } else if (this.editingPath) {
                this.editingPath.lastSegment.point = localPoint;
            }

            if (this.editingPath && this.editingPath.lastSegment) {
                this.editor.pendingSegment = this.editingPath.lastSegment;
            }
        }
    }

    cancel(fullCancel) {
        if (!this.editingPath) {
            return;
        }
        if (fullCancel) {
            if (this.editingPath)
                this.editingPath.remove();
            this.isDrawing = this.readyToClose = false;
            this.editor.pendingSegment = this.editor.pathToFollowInfos = this.editor.newPath = this.editingPath = null;
        } else {
            if (this.editingPath.segments.length == 2) {
                this.editor.deletePolygon(this.editingPath);
                this.segmentsFromDivision.forEach(s => s.remove());
                this.segmentsFromDivision.clear();
                this.editingPath = this.editor.pathToFollowInfos = this.editor.newPath = this.editingPoint = this.editingFeature = null;
                this.readyToClose = this.isDrawing = this.snapOther = false;
                this.editor.updateGeometry(false);
            } else {
                this.editingPath.lastSegment.previous.remove();
            }
            this.editor.updateCommands();
        }
    }

    onKeyDown(e) {
        if (e.key == "enter" && this.editingPath && this.editingPath.segments.length > 3) {
            this.endPolygon();
            e.preventDefault();
        }
    }

    onMouseUp(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewUp(event);
        this.editor.updateCommands();
        if (this.readyToClose && this.lastMouseUp && new Date().getTime() - this.lastMouseUp < this.doubleClickTiming) {
            this.endPolygon();
        } else {
            this.lastMouseUp = new Date().getTime();
        }
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
            if (this.editor.hitInfos && this.editor.hitInfos.type == "line") {
                const newSegment = this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
                this.segmentsFromDivision.add(newSegment);
                this.editor.updateGeometry(true);
            }

            this.editingPath.add(point);

            this.editor.updatePathFollowingInfos(this.editingPath);
        } else {
            // First point of the polygon
            this.editingFeature = {classIndex: this.editor.activeClassIndex, polygon: []};
            this.editingPath = new Paper.Path();
            this.editor.initPathProperties(this.editingPath);
            this.editor.newPath = this.editingPath;
            this.editor.newPath.fillColor = null;
            this.editor.newPath.strokeColor = "red";
            this.editor.newPath.selectedColor = "red";

            this.editingPath.fullySelected = true;

            if (this.editor.hitInfos && this.editor.hitInfos.type == "line") {
                const newSegment = this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
                this.segmentsFromDivision.add(newSegment);
            }
            // Two points: One for the polygon, one as a pending point for editing
            this.editingPath.add(point);
            this.editingPath.add(point);
            this.isDrawing = true;
        }
        this.editor.updateCommands();
    }

    copyFeature(feature) {
        return {classIndex: feature.classIndex, polygon: feature.polygon.concat(), layer: feature.layer};
    }

    endPath(newPath, feature) {
        if (!newPath)
            return;

        feature.layer = this.editor.layerIndex;
        newPath.closed = true;

        let simplifiedPoints;
        if (newPath.segments.length < 10 || newPath.bounds.width < 10 || newPath.bounds.height < 10)
            simplifiedPoints = newPath.segments.map(s => s.point);
        else
            simplifiedPoints = simplify(newPath.segments.map(s => s.point), 0.5, true);
        newPath.removeSegments();
        newPath.addSegments(simplifiedPoints);

        this.editor.unsnap();
        feature = this.copyFeature(feature);
        feature.path = newPath;
        newPath.feature = feature;
        this.segmentsFromDivision.clear();
        this.editor.currentSample.objects.push(feature);
    }

    endPolygon() {
        if (!this.editingPath)
            return;
        this.editingPath.fullySelected = false;
        this.editingPath.lastSegment.remove();
        this.editingPath.closed = true;
        let simplifiedPoints;
        if (this.editingPath.segments.length < 10 || this.editingPath.bounds.width < 10 || this.editingPath.bounds.height < 10)
            simplifiedPoints = this.editingPath.segments.map(s => s.point);
        else
            simplifiedPoints = simplify(this.editingPath.segments.map(s => s.point), 0.5, true);
        this.editingPath.removeSegments();
        this.editingPath.addSegments(simplifiedPoints);

        this.editor.unsnap();
        this.editor.setColor(this.editingPath, this.editor.activeColor);
        let all = this.editingPath.resolveCrossings();
        const toSelect = new Set();
        if (all.children) {
            all.feature = this.editingFeature;
            this.editor.flattenNonSimplePath(all);
            all.children.forEach(pa => {
                toSelect.add(pa);
                this.endPath(pa, this.editingFeature);
            });

        } else {
            toSelect.add(all);
            this.endPath(all, this.editingFeature);
        }
        this.editor.clearActualSelection();
        this.editor.setActualSelectionAsync(Array.from(toSelect));

        this.editor.fixOrderingForOneItem();
        this.editor.updateGeometry(false);
        this.editor.updateCommands();
        this.editor.saveData();
        this.isDrawing = this.readyToClose = false;
        this.editor.pendingSegment = this.editor.pathToFollowInfos = this.editor.newPath = this.editingPath = null;
    }


}