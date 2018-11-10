import SseTool from "./SseTool";
import Paper from "paper";
import SseGlobals from "../../../common/SseGlobals";


export default class SsePointerTool extends SseTool {

    constructor(editor) {
        super(editor);
        this.minDistance = 0;
        this.bindCallbacks();
    }

    onKeyDown(event) {
        if (event.key == 'space') {
            this.cancel();
        }
    }

    cancel() {
        if (this.editor.selectorPath) {
            this.editor.selectorPath.remove();
            this.editor.selectorPath = null;
        }
        this.editor.clearActualSelection();
    }


    onMouseDown(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDown(event);


        // A mouse down event could be the beginning of a mouse drag. If it is a mouse drag
        // we don't want to snap to the currently editing feature, so we exclude the selected
        // items
        this.editor.getSelectedPolygons().forEach(path => {
            this.editor.hitExcluded.add(path);
            path.segments.forEach(segment => this.editor.hitExcluded.add(segment))
        });

        if (!this.editor.snapPoint && this.editor.currentSample.objects.length > 0) {
            this.editor.frontLayer.activate();
            const localPoint = this.editor.rasterLayer.globalToLocal(event.point);
            this.editor.selectorPath = new Paper.Path([localPoint]);
            this.editor.selectorPath.strokeColor = "red";
            this.editor.selectorPath.strokeWidth = 2;
            this.editor.selectorPath.strokeScaling = false;

            this.editor.mainLayer.activate();

        }
        // In case of line snapping: we just have a point and no segment
        // so let's divide the destination and create a new segment
        else if (this.editor.snapPoint && !this.editor.snapSegment) {
            this.snappedSegment = this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
            this.editor.updateGeometry(true);
        }
    }

    onMouseDrag(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewDrag(event);
        if (this.snappedSegment) {
            this.editedByDragging = true;
            this.editor.unsnap();
            let point;
            // Check for snapping candidates (points and lines)
            if (this.editor.hitInfos && this.editor.hitInfos.type != "polygon") {
                const shape = this.editor.hitInfos.type == "point" ? "square" : "circle";
                const color = this.editor.hitInfos.type == "point" ? "red" : "white";
                this.editor.snap(this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point), color, shape, this.editor.hitInfos.segment);
                point = this.editor.hitInfos.point;
            }
            else
                point = this.editor.keepPointInsideRaster(event.point);

            // In case of iso-points, gives the ability to separate the currently editing point of other points
            if (event.modifiers.shift) {
                this.snappedSegment.point = this.editor.rasterLayer.globalToLocal(point);
            } else {
                // Move all iso-points together
                if (!this.draggingSegments) {
                    this.draggingSegments = this.editor.isoSegments(this.snappedSegment);
                    this.draggingSegments.forEach(s => this.editor.hitExcluded.add(s));
                }

                this.draggingSegments.forEach((seg) => {
                    seg.point = this.editor.rasterLayer.globalToLocal(point);
                });
            }
        } else if (this.editor.selectorPath) {
            const localPoint = this.editor.rasterLayer.globalToLocal(event.point);
            this.editor.selectorPath.add(localPoint);
        }
        this.editor.drawPointSelection();
    }

    onMouseMove(event) {
        this.editor.zoomPoint = event.point;
        this.editor.unsnap();
        if (this.editor.hitInfos) {
            // Polygon selection through clicking on a polygon or a line
            if (this.editor.hitInfos.type == "polygon" || this.editor.hitInfos.type == "line") {
                this.editor.setPendingSelection([this.editor.hitInfos.polygon]);
                if (this.editor.hitInfos.type == "polygon")
                    SseGlobals.setCursor("pointer");
                else
                    SseGlobals.setCursor("crosshair");

                if (this.draggingSegments)
                    this.draggingSegments.forEach(s => this.editor.hitExcluded.delete(s));
                this.draggingSegments = this.snappedSegment = null;

                if (this.editor.hitInfos.type == "line") {
                    this.editor.snap(this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point), "white", "square");
                }
            }
            // Point pending selection abd snapping
            else if (this.editor.hitInfos.type == "point") {
                this.editor.setPendingSelection([this.editor.hitInfos.segment, this.editor.hitInfos.segment.path]);
                SseGlobals.setCursor("pointer");
                this.editor.snap(this.editor.rasterLayer.globalToLocal(this.editor.hitInfos.point), "red", "square", this.editor.hitInfos.segment);
                this.snappedSegment = this.editor.hitInfos.segment;
            }

            this.candidatePendingPolygon = this.editor.hitInfos.polygon;
        }
        else {
            if (!this.candidatePendingPolygon ||
                !this.candidatePendingPolygon.contains(this.editor.rasterLayer.globalToLocal(event.point))) {
                this.candidatePendingPolygon = null;
                this.editor.setPendingSelection();
                SseGlobals.setCursor("default");
                if (this.draggingSegments)
                    this.draggingSegments.forEach(s => this.editor.hitExcluded.delete(s));
                this.draggingSegments = this.snappedSegment = null;
            }
            else {
                SseGlobals.setCursor("pointer");
            }
        }
    }

    onMouseUp(event) {
        if (!this.isLeftButton(event) || event.modifiers.space)
            return super.viewUp(event);
        this.editor.clearActualSelection();
        if (this.editedByDragging) {
            if (this.editor.hitInfos && this.editor.hitInfos.type == "line") {
                // Line snapping: create a new point on the target polygon
                this.editor.hitInfos.polygon.divideAt(this.editor.hitInfos.location);
            }
            this.editor.updateGeometry(false);
            this.editor.setActualSelectionAsync(this.editor.pendingSelection);
            this.editedByDragging = false;
            this.editor.fullUpdate();
        } else {
            this.editor.setActualSelection(this.editor.pendingSelection);
        }

        if (this.editor.selectorPath) {
            const hitProps = {segments: true, stroke: true, fill: true};
            const bounds = this.editor.selectorPath.bounds;
            const center = this.editor.rasterLayer.localToGlobal(bounds.center);

            hitProps.tolerance = bounds.topLeft.getDistance(bounds.bottomRight) / 2;
            let hittedSegments = Paper.project.hitTestAll(center, hitProps);
            hittedSegments = hittedSegments.filter(i => i.type == "segment" && i.item != this.editor.selectorPath);
            const toSelect = new Set();
            hittedSegments.forEach(seg => {
                let ints = seg.item.getIntersections(this.editor.selectorPath);
                let d1, d2;
                if (ints.length >= 2) {
                    d1 = seg.item.divideAt(ints[0]);
                    d2 = seg.item.divideAt(ints[ints.length - 1]);
                }
                if (!d1 || !d2) {
                    if (this.editor.selectorPath.bounds.contains(seg.item.bounds)) {
                        toSelect.add(seg.item);
                    }
                }
                else {
                    if (d1.index > d2.index) {
                        const d3 = d1;
                        d1 = d2;
                        d2 = d3;
                    }

                    if (this.editor.selectorPath.contains(d1.next.point)) {
                        let p = d1.next;
                        while (p != d2) {
                            if (this.editor.selectorPath.contains(p.point))
                                toSelect.add(p);
                            p = p.next;
                        }
                    } else {
                        let p = d1.previous;
                        while (p != d2) {
                            if (this.editor.selectorPath.contains(p.point))
                                toSelect.add(p);
                            p = p.previous;
                        }
                    }

                    d1.remove();
                    d2.remove();
                }
            });
            if (toSelect.size > 0) {
                Array.from(toSelect).map(itm => {
                    if (itm.path)
                        toSelect.add(itm.path)
                });
                this.editor.setActualSelection(Array.from(toSelect));
            }
            this.editor.selectorPath.remove();
            this.editor.selectorPath = null;
        }
        this.editor.hitExcluded.clear();
        this.editor.updateCommands();
    }
}