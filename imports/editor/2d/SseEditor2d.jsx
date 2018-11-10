import React from 'react';
import Paper from "paper";
import {withTracker} from 'meteor/react-meteor-data';
import url from "url";
import SseGeometry from "./SseGeometry";
import SsePointerTool from "./tools/SsePointerTool"
import SseCutTool from "./tools/SseCutTool";
import SsePolygonTool from "./tools/SsePolygonTool";
import SseRectangleTool from "./tools/SseRectangleTool";
import SseFloodTool from "./tools/SseFloodTool";
import ImageFilters from "canvas-filters";
import SseUndoRedo2d from "./SseUndoRedo2d";
import SseZoom from "./SseZoom.js";
import FileSaver from "file-saver";
import SseMsg from "../../common/SseMsg";


export default class SseEditor2d extends React.Component {
    constructor(props) {
        super();
        SseMsg.register(this);
        // Highlighted items on mouse hovering (Paths and Segments)
        this.pendingSelection = [];
        // Selected items on mouse click (Paths and Segments)
        this.actualSelection = [];

        // The active set of classes
        this.activeSoc = null;

        // A set of Items excluded from hit test.
        // For example to avoid snapping on the currently editing feature
        this.hitExcluded = new Set();
        // The opacity of polygons
        this.mainLayerOpacity = 0.75;
        this.layerIndex = 0;
        this.hiddenLayers = new Set();

        this.undoRedo = new SseUndoRedo2d(this.cloningDataFunction);
        this.pointIndicators = new Set();
        this.initialized = false;
        window.onerror = (errorMsg, url, lineNumber) => {
            this.sendMsg("alert", {message: errorMsg});//or any message
            return false;
        };
    }

    /**
     * Compute geometrical characteristics related to the loading image
     */
    resizeCanvas() {

        const canvasContainer = $('#canvasContainer').get(0);
        if (!canvasContainer || !this.raster)
            return;
        this.viewWidth = canvasContainer.offsetWidth;
        this.viewHeight = canvasContainer.offsetHeight;
        Paper.project.view.viewSize = new Paper.Size(this.viewWidth, this.viewHeight);

        if (this.viewZoom) {
            this.viewZoom.destroy();
        }

        this.viewZoom = new SseZoom(this);

        const viewRatio = this.viewWidth / this.viewHeight;
        const bitmapRatio = this.imageWidth / this.imageHeight;

        let scaleFactor;

        const gutterRatio = .98;
        if (viewRatio < bitmapRatio) {
            scaleFactor = gutterRatio * canvasContainer.offsetWidth / this.imageWidth;
        }
        else {
            scaleFactor = gutterRatio * canvasContainer.offsetHeight / this.imageHeight;
        }

        this.offsetX = (this.viewWidth - scaleFactor * this.imageWidth) / 2;
        this.offsetY = (this.viewHeight - scaleFactor * this.imageHeight) / 2;

        this.sendMsg("zoomLevel", {value: Math.round(scaleFactor * 100) / 100});

        // zoomPoint keeps the mouse position on every mouse moves to be able to zoom to the
        // right position on mouse wheel events
        this.zoomPoint = new Paper.Point(this.viewWidth / 2, this.viewHeight / 2);

        // The scaling factor computed to display the whole image using the available room of the view
        this.scaleFactor = scaleFactor;
        const fullScreenMatrix = new Paper.Matrix().translate(this.offsetX, this.offsetY).scale(scaleFactor);
        this.transformAllLayers(fullScreenMatrix);
        this.disableSmoothing();
    }

    /**
     * This function returns always a point in the image to avoid drawing outside of the image
     * @param pt The original point that can be outside of the image
     * @returns {Paper.Point} The original point if inside the image,
     * the nearest point in the image otherwise
     */
    keepPointInsideRaster(pt) {
        const
            x = this.offsetX,
            y = this.offsetY,
            w = this.imageWidth * this.scaleFactor,
            h = this.imageHeight * this.scaleFactor;
        let px = pt.x, py = pt.y;

        if (px < x)
            px = x;
        else if (px > x + w)
            px = x + w;
        if (py < y)
            py = y;
        else if (py > y + h)
            py = y + h;

        return new Paper.Point(px, py);
    }

    deletePolygon(path) {
        this.currentSample.objects.splice(path.index, 1);
        path.remove();
        this.saveData();
        this.updateGeometry(false);
        path = null;
        this.clearActualSelection();
        this.updateCommands();
    }

    /**
     * Add points to the currently editing path to workaround an existing polygon
     */
    followPath() {
        if (this.pathToFollowInfos) {
            const infos = this.pathToFollowInfos;
            infos.index++;
            if (infos.index < infos.polylines.length) {
                this.drawPathFollowingGraphics();
            } else {
                infos.index = -1;
                this.undoPathFollowingGraphics();
            }
        }
    }

    mergePath() {

        if (this.selectedIntersections) {
            if (this.selectedIntersections.size > 1) {
                this.sendMsg("alert", {message: "Click on a polygon that overlaps the selected polygon."});
                this.mergingFirstPath = this.getFirstSelectedPolygon();
            } else {
                const other = this.selectedIntersections.values().next().value;
                const me = this.getFirstSelectedPolygon();
                this.mergePaths(me, other);
            }
        }
        this.sendMsg("pointer");
    }

    mergePaths(p1, p2) {
        const newPath = p1.unite(p2, {insert: false});
        if (newPath.segments) {
            this.mainLayer.addChild(newPath);
            p1.remove();
            p2.remove();
            newPath.feature = p1.feature;
            p1.feature.path = newPath;
            this.mergingFirstPath = null;
            this.setActualSelection([newPath]);
            this.fullUpdate();
        } else {
            this.sendMsg("alert", {message: "Merging cancelled: The resulting polygon can not contain hole(s)."})
        }
    }


    /**
     * Look for a pre-existing path to stick to during polygon creation
     * @param path
     */
    updatePathFollowingInfos(path) {
        if (path.segments.length < 3)
            return;
        const geom = this.geom;
        const pre = path.segments[path.segments.length - 3];
        const last = path.segments[path.segments.length - 2];
        const polylines = geom.findPath(pre, last);
        if (polylines.length > 0) {
            this.pathToFollowInfos = {index: -1, polylines: polylines, p1: pre.point, p2: last.point};

        } else {
            this.pathToFollowInfos = null;

        }
        this.updateCommands();
    }

    updateCommands() {
        if (this.newPath && this.newPath.segments.length > 3)
            this.sendMsg("enableCommand", {name: "enterCommand"});
        else
            this.sendMsg("disableCommand", {name: "enterCommand"});

        if (this.pathToFollowInfos)
            this.sendMsg("enableCommand", {name: "followCommand"});
        else
            this.sendMsg("disableCommand", {name: "followCommand"});

        if (this.actualSelection.length > 0)
            this.sendMsg("enableCommand", {name: "deleteCommand"});
        else
            this.sendMsg("disableCommand", {name: "deleteCommand"});

        if (this.selectedIntersections) {
            const sp = this.getSelectedPolygons()[0];
            const up = Array.from(this.selectedIntersections).some(p => sp.isBelow(p));
            const dw = Array.from(this.selectedIntersections).some(p => sp.isAbove(p));

            if (up)
                this.sendMsg("enableCommand", {name: "upCommand"});
            else
                this.sendMsg("disableCommand", {name: "upCommand"});
            if (dw)
                this.sendMsg("enableCommand", {name: "downCommand"});
            else
                this.sendMsg("disableCommand", {name: "downCommand"});
            this.sendMsg("enableCommand", {name: "mergeCommand"});
        }
        else {
            this.sendMsg("disableCommand", {name: "upCommand"});
            this.sendMsg("disableCommand", {name: "downCommand"});
            this.sendMsg("disableCommand", {name: "mergeCommand"});
        }
    }

    undoPathFollowingGraphics() {
        const removeSegments = (arr) => arr.forEach(s => s.remove());
        removeSegments(this.pathToFollowInfos.addedSegments);
    }

    drawPathFollowingGraphics() {
        const path = this.newPath;
        const infos = this.pathToFollowInfos;
        const removeSegments = (arr) => arr.forEach(s => s.remove());
        const addSegments = (polyline) => {
            infos.addedSegments = [];
            polyline.forEach(p => {
                const seg = new Paper.Segment(p);
                path.insert(path.segments.length - 2, seg);
                infos.addedSegments.push(seg);
            });
        };

        if (infos) {
            if (!infos.drawn) {
                addSegments(infos.polylines[infos.index]);
                infos.drawn = true;
            } else {
                removeSegments(infos.addedSegments);
                addSegments(infos.polylines[infos.index]);
            }
        }
    }

    /**
     * Common path properties
     * @param path
     */
    initPathProperties(path) {
        path.strokeWidth = 1;
        path.strokeScaling = false;
        path.strokeJoin = "round";
        path.blendMode = "normal";
        path.selectedColor = "white";
    }

    /**
     * The pending selection is a set of Items currently mouse hovered
     * @param itemsArray
     */
    setPendingSelection(itemsArray) {
        if (this.visibleStrokes)
            return;
        this.pendingSelection.forEach((ft) => {
            if (this.actualSelection.indexOf(ft) == -1) {
                ft.fullySelected = false;
            }
        });
        this.pendingSelection = [];
        if (itemsArray) {
            itemsArray.forEach((feat) => {
                this.pendingSelection.push(feat);
                feat.fullySelected = true;
            });
        }
    }

    /**
     * Create a visual indicator for the currently selected point
     * @param segment
     */
    drawPointSelection() {
        const segments = this.getSelectedPoints();
        if (this.pointIndicators) {
            this.pointIndicators.forEach(pi => pi.remove());
            this.pointIndicators.clear();
        }

        if (segments.length > 0) {
            this.frontLayer.activate();
            const l = 4 / (Paper.view.zoom * this.scaleFactor);
            segments.forEach(s => {
                const pt = s.point;
                const pointIndicator = new Paper.Path.Circle(new Paper.Point(pt.x, pt.y), l);
                this.pointIndicators.add(pointIndicator);
                // new Paper.Point(pt.x + l, pt.y + l));
                pointIndicator.fillColor = "red";
            });
            this.mainLayer.activate();
        }
    }

    get activeColor() {
        return this.activeSoc.colorForIndexAsHex(this.activeClassIndex);
    }

    setActualSelectionAsync(arr) {
        setTimeout(() => {
            this.setActualSelection(arr);
        }, 0);
    }

    /**
     * The actual selection is a set of items the user clicked on It contains a polygon and an optional point,
     * a point is always selected with its hosting polygon)
     * @param arr
     */
    setActualSelection(arr) {
        this.actualSelection = arr;
        this.drawPointSelection();
        this.actualSelection.forEach(item => {
            //if (item.point)
            //    this.drawPointSelection();
            //else
            if (item.segments) {
                item.selectedColor = "red";
                item.strokeWidth = 3;
                item.fullySelected = true;
            }
        });

        const first = this.getFirstSelectedPolygon();
        if (first) {
            const feature = first.feature;
            if (feature.layer == undefined)
                feature.layer = 0;

            this.sendMsg("classSelection", {descriptor: this.activeSoc.descriptorForIndex(feature.classIndex)});
            this.selectedIntersections = this.geom.getIntersections(first);

            if (this.mergingFirstPath) {
                if (this.mergingFirstPath != first && this.geom.getIntersections(first)) {
                    this.mergePaths(this.mergingFirstPath, first);
                }
                else {
                    this.sendMsg("alert", {message: "Merging cancelled: the polygons don't intersect."});
                }
                this.mergingFirstPath = null;
            }
        }

        this.setPendingSelection();
        this.updateCommands();
        this.sendMsg("sse-polygon-select", {polygon: first});
    }

    clearActualSelection() {
        if (this.visibleStrokes)
            return;
        this.actualSelection.forEach((ft) => {
            ft.selectedColor = "white";
            ft.strokeWidth = 1;
            ft.fullySelected = false;
        });
        this.selectionSegment = null;
        this.drawPointSelection();
        this.actualSelection = [];
        this.selectedIntersections = null;
        this.updateCommands();
        this.sendMsg("sse-polygon-select", null);
    }


    /**
     * Persists the data on the server
     */
    saveData(ignoreUndo) {
        this.updateLayers();
        this.currentSample.socName = this.activeSoc.name;
        this.setCurrentSample(this.cloningDataFunction(this.currentSample));
        this.currentSample.objects = [];
        this.cleanupGraphicsHierarchy();


        this.mainLayer.children.forEach((path) => {
            const polygon = path.segments.map(
                (seg) => {
                    const p = seg.point;
                    return {
                        x: p.x, y: p.y
                    };
                });

            const p1 = polygon[0], p2 = polygon[polygon.length - 1];
            if (p1.x == p2.x && p1.y == p2.y) {
                polygon.pop();
            }

            path.polygon = polygon;


            this.currentSample.objects.push({
                classIndex: path.feature.classIndex,
                layer: path.feature.layer,
                polygon: path.polygon
            });
        });

        //if (!this.currentSample.objects.length) debugger;
        Meteor.call("saveData", this.currentSample);
        setTimeout(() => {
            this.updateStats();
        }, 10);

        if (!ignoreUndo) {
            this.undoRedo.pushState(this.currentSample);
        }
    }

    /**
     * Snap to an existing point of segment
     * @param pt The (x,y) point to snap to
     * @param color The color of the snapping indicator
     * @param shape "square" or "circle"
     * @param segment An optional segment belonging to the snapping point, null in case of
     * line snapping
     */
    snap(pt, color = "white", shape = "square", segment) {
        // No argument: redraw the current snapping indicator (on a zoom action for example)
        if (pt == undefined && this.snapPoint) {
            this.snapIndicator.remove();
            this.snap(this.snapPoint, this.snapColor);
        }
        else if (pt) {
            if (this.snapIndicator)
                this.snapIndicator.remove();
            // The snapping indicator is drawn on top of polygons
            this.frontLayer.activate();
            // Adjust the size of the snapping indicator according to the zoom level
            const l = (color == "red" ? 4 : 2) / (Paper.view.zoom * this.scaleFactor);

            if (shape == "square") {
                this.snapIndicator = new Paper.Path.Rectangle(
                    new Paper.Point(pt.x - l, pt.y - l),
                    new Paper.Point(pt.x + l, pt.y + l));
            } else if (shape == "circle") {
                this.snapIndicator = new Paper.Path.Circle(pt, l);
            }
            this.snapIndicator.strokeScaling = false;
            this.snapIndicator.fillColor = color;
            this.snapIndicator.strokeColor = null;
            this.mainLayer.activate();
        }
        if (pt != undefined) {
            this.snapPoint = pt;
            this.snapColor = color;
            this.snapSegment = segment;
        }
    }

    /**
     * Remove the current snapping indicator and attributes
     */
    unsnap() {
        if (this.snapIndicator) {
            this.snapIndicator.remove();
            delete this.snapIndicator;
            this.snapPoint = null;
            this.snapColor = null;
            this.snapSegment = null;
        }
    }

    /**
     * Apply the zoom/pan transformation to all layers
     * @param mat
     */
    transformAllLayers(mat) {
        // return;
        this.rasterLayer.matrix = mat;
        this.frontLayer.matrix = mat;
        this.mainLayer.matrix = mat;
        this.debugLayer.matrix = mat;
    }

    /**
     * Draws the annotations retrieved from the server
     */
    drawAnnotations() {
        this.mainLayer.activate();
        this.mainLayer.removeChildren();
        this.currentSample.objects.forEach((feature) => {
            const pts = feature.polygon.map((pt) => {
                return new Paper.Point(pt.x, pt.y)
            });

            const path = new Paper.Path(pts);
            this.initPathProperties(path);
            feature.path = path;
            path.feature = feature;
            path.closed = true;

            this.setColor(path, this.activeSoc.colorForIndexAsHex(feature.classIndex));
        });
        this.updateGeometry(false);
        this.disableComposition();
        this.enableComposition();
    }

    repaint() {
        this.mainLayer.activate();
        this.mainLayer.children.forEach((path) => {
            this.setColor(path, this.activeSoc.colorForIndexAsHex(path.feature.classIndex));
        });
    }

    fixOrderingForOneItem() {
        //debugger;
        let cursorItem, end, items = this.mainLayer.children.concat();
        items.some(item => {
            if (!cursorItem)
                cursorItem = item;
            else {
                if ((item.feature.layer || 0) < (cursorItem.feature.layer || 0)) {
                    item.moveBelow(cursorItem);
                    end = true;
                    return true;
                } else if ((item.feature.layer || 0) > (cursorItem.feature.layer || 0)) {
                    cursorItem = item;
                }
            }
        });
        if (!end) {
            items.reverse().some(item => {
                if (!cursorItem)
                    cursorItem = item;
                else {
                    if ((item.feature.layer || 0) > (cursorItem.feature.layer || 0)) {
                        item.moveFront(cursorItem);
                        return true;
                    } else if ((item.feature.layer || 0) < (cursorItem.feature.layer || 0)) {
                        cursorItem = item;
                    }
                }
            });
        }
    }

    updateGeometry(ignoreLastPolygon) {
        const start = new Date().getTime();
        this.cleanupGraphicsHierarchy();
        this.geom = new SseGeometry(this.mainLayer.children, ignoreLastPolygon);
        this.geom.computePolygonsIntersections();
        // console.log("Geometry updated in", (new Date().getTime() - start) + "ms")
    }

    cleanupGraphicsHierarchy() {
        this.mainLayer.children.forEach(pol => {
            let rc = pol.resolveCrossings();
            rc.feature = pol.feature;
            this.flattenNonSimplePath(rc)
        });
        this.mainLayer.children.forEach(pol => {
            if (pol.bounds.width < 2 || pol.bounds.height < 2 || pol.bounds.area < 10) {
                pol.remove();
            }
        });
    }

    flattenNonSimplePath(rpath) {
        if (rpath.children) {
            rpath.children.concat().forEach(npath => {
                npath.fillColor = rpath.fillColor;
                npath.strokeColor = rpath.strokeColor;
                npath.strokeWidth = rpath.strokeWidth;
                npath.selectedColor = rpath.selectedColor;
                npath.strokeScaling = rpath.strokeScaling;
                npath.feature = {classIndex: rpath.feature.classIndex, layer: rpath.feature.layer, polygon: []};
                this.mainLayer.addChild(npath);
                npath.fullySelected = false;
            });
            rpath.remove();
            this.clearActualSelection();
        }
    }

    /**
     * Set the color of a polygon depending on the current composition mode
     * @param path
     * @param color
     */
    setColor(path, color) {
        if (this.disabledComposition) {
            path.strokeColor = color;
            path.fillColor = null;

        } else {
            path.fillColor = color;
            path.strokeColor = "white"
        }
    }

    setSelectedColor(path) {
        path.selectedColor = "red";
    }


    /**
     *  Enables alpha composition of layers
     */
    enableComposition(hideStroke) {
        //return this.disableComposition();
        if (this.disabledComposition) {
            this.disabledComposition = false;
            this.mainLayer.getChildren().forEach((path) => {
                if (!this.newPath || this.newPath != path) {
                    path.fillColor = path.strokeColor;
                    if (!hideStroke)
                        path.strokeColor = "white";
                }

            });
            /*
            if (this.newPath) {
                this.newPath.fillColor = this.newPath.strokeColor;
                this.newPath.strokeColor = "white";
            }
            */
            this.mainLayer.opacity = this.mainLayerOpacity;
        }
    }

    /**
     *  Disables alpha composition of layers
     */
    disableComposition() {

        if (!this.disabledComposition) {
            this.disabledComposition = true;
            this.mainLayer.getChildren().forEach((path) => {
                if (!this.newPath || this.newPath != path) {
                    path.strokeColor = path.fillColor;
                    path.fillColor = null;
                }
            });
            /*
            if (this.newPath) {
                this.newPath.strokeColor = this.newPath.fillColor;
                this.newPath.fillColor = null;
            }
            */
            this.mainLayer.opacity = 1;

        }
    }

    onZoom(zoomLvl) {
        if (zoomLvl > 5) {
            this.disableComposition();
        } else {
            this.enableComposition();
        }

        this.sendMsg("zoomLevel", {value: Math.round(100 * zoomLvl * this.scaleFactor) / 100});
        this.zoomLevel = zoomLvl;
        this.snap();
        this.drawPointSelection();
    }

    getFirstSelectedPolygon() {
        const sps = this.getSelectedPolygons();
        if (sps.length > 0)
            return sps[0];
    }

    getSelectedPolygons() {
        return this.actualSelection.filter(element => !element.point);
    }

    getSelectedPoints() {
        return this.actualSelection.filter(element => element.point);
    }

    isoSegments(segment) {
        return this.geom.isoSegments(segment);
    }

    /**
     * Global hit testing functions used by all the tools. It is affected by this.hitExcluded, this.pendingSegment,
     * and this.isoMap.
     * @param event
     */
    hitTesting(event) {
        const matchFunction = (ht) => {
            // Rejected hits: pixels, snap indicator and point indicator
            let accept = ht.type != "pixel" &&
                ht.item != this.snapIndicator &&
                !this.pointIndicators.has(ht.item) &&
                !this.hitExcluded.has(ht.item) &&
                ht.item.layer != this.debugLayer;

            // Point snapping: tests if the hitting segment is excluded
            if (accept && ht.segment) {
                accept = accept && !this.hitExcluded.has(ht.segment);
            }

            if (accept && this.pendingSegment)
            // Rejects first point snapping if not a polygon with at least 3 vertices
                accept = accept &&
                    (ht.item != this.pendingSegment.path || (ht.segment && ht.segment.index == 0 &&
                        ht.segment.path.segments.length > 3));

            // If there is already a selected polygon and the mouse is over a point with iso-points, always select the
            // point that belongs to the selected polygon
            if (accept && this.actualSelection.length > 0 && ht.type == "segment") {
                const isoSegments = this.isoSegments(ht.segment);
                if (isoSegments) {
                    const polygons = this.getSelectedPolygons();
                    if (polygons) {
                        if (polygons[0] == ht.item) {
                            accept = true;
                        } else {
                            let iter = isoSegments.values();
                            let found = false;
                            let seg = iter.next();
                            while (!found && !seg.done) {
                                if (seg.value != ht.segment && seg.value.path == polygons[0]) {
                                    accept = false;
                                    found = true;
                                }
                                seg = iter.next();
                            }
                        }
                    }
                }
            }
            else if (accept && this.actualSelection.length > 0 && ht.type == "curve") {
                const isoSegments = this.isoSegments(ht.location.segment);
                if (isoSegments) {
                    const polygons = this.getSelectedPolygons();
                    if (polygons) {
                        if (polygons[0] == ht.item) {
                            accept = true;
                        } else {
                            let iter = isoSegments.values();
                            let found = false;
                            let seg = iter.next();
                            while (!found && !seg.done) {
                                if (seg.value != ht.location.segment && seg.value.path == polygons[0]) {
                                    accept = false;
                                    found = true;
                                }
                                seg = iter.next();
                            }
                        }
                    }
                }
            }

            return accept;
        };

        // Parameters for detecting polygon hits
        const areas = {
            curves: false,
            segments: false,
            handles: false,
            match: matchFunction,
            stroke: false,
            fill: true
        };
        // Parameters for detecting point and line hits
        const pointsAndLines = {
            curves: true,
            segments: true,
            handles: false,
            match: matchFunction,
            stroke: false,
            fill: false
        };

        // Adjust the tolerance according to the zoom level
        this.hitTolerance = areas.tolerance = pointsAndLines.tolerance = 7 / (this.scaleFactor * Paper.view.zoom);

        const hitPointsAndLines = Paper.project.hitTest(event.point, pointsAndLines);
        const hitAreas = Paper.project.hitTest(event.point, areas);

        // This class-level state attribute holds synthetic hit testing informations
        this.hitInfos = (hitAreas || hitPointsAndLines) ? {} : null;

        if (hitAreas) {
            // Polygon hit testing
            this.hitInfos.polygon = hitAreas.item;
            this.hitInfos.type = "polygon";
        }
        if (hitPointsAndLines) {
            if (!this.hitInfos.polygon)
                this.hitInfos.polygon = hitPointsAndLines.item;
            this.hitInfos.point = hitPointsAndLines.point;
            if (hitPointsAndLines.type == "curve") {
                // Line hit testing
                this.hitInfos.type = "line";
                this.hitInfos.location = hitPointsAndLines.location;
                this.hitInfos.polygon = hitPointsAndLines.item;
                //this.hitInfos.pointOrLinePolygon = hitPointsAndLines.item;
            } else {
                // Point hit testing
                this.hitInfos.segment = hitPointsAndLines.segment;
                this.hitInfos.polygon = this.hitInfos.segment.path;
                if (this.pendingSegment) {
                    const isoSegments = this.isoSegments(hitPointsAndLines.segment) || new Set();
                    let iter = isoSegments.values();
                    let found = false;
                    let seg = iter.next();
                    while (!found && !seg.done) {

                        if (seg.value != hitPointsAndLines.segment &&
                            seg.value.path == this.pendingSegment.path) {
                            this.hitInfos.segment = this.pendingSegment.path.firstSegment;
                            this.hitInfos.polygon = this.hitInfos.segment.path;
                            found = true;
                        }
                        seg = iter.next();
                    }

                }
                this.hitInfos.type = "point";
                //this.hitInfos.pointOrLinePolygon = hitPointsAndLines.item;
            }
        }
        if (this.hitInfos) {
            this.onSnap(this.hitInfos);
        }
    }

    onSnap(hi) {

    }

    /**
     * Reset the component when unmounting
     */
    componentWillUnmount() {
        $(window).off('resize');
        $("#sourceImage").off("load");
        $("body").off("wheel");
        $(document).off("keydown");
        $(document).off("keyup");
        this.pointerTool.remove();

        this.cutTool.remove();
        this.rectangleTool.remove();
        this.polygonTool.remove();
        this.snapIndicator = this.snapColor = this.snapPoint = this.snapSegment = null;
        this.setCurrentSample(null);
        this.mainLayer.remove();
        this.rasterLayer.remove();
        this.frontLayer.remove();
        this.debugLayer.remove();
        if (this.raster)
            this.raster.remove();
        //TODO: need to be reimplemented in toolbars
        //Mousetrap.reset();
    }

    /**
     * Treat the update as an initialization
     */

    /*
    componentDidUpdate() {
        this.componentWillUnmount();
        this.componentDidMount();
    }
*/
    setupMessages() {
        this.onMsg("classSelection", ({descriptor}) => {
            const classIndex = descriptor.classIndex;

            this.activeClassIndex = classIndex;

            if (this.actualSelection.length) {
                const first = this.getSelectedPolygons()[0];
                if (first.feature.classIndex != classIndex) {
                    first.feature.classIndex = classIndex;

                    this.setColor(first, this.activeSoc.colorForIndexAsHex(classIndex));

                    this.setActualSelectionAsync(this.actualSelection);

                    this.saveData();
                }
            }
        });
        this.onMsg("undo", () => this.undo());
        this.onMsg("redo", () => this.redo());

        this.onMsg("tagsChanged", () => this.saveData(true));

        this.onMsg("openJsonView", () => {
            window.open(document.URL.replace("edit", "api/json"));
        });

        this.onMsg("selectAll", (args) => {
            this.mainLayer.children.forEach(p => p.fullySelected = (args.value == true));
        });

        this.onMsg("opacityChange", (args) => {
            this.mainLayer.opacity = this.mainLayerOpacity = parseFloat(args.value);
        });

        this.onMsg("filterChange", this.updateFilter.bind(this));

        this.onMsg("reset-end", () => {
            this.mainLayer.removeChildren();
            this.frontLayer.removeChildren();
            this.currentSample.tags = [];
            this.fullUpdate();
        });

        this.onMsg("layer-select", (arg) => {
            this.clearActualSelection();
            this.layerIndex = arg.index;
        });

        this.onMsg("layer-hide", (arg) => {
            this.clearActualSelection();
            this.hiddenLayers.add(arg.index);
            this.mainLayer.children
                .filter(pol => (arg.index == 0 && pol.feature.layer == undefined) || pol.feature.layer == arg.index)
                .forEach(pol => {
                    pol.fullySelected = false;
                    pol.visible = false;
                });
        });

        this.onMsg("layer-show", (arg) => {
            this.hiddenLayers.delete(arg.index);
            this.mainLayer.children
                .filter(pol => (arg.index == 0 && pol.feature.layer == undefined) || pol.feature.layer == arg.index)
                .forEach(pol => pol.visible = true);
        });

        this.onMsg("download", () => {
            this.download();
        });

        this.onMsg("polygon-set-layer", arg => {
            arg.polygon.feature.layer = arg.layer;
            this.fixOrderingForOneItem();
            this.updateLayers();
            this.fullUpdate();
            this.setActualSelection([arg.polygon]);
        });

        this.onMsg("class-multi-select", (arg) => {
            this.clearActualSelection();
            this.setActualSelection(this.mainLayer.children.filter(p => p.feature.classIndex == arg.classIndex))
        });

        this.onMsg("delete", () => this.delete());
        this.onMsg("moveback", () => this.moveBack());
        this.onMsg("movefront", () => this.moveFront());
        this.onMsg("merge", () => this.mergePath());
        this.onMsg("follow", () => this.followPath());

        this.onMsg("pointer", () => this.pointerTool.activate());
        this.onMsg("cut", () => this.cutTool.activate());
        this.onMsg("polygon", () => this.polygonTool.activate());
        this.onMsg("rectangle", () => this.rectangleTool.activate());
        this.onMsg("flood", () => this.floodTool.activate());


        this.onMsg("strokes", (arg) => this.showStrokes(arg.value));
        this.onMsg("closepolygon", () => (
            (Paper.tool == this.polygonTool ? this.polygonTool : this.floodTool).endPolygon()));

        this.onMsg("active-soc", arg => {
            if (this.activeSoc != arg.value) {
                this.activeSoc = arg.value;
                this.activeClassIndex = 0;
                this.repaint();
            }
        });


    }

    /**
     * Editor initialization
     */
    componentDidMount() {
        this.setupMessages();
        if (!this.initialized) {
            this.initialized = true;
        }

        Mousetrap.bind("esc", () => this.cancel());


        const canvas = $('#rasterCanvas').get(0);

        Paper.setup(canvas);

        // The layer for the image
        this.rasterLayer = new Paper.Layer();
        this.rasterLayer.applyMatrix = false;

        // The layer for drawing the annotations
        this.mainLayer = new Paper.Layer();
        this.mainLayer.applyMatrix = false;
        this.mainLayer.opacity = this.mainLayerOpacity;

        // The front layer for snapping and selection indicators
        this.frontLayer = new Paper.Layer();
        this.frontLayer.applyMatrix = false;
        // this.frontLayer.blendMode = "difference";
        /*
        this.mainLayer.activate();
        const bug = new Paper.Path([{x: 1, y: 1}, {x: 30, y: 30}]);
        bug.strokeColor = "red"
*/
        // The front layer for snapping and selection indicators
        this.debugLayer = new Paper.Layer();
        this.debugLayer.applyMatrix = false;

        // Registers hit testing on all layers
        this.rasterLayer.onMouseMove = this.hitTesting.bind(this);
        this.mainLayer.onMouseMove = this.hitTesting.bind(this);
        this.frontLayer.onMouseMove = this.hitTesting.bind(this);

        this.rasterLayer.activate();

        this.polygonTool = new SsePolygonTool(this);
        this.pointerTool = new SsePointerTool(this);
        this.cutTool = new SseCutTool(this);
        this.rectangleTool = new SseRectangleTool(this);
        this.floodTool = new SseFloodTool(this);
        $(window).on('resize', this.resizeCanvas.bind(this));

        const record = SseSamples.findOne({url: this.props.imageUrl});
        // Initialize the data model object with an existing one from the server or
        // with an empty one

        this.setCurrentSample(record || {url: this.props.imageUrl, objects: []});

        // Disable context menu
        $('body').on('contextmenu', 'div', function () {
            return false;
        });

        this.sendMsg("editor-ready", {value: this.currentSample});
        this.imageLoaded();

    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    updateLayers() {
        this.mainLayer.children.forEach(pol => {
            pol.fullySelected = false;
            pol.visible = !this.hiddenLayers.has(pol.feature.layer);
        });
    }

    setCurrentSample(data) {
        this.currentSample = data;
        if (data) {
            this.sendMsg("currentSample", {data})
        }
    }

    /**
     * Enable/Disable polygons strokes
     */
    showStrokes(v) {
        this.visibleStrokes = v;
        if (v)
            this.setActualSelection(this.mainLayer.children);
        else
            this.clearActualSelection();
    }

    /**
     * Cancel action when pressing ESC
     */
    cancel(fullCancel) {
        if (!this.newPath) {
            this.clearActualSelection();
        }
        if (Paper.tool.cancel)
            Paper.tool.cancel(fullCancel);
    }

    delete() {
        if (this.newPath)
            this.cancel(true);
        const editor = this;
        const selectedPoints = editor.getSelectedPoints();
        let updated = false;
        if (selectedPoints.length > 0) {
            updated = true;
            // Point deletion
            // Deleting a point which is part of a triangle

            editor.unsnap();
            selectedPoints.forEach(seg => {
                seg.remove();
            });

            this.drawPointSelection();
            setTimeout(() => {
                this.setActualSelection(this.getSelectedPolygons())
            }, 0);
        } else {
            // Polygon deletion
            const selectedPolygons = editor.getSelectedPolygons();
            if (selectedPolygons.length > 0) {
                updated = true;
                selectedPolygons.forEach(p => editor.deletePolygon(p));
                //editor.deletePolygon(selectedPolygons[0]);
                this.clearActualSelection();
            }
        }
        if (updated)
            this.fullUpdate();
    }

    /**
     * Move the selected polygon to the back
     */
    moveFront() {
        if (this.selectedIntersections) {
            const sp = this.getSelectedPolygons()[0];
            const arr = Array.from(this.geom.getIntersections(sp));
            arr.sort(function (a, b) {
                if (a.isBelow(b))
                    return -1;
                else
                    return 1;
            });

            const ite = new Set(arr).values();
            let next = ite.next();
            while (next && next.value && sp.isAbove(next.value)) {
                next = ite.next();
            }
            if (next.value) {
                if (sp.feature.layer < next.value.feature.layer) {
                    sp.feature.layer = next.value.feature.layer;

                }
                sp.moveAbove(next.value);
                const i1 = this.currentSample.objects.indexOf(sp.feature);
                const i2 = this.currentSample.objects.indexOf(next.value.feature);
                const t = this.currentSample.objects[i1];
                this.currentSample.objects[i1] = this.currentSample.objects[i2];
                this.currentSample.objects[i2] = t;

                this.updateCommands();
                this.saveData();
                this.updateGeometry(false);
                this.setActualSelectionAsync(this.actualSelection);

            }
        }
    }

    /**
     * Move the selected polygon to the front
     */
    moveBack() {
        if (this.selectedIntersections) {
            const sp = this.getSelectedPolygons()[0];
            const arr = Array.from(this.geom.getIntersections(sp));
            arr.sort(function (a, b) {
                if (a.isBelow(b))
                    return 1;
                else
                    return -1;
            });

            const ite = new Set(arr).values();
            let next = ite.next();
            while (next && next.value && sp.isBelow(next.value)) {
                next = ite.next();
            }
            if (next.value) {
                if (sp.feature.layer > next.value.feature.layer)
                    sp.feature.layer = next.value.feature.layer;
                sp.moveBelow(next.value);
                const i1 = this.currentSample.objects.indexOf(sp.feature);
                const i2 = this.currentSample.objects.indexOf(next.value.feature);
                const t = this.currentSample.objects[i1];
                this.currentSample.objects[i1] = this.currentSample.objects[i2];
                this.currentSample.objects[i2] = t;

                this.updateCommands();
                this.saveData();
                this.updateGeometry(false);
                this.setActualSelectionAsync(this.actualSelection);
                //this.selectedIntersections = this.geom.getIntersections(sp);
            }
        }
    }

    fullUpdate() {
        if (this.actualSelection && this.actualSelection.length > 0)
            this.setActualSelection(this.actualSelection);
        this.saveData();
        this.updateGeometry(false);
        this.updateCommands();
    }

    undo() {
        this.cancel();
        const ustate = this.undoRedo.undo();
        if (ustate) {
            this.setCurrentSample(ustate);
            this.drawAnnotations();
            this.saveData(true);
        } else {
            this.sendMsg("alert", {variant: "warning", message: "No action to undo."})
        }
    }

    redo() {
        this.cancel();
        const ustate = this.undoRedo.redo();
        if (ustate) {
            this.setCurrentSample(ustate);
            this.drawAnnotations();
            this.saveData(true);
        } else {
            this.sendMsg("alert", {message: "No action to redo."})
        }
    }

    download() {
        $("#waiting").removeClass("display-none");
        const view = Paper.project.view;
        view.zoom = 1;
        view.center = {x: this.viewWidth / 2, y: this.viewHeight / 2};
        const jCanvas = $('#rasterCanvas');
        jCanvas.addClass("display-none");
        const canvas = jCanvas.get(0);
        canvas.width = this.imageWidth;
        canvas.height = this.imageHeight;
        Paper.project.view.viewSize = new Paper.Size(this.imageWidth, this.imageHeight);
        this.transformAllLayers(new Paper.Matrix());
        this.clearActualSelection();
        this.frontLayer.visible = false;
        this.disableComposition();
        this.enableComposition(true);
        setTimeout(() => {
            canvas.toBlob((blob) => {
                FileSaver.saveAs(blob, this.fileName.replace(/\.png$/, "_segmentation.png"));
                this.resizeCanvas();
                this.frontLayer.visible = true;
                this.disableComposition();
                this.enableComposition();
                jCanvas.removeClass("display-none");
                $("#waiting").addClass("display-none");
            });
        }, 500);
    }


    /**
     * We want to see pixels when zooming
     */
    disableSmoothing() {
        const canvas = $('#rasterCanvas').get(0);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
    }

    /**
     * Adds the image to the raster layer when it's loaded.
     */
    imageLoaded() {
        this.filterCanvas = $("#filterCanvas").get(0);
        const image = $("#sourceImage").get(0);

        this.imageWidth = image.width;
        this.imageHeight = image.height;
        this.filterCanvas.width = this.imageWidth;
        this.filterCanvas.height = this.imageHeight;
        const ctx = this.filterCanvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        this.sourceImageData = ctx.getImageData(0, 0, this.imageWidth, this.imageHeight);

        this.rasterLayer.activate();
        this.raster = new Paper.Raster(image, new Paper.Point(this.imageWidth / 2, this.imageHeight / 2));
        this.raster.visible = false;

        this.raster.onLoad = () => {
            // Adjust the canvas layer and draw annotations when the raster is ready
            this.resizeCanvas();

            this.drawAnnotations();

            this.updateStats();

            this.raster.visible = true;
            $("#waiting").addClass("display-none");

            let fileName = decodeURIComponent(url.parse(document.URL).path.replace("/edit/", ""));
            fileName = fileName.substr(fileName.lastIndexOf('/') + 1);
            this.sendMsg("status", {message: fileName});
            this.fileName = fileName;
            this.disableSmoothing();
            this.pointerTool.activate();
            this.undoRedo.init(document.URL, this.currentSample);
            this.setCurrentSample(this.currentSample); // Workaround for late registered components
            this.floodTool.initCanvas($("#sourceImage").get(0));
            this.sendMsg("sse-image-loaded");
        };
    }

    updateStats() {
        const pointCount = this.currentSample.objects.reduce((acc, cur) => acc += cur.polygon.length, 0);
        let statLabel = this.currentSample.objects.length + " object";
        statLabel += this.currentSample.objects.length > 1 ? "s" : "";
        if (pointCount)
            statLabel += ", " + pointCount + " points";
        this.sendMsg("bottom-right-label", {message: statLabel});

        const classCounter = new Map();
        const layerCounter = new Map();
        [...Array(this.activeSoc.classesCount).keys()].forEach((v, k) => classCounter.set(k, 0));
        this.mainLayer.children.forEach((path) => {
            classCounter.set(path.feature.classIndex, classCounter.get(path.feature.classIndex) + 1);
            layerCounter.set(path.feature.layer || 0, (layerCounter.get(path.feature.layer || 0) + 1) || 1);
        });
        this.sendMsg("layer-object-count", {map: layerCounter});
        classCounter.forEach((v, k) => {
            this.sendMsg("class-instance-count", {classIndex: k, count: v})
        });
    }

    /**
     *
     * @param nextProps
     * @returns {boolean}
     */
    shouldComponentUpdate(nextProps) {
        if (this.currentSample && nextProps.currentSample) {
            // Happens when the data is stored on the server for the first time
            // Need to synchronize the _id stored on the server with the local data
            this.currentSample._id = nextProps.currentSample._id;
        }
        return !this.props.url ||
            !nextProps.url ||
            !nextProps.currentSample ||
            this.props.url != nextProps.url;
    }

    /**
     /**
     * Adjust underlying image with WebGL filters
     * @param filterData
     */
    updateFilter(filterData) {
        let filtered = this.sourceImageData;
        if (filterData.brightness || filterData.contrast)
            filtered = ImageFilters.BrightnessContrastPhotoshop(filtered
                , filterData.brightness, filterData.contrast);
        if (filterData.gamma != 1) {
            filtered = ImageFilters.Gamma(filtered, filterData.gamma);
        }
        if (filterData.rescale != 1) {
            filtered = ImageFilters.Rescale(filtered, filterData.rescale);
        }
        if (filterData.edges) {
            filtered = ImageFilters.Edge(filtered);
        }

        if (filterData.hue || filterData.saturation || filterData.lightness) {
            filtered = ImageFilters.HSLAdjustment(filtered,
                filterData.hue,
                filterData.saturation,
                filterData.lightness);
        }

        this.raster.setImageData(filtered, 0, 0);
        this.floodTool.setImageData(filtered);
    }

    render() {
        return (
            <canvas id="rasterCanvas" className="absoluteTopLeftZeroW100H100"></canvas>
        );
    }

    cloningDataFunction(data) {

        const res = {};
        res.url = data.url;
        res.socName = data.socName;
        if (data.firstEditDate)
            res.firstEditDate = new Date(data.firstEditDate.getTime());
        if (data.lastEditDate)
            res.lastEditDate = new Date(data.lastEditDate.getTime());
        res._id = data._id;
        res.folder = data.folder;
        res.objects = [];
        res.tags = (data.tags || []).concat();
        let obj;
        data.objects.forEach(o => {

            obj = {
                label: o.label,
                classIndex: o.classIndex,
                polygon: []
            };
            o.polygon.forEach(pt => {
                obj.polygon.push({x: pt.x, y: pt.y});
            });
            res.objects.push(obj);
        });
        return res;
    }
}
