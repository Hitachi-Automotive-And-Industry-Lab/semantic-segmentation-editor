import {Random} from 'meteor/random';

import React from 'react';
import * as THREE from 'three';
import {BoxHelper} from './GradientBoxHelper';
import SseGlobals from "../../common/SseGlobals";
import SsePCDLoader from "./SsePCDLoader";
import OrbitControls from "./tools/OrbitControls"
import Sse3dLassoSelector from "./tools/Sse3dLassoSelector";
import PointInPoly from "point-in-polygon-extended";
import TWEEN from "@tweenjs/tween.js";
import Sse3dRectangleSelector from "./tools/Sse3dRectangleSelector";
import Sse3dCircleSelector from "./tools/Sse3dCircleSelector";
import SseDataManager from "../../common/SseDataManager";
import Color from "color"
import hull from "hull.js";
import PolyBool from "polybooljs";
import lineclip from "lineclip";
import SseMsg from "../../common/SseMsg";


const PI = Math.PI;
const DOUBLEPI = PI * 2;
const HALFPI = PI / 2;
const modulo = (x) => (x % DOUBLEPI + DOUBLEPI) % DOUBLEPI;
const moduloHalfPI = (x) => modulo(x + PI) - PI;
const round2 = (x) => Math.round(x * 100) / 100;

export default class SseEditor3d extends React.Component {
    constructor() {
        super();
        SseMsg.register(this);
        new SsePCDLoader(THREE);
        new OrbitControls(THREE);

        this.autoFilterMode = false;
        this.globalBoxMode = true;
        this.selectionOutlineMode = true;
        this.selectionMode = "add";
        this.autoFocusMode = false;
        this.colorBoost = 0;
        this.orientationArrows = new Map();
        this.state = {ready: false};
        this.screen = {};
        this.colorCache = new Map();
        this.pointSizeWithAttenuation = .03;
        this.pointSizeWithoutAttenuation = 2;
        this.nothingToAnimate = false;
        this.objects = new Set();
        this.selectedObject = undefined;
        this.activeClassIndex = 0;
        this.pixelProjection = new Map();
        this.highlightedIndex = -1;
        this.dataManager = new SseDataManager();

        this.tweenDuration = 500;

        this.cameraState = {
            moving: false,
            position: 0,
            originalTarget: new THREE.Vector3(),
            fromTheta: 0,
            toTheta: 0,
            rangeTheta: 0,
            fromPhi: 0,
            toPhi: 0,
            rangePhi: 0,
            fromRadius: 0,
            toRadius: 0,
            rangeRadius: 0,
            fromX: 0,
            toX: 0,
            fromY: 0,
            toY: 0,
            fromZ: 0,
            toZ: 0,
            rangeX: 0,
            rangeY: 0,
            rangeZ: 0
        };

        const endCameraTween = () => {
            this.cameraState.moving = false;
            this.invalidateAnimation();
        };

        this.cameraTween = new TWEEN.Tween(this.cameraState).onStop(endCameraTween).onComplete(endCameraTween);

        this.visibilityState = {
            moving: false,
            position: 0
        };

        this.visibilityTween = new TWEEN.Tween(this.visibilityState)
            .onComplete(e => {
                this.visibilityState.moving = false;
                this.hiddenIndices.forEach(idx => {
                    this.positionArray[idx * 3 + 1] = 100000;
                });
                this.invalidatePosition();
            });
        /*
                const imports = [
                    "/lib/js/examples/js/Octree.js",
                    "/lib/js/geometries/ConvexGeometry.js",
                    "/lib/js/renderers/CanvasRenderer.js",
                    "/lib/js/Detector.js",
                    "/lib/js/QuickHull.js"];

                let loadedCount = imports.length;
                const loadDep = (result) => {
                    if (result) {
                        eval(result.content);
                        loadedCount--;
                        if (loadedCount === 0) {
                            this.init();
                        }
                    }
                };

                imports.forEach(u =>
                    HTTP.call("GET", u,
                        null, (error, result) => {
                            if (error)
                                console.log(error);
                            else
                                loadDep(result);

                        }));
        */
    }

    render() {
        return (<div className="absoluteTopLeftZeroW100H100">
                <canvas id="canvas3d" className="absoluteTopLeftZeroW100H100">
                </canvas>
                <canvas id="canvas2d" className="absoluteTopLeftZeroW100H100"></canvas>
            </div>
        );
    }

    get classesDescriptors() {
        if (!this._classesData) {
            const byIndex = this.activeSoc.descriptors;
            this._classesData = {byName: this.activeSoc.byLabel, byIndex};

            this.activeSoc.labels.forEach((k) => {
                let c = this.activeSoc.byLabel.get(k);
                c.mute = false;
                c.solo = false;
                c.visible = true;

                const rgb = SseGlobals.hex2rgb(c.color);
                c.red = rgb[0];
                c.green = rgb[1];
                c.blue = rgb[2];
            });
        }
        return this._classesData;
    }

    displayAll() {
        if (this.cloudData) {
            this.cloudData.forEach((pt, pos) => {

                const classData = this.classesDescriptors.byIndex[pt.classIndex];
                if (classData.visible) {
                    this.assignNewClass(pos, pt.classIndex);
                    const {x, y, z} = this.cloudData[pos];
                    this.setPosition(pos, x, y, z);
                    this.showIndex(pos);
                }
            });
            this.fitView();
            this.updateGlobalBox();
            this.sendMsg("object-select", {value: undefined});
            this.setViewFilterState(undefined);
        }
    }

    updateClassFilter(changedClassIndex) {

        let soloMode = false;
        this.classesDescriptors.byIndex.forEach(classObj => {
            if (classObj.solo) {
                classObj.visible = true;
                soloMode = true;
            }
        });

        if (soloMode) {
            this.classesDescriptors.byIndex.forEach(classObj => {
                classObj.visible = classObj.solo;
            });
        } else {
            this.editingClassIndex = -1;
            this.classesDescriptors.byIndex.forEach(classObj => {
                classObj.visible = !classObj.mute;
            });
        }

        const classesData = this.classesDescriptors.byIndex;

        this.cloudData.forEach((pt, pos) => {
            const visible = classesData[pt.classIndex].visible;

            if (!visible) {
                this.hideIndex(pos);
            } else {
                const {x, y, z} = this.cloudData[pos];
                this.setPosition(pos, x, y, z);
                this.showIndex(pos);
            }
        });
        this.invalidateColor();
        this.startVisibilityTween();
        this.updateGlobalBox();

    }

    startVisibilityTween() {
        if (this.visibilityState.moving)
            return;
        const visibilityDest = {position: 100};
        this.visibilityState.moving = true;
        this.visibilityState.position = 0;
        this.visibilityTween.to(visibilityDest, this.tweenDuration)
            .easing(TWEEN.Easing.Quadratic.Out).start();
        this.invalidateAnimation();
    }


    setColor(idx, color = {red: 1, green: 0, blue: 0}) {
        const colors = this.colorArray;
        const altColor = this.getCachedColor(color.red, color.green, color.blue, this.colorBoost);
        colors[idx * 3] = altColor.r;
        colors[idx * 3 + 1] = altColor.g;
        colors[idx * 3 + 2] = altColor.b;
    }

    setPosition(idx, x, y, z) {
        const positions = this.positionArray;
        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;
        this.invalidatePosition();
    }

    changeClassOfSelection(classIndex) {
        this.selection.forEach(idx => this.assignNewClass(idx, classIndex));
        if (this.selectedObject) {
            this.selectedObject.classIndex = classIndex;
            this.selectedObject.points.forEach(idx => this.assignNewClass(idx, classIndex));
            this.sendMsg("object-select", {value: this.selectedObject})
        }
        this.invalidateColor();
        this.invalidateCounters();
        this.saveAll();
    }

    createObject() {
        let points;
        if (this.selection.size > 0)
            points = this.selection;
        else if (this.viewFilterState === "points")
            points = this.visibleIndices;
        if (points) {

            const obj = {id: Random.id(), classIndex: this.activeClassIndex, points: Array.from(points)};
            this.objects.add(obj);

            this.sendMsg("objects-update", {value: this.objects});
            this.sendMsg("object-select", {value: obj});
            this.changeClassOfSelection(this.activeClassIndex);

        }
        this.saveAll();
    }

    invalidateCounters() {
        let i = 0;
        this.activeSoc.labels.forEach(a => {
            const arg = {classIndex: i, count: (this.cloudData.byClassIndex[i] || {size: 0}).size};
            this.sendMsg("class-instance-count", arg);
            i++;
        });
    }

    invalidateObjects() {
        this.sendMsg("objects-update", {value: this.objects});
    }

    deleteSelectedObject() {
        if (this.selectedObject) {
            this.objects.delete(this.selectedObject);
            this.selectedObject = undefined;
            this.sendMsg("object-select", {value: undefined});
            this.invalidateObjects();
            this.saveAll();
        }
    }

    selectObject(obj) {
        this.selectedObject = obj;
        this.ungrayAll();
        if (this.selectedObject) {
            this.sendMsg("classIndex-select", {value: obj.classIndex});
            if (this.autoFilterMode)
                this.filterIndices(this.selectedObject.points);
            else {
                this.filterIndices(this._allIndices);
                const pointSet = new Set(this.selectedObject.points);

                this._allIndices.forEach(idx => {
                    if (!pointSet.has(idx))
                        this.grayIndex(idx)
                });

            }
            if (this.autoFocusMode && this.selectedObject.points.length > 0)
                this.subsetFocus(this.selectedObject.points);
            this.invalidateColor();
            this.setViewFilterState("object");
            this.updateGlobalBox();
            if (!this.selectionIsEmpty()) {
                this.sendMsg("enableCommand", {name: "addPointsObjectCommand"});
            }
        }
    }

    unselectObject() {
        this.selectedObject = undefined;
        this.sendMsg("object-select", {value: undefined});
        this.displayAll();
    }

    addObjectPoints() {
        this.selection.forEach(idx => {
            if (this.selectedObject.points.indexOf(idx) == -1) {
                this.selectedObject.points.push(idx);
                this.assignNewClass(idx, this.selectedObject.classIndex);
            }
        });
        this.clearSelection();
        this.saveAll();
    }

    removeObjectPoints() {
        const ptsArray = this.selectedObject.points;
        this.selection.forEach(idx => {
            if (ptsArray.indexOf(idx) != -1) {
                ptsArray.splice(ptsArray.indexOf(idx), 1);
                this.assignNewClass(idx, 0);
                if (this.autoFilterMode)
                    this.hideIndex(idx);
            }
        });
        this.clearSelection();
        this.saveAll();
    }

    filterIndices(forEachableIndices) {
        const indices = new Set(forEachableIndices);
        this.cloudData.forEach((pt, idx) => {
            if (!indices.has(idx)) {
                this.hideIndex(idx);
            } else {
                this.showIndex(idx);
            }
        });
    }

    componentDidMount() {
        this.init();
        const changePointSize = (amount) => {
            const withAttenuation = {min: 0.01, max: .5, increment: 0.01};
            const withoutAttenuation = {min: 1, max: 5, increment: 0.5};
            const bounds = this.cloudObject.material.sizeAttenuation ? withAttenuation : withoutAttenuation;
            this.cloudObject.material.size = bounds.min + amount * (bounds.max - bounds.min);

            if (this.cloudObject.material.sizeAttenuation) {
                this.pointSizeWithAttenuation = this.cloudObject.material.size;
            } else {
                this.pointSizeWithoutAttenuation = this.cloudObject.material.size;
            }
            this.invalidateAnimation();
        };

        this.onMsg("point-size", (arg) => changePointSize(arg.value));

        this.onMsg("distance-attenuation", (arg) => {
            const v = arg.value === "enabled";
            this.cloudObject.material.sizeAttenuation = v;
            if (v) {
                this.cloudObject.material.size = this.pointSizeWithAttenuation;
            } else {
                this.cloudObject.material.size = this.pointSizeWithoutAttenuation;
            }
            this.cloudObject.material.needsUpdate = true;
            this.invalidateAnimation();
        });

        this.onMsg("solo", objDesc => {
            const local = this.classesDescriptors;
            const desc = local.byName.get(objDesc.label);
            desc.solo = !desc.solo;
            this.editingClassIndex = objDesc.index;
            this.updateClassFilter(this.editingClassIndex);
        });

        this.onMsg("mute", objDesc => {
            const local = this.classesDescriptors;
            const desc = local.byName.get(objDesc.label);
            desc.mute = !desc.mute;
            this.editingClassIndex = objDesc.index;
            this.updateClassFilter(this.editingClassIndex);
        });

        this.onMsg("selector", () => this.activateTool(this.selector));
        this.onMsg("rectangle", () => this.activateTool(this.rectangleSelector));
        this.onMsg("circle", () => this.activateTool(this.circleSelector));

        this.onMsg("selection-mode-add", () => this.selectionMode = "add");
        this.onMsg("selection-mode-toggle", () => this.selectionMode = "toggle");
        this.onMsg("selection-mode-remove", () => this.selectionMode = "remove");

        this.onMsg("classSelection", (arg) => {
            this.activeClassIndex = arg.descriptor.classIndex;
            this.changeClassOfSelection(this.activeClassIndex);
        });

        this.onMsg("active-soc", arg => {
            if (this.activeSoc !== arg.value) {
                this.activeSoc = arg.value;
                if (!this.meta) {
                    this.start();

                }
                else {
                    this._classesData = null;
                    this.meta.socName = this.activeSoc.name;

                    this.invalidateColor();
                    this.displayAll();
                    this.saveMeta();
                }
                this.generateColorCache();
            }
        });

        this.onMsg("view-camera", () => this.cameraPreset("camera"));
        this.onMsg("view-behind", () => this.cameraPreset("behind"));
        this.onMsg("view-front", () => this.cameraPreset("front"));
        this.onMsg("view-top", () => this.cameraPreset("top"));
        this.onMsg("view-left", () => this.cameraPreset("left"));
        this.onMsg("view-right", () => this.cameraPreset("right"));
        this.onMsg("view-center", () => this.centerView());


        this.sendMsg("editor-ready");

        this.onMsg("autoFilter", ({value}) => {
            this.autoFilterMode = value;
            this.selectObject(this.selectedObject);
        });

        this.onMsg("globalbox", ({value}) => {
            this.globalBoxMode = this.globalBoxObject.visible = value;
            this.invalidateAnimation();
        });

        this.onMsg("selectionOutline", ({value}) => {
            this.selectionOutlineMode = !this.selectionOutlineMode;
            this.invalidate2dOverlay()
        });


        this.onMsg("autoFocus", ({value}) => {
            this.autoFocusMode = value;
            this.selectObject(this.selectedObject);
        });

        this.onMsg("object-new", () => {
            this.createObject();
        });

        this.onMsg("object-delete", () => this.deleteSelectedObject());

        this.onMsg("object-select", (arg) => this.selectObject(arg.value));
        this.onMsg("object-unselect", () => this.unselectObject());
        this.onMsg("object-focus", () => {
            if (this.selectedObject.points.length > 0)
                this.subsetFocus(this.selectedObject.points);
        });

        this.onMsg("object-add-points", () => {
            this.addObjectPoints();
            this.sendMsg("update-object-stat")
        });

        this.onMsg("object-remove-points", () => {
            this.removeObjectPoints();
        });


        this.onMsg("orientation-change", () => {
            this.startPointcloudOrientation();
        });
        this.onMsg("orientation-abort", () => {
            this.stopPointcloudOrientation();
        });

        this.onMsg("tagsChanged", () => this.saveAll());

        this.onMsg("downloadFile", () => this.downloadFile());
        this.onMsg("downloadText", () => this.downloadText());
        this.onMsg("color-boost", (arg => {
            this.colorBoost = arg.value;
            this.invalidateColor();
        }));
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    downloadFile() {
        window.open("/api/pcdfile" + this.props.imageUrl, "_blank");
    }

    downloadText() {
        window.open("/api/pcdtext" + this.props.imageUrl, "_blank");
    }

    init() {
        this.sendMsg("bottom-right-label", {message: "Downloading PCD File..."});
        /*
        THREE.Vector3.prototype.toString = function () {
            const s = (n) => Math.round(n * 100) / 100;

            return "(" + s(this.x) + ", " + s(this.y) + ", " + s(this.z) + ")";
        };
        */
        this.canvas3d = $("#canvas3d").get(0);
        this.canvas2d = $("#canvas2d").get(0);
        this.context2d = this.canvas2d.getContext("2d");
        this.canvasContainer = $('#canvasContainer').get(0);
        this.selection = new Set();
        this.hiddenIndices = new Set();
        this.visibleIndices = new Set();
        this.grayIndices = new Set();
        this.frustrumIndices = new Set();
        const scene = this.scene = new THREE.Scene();

        scene.background = new THREE.Color(0x111111);

        const camera = this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.01, 10000);

        scene.add(camera);

        const rendererAttrs = {
            antialias: true,
            canvas: this.canvas3d,
            powerPreference: "high-performance",
        };

        const renderer = this.renderer = new THREE.WebGLRenderer(rendererAttrs);
        renderer.setPixelRatio(window.devicePixelRatio);
        $(renderer.domElement).addClass("absoluteTopLeftZeroW100H100");


        window.addEventListener('resize', () => {
            this.resizeCanvas();
        }, false);

        $("body").on('contextmenu', () => {
            return false;
        });

        this.mouse = new THREE.Vector2();
        this.mouse.dragged = 0;
        this.setupAxes();

        this.camera.up.set(0, -1, 0);

        this.setupRaycaster();

        this.orbiter = new THREE.OrbitControls(this, this.camera, this.canvasContainer, this);
        this.orbiter.activate();
        this.orbiter.addEventListener("start", this.orbiterStart.bind(this), false);
        this.orbiter.addEventListener("change", this.orbiterChange.bind(this), false);
        this.orbiter.addEventListener("end", this.orbiterEnd.bind(this), false);

        this.frustum = new THREE.Frustum();

        this.setupTools();
        this.setupLight();
        this.animate();
        setTimeout(this.resizeCanvas.bind(this), 100); // Global layout can take some time...
    }

    grayIndex(idx) {
        this.grayIndices.add(idx);
        this.invalidateColor();
    }

    ungrayIndex(idx) {
        this.grayIndices.delete(idx);
        this.invalidateColor();
    }

    ungrayAll() {
        this.grayIndices.clear();
        this.invalidateColor();
    }

    hideIndex(idx) {
        this.hiddenIndices.add(idx);
        this.visibleIndices.delete(idx);
        this.startVisibilityTween();
        this.invalidateColor();
    }

    showIndex(idx) {
        this.hiddenIndices.delete(idx);
        this.visibleIndices.add(idx);
        const {x, y, z} = this.cloudData[idx];

        this.setPosition(idx, x, y, z);
        this.startVisibilityTween();
        this.invalidateColor();
    }

    centerView() {
        this.fitView(this.visibleIndices);
    }

    get cameraEye() {
        return new THREE.Vector3().copy(this.camera.position);
    }

    get cameraTarget() {
        return new THREE.Vector3().copy(this.orbiter.target);
    }

    cameraPreset(where, bypassCameraPresetInfo = false) {
        if (!bypassCameraPresetInfo) {
            const cpi = this.cameraPresetInfo;
            if (cpi) {
                if (cpi.where == where) {
                    this.moveCamera(cpi.eye, cpi.target);
                    this.cameraPresetInfo = undefined;
                    return;
                } else {
                    cpi.where = where;
                }
            }
            else {

                this.cameraPresetInfo = {where, eye: this.cameraEye, target: this.cameraTarget};
            }
        }
        let eye;
        const target = this.getCenter(this.visibleIndices);
        const slope = target.y - .5;

        switch (where) {
            case "camera":
                this.moveCamera(new THREE.Vector3(), new THREE.Vector3(0, 0, target.z));
                break;
            case "front":
                eye = new THREE.Vector3(target.x, slope, target.z - 1);
                break;
            case "behind":
                eye = new THREE.Vector3(target.x, slope, target.z + 1);
                break;
            case "top":
                eye = new THREE.Vector3(target.x, -1, 0.99999 * target.z);
                break;
            case "left":
                eye = new THREE.Vector3(target.x - 1, slope, target.z);
                break;
            case "right":
                eye = new THREE.Vector3(target.x + 1, slope, target.z);
                break;
        }
        if (eye)
            this.fitView(this.visibleIndices, eye);

    }

    /*
    moveCameraNow(eye, target) {
        if (eye)
            this.camera.position.copy(eye);
        if (target)
            this.orbiter.target.copy(target);

        this.invalidateAnimation();
    }
    */

    moveCamera(eye, target) {
        const orientedRange = (a0, a1) => {
            const da = (a1 - a0) % DOUBLEPI;
            return moduloHalfPI(2 * da % DOUBLEPI - da);
        };

        this.cameraState.moving = true;

        const target0 = this.orbiter.target;
        const target1 = target || this.orbiter.target;

        const eye0FromTarget
            = new THREE.Spherical().setFromVector3(this.camera.position.sub(target1)).makeSafe();
        let eye1FromTarget;
        if (eye)
            eye1FromTarget = new THREE.Spherical().setFromVector3(eye.sub(target1)).makeSafe();
        else
            eye1FromTarget = eye0FromTarget;

        const state = this.cameraState;
        state.originalTarget.copy(target1);
        state.position = 0;
        state.fromPhi = moduloHalfPI(eye0FromTarget.phi);
        state.fromTheta = moduloHalfPI(eye0FromTarget.theta);
        state.fromRadius = eye0FromTarget.radius;
        state.toPhi = moduloHalfPI(eye1FromTarget.phi);
        state.toTheta = moduloHalfPI(eye1FromTarget.theta);
        state.toRadius = eye1FromTarget.radius;
        state.rangePhi = orientedRange(eye0FromTarget.phi, eye1FromTarget.phi);
        state.rangeTheta = orientedRange(eye0FromTarget.theta, eye1FromTarget.theta);
        state.rangeRadius = this.cameraState.toRadius - this.cameraState.fromRadius;
        state.fromX = target0.x;
        state.fromY = target0.y;
        state.fromZ = target0.z;
        state.toX = target1.x;
        state.toY = target1.y;
        state.toZ = target1.z;
        state.rangeX = target1.x - target0.x;
        state.rangeY = target1.y - target0.y;
        state.rangeZ = target1.z - target0.z;
        this.cameraTween.to({position: 1}, this.tweenDuration).easing(TWEEN.Easing.Quadratic.Out).start();
    }

    generateColorCache() {
        this.colorCache.clear();
        const tripleMap = (l, v, r, g, b) => {
            let lm = this.colorCache.get(l);
            if (!lm) {
                lm = new Map();
                this.colorCache.set(l, lm);
            }
            let rm = lm.get(r);
            if (!rm) {
                rm = new Map();
                lm.set(r, rm);
            }
            let gm = rm.get(g);
            if (!gm) {
                gm = new Map();
                rm.set(g, gm);
            }
            gm.set(b, v);
        };

        this.classesDescriptors.byIndex.forEach(desc => {
                const color = Color(desc.color);
                for (let i = 0; i <= 1; i += .05) {
                    i = Math.round(i * 100) / 100;
                    const altColor = color.lighten(i).saturate(i).rgb().object();
                    altColor.r /= 256;
                    altColor.g /= 256;
                    altColor.b /= 256;
                    tripleMap(i, altColor, desc.red, desc.green, desc.blue);
                }
            }
        );
    }

    getCachedColor(r, g, b, l) {
        const v1 = this.colorCache.get(l);
        if (!v1)
            return {r, g, b};
        const v2 = v1.get(r);
        if (!v2)
            return {r, g, b};
        const v3 = v2.get(g);
        if (!v3)
            return {r, g, b};
        const v4 = v3.get(b);
        if (!v4)
            return {r, g, b};
        return v4;
    }

    updateCamera(time) {
        if (this.cameraState.moving) {
            this.cameraTween.update(time);
            const state = this.cameraState;
            const pos = state.position;

            // Changing target
            const x = state.fromX + state.rangeX * pos;
            const y = state.fromY + state.rangeY * pos;
            const z = state.fromZ + state.rangeZ * pos;
            this.orbiter.target.copy({x, y, z});

            // Changing camera position
            const phi = state.fromPhi + state.rangePhi * pos;
            const theta = state.fromTheta + state.rangeTheta * pos;
            const radius = state.fromRadius + state.rangeRadius * pos;
            const sphericalPosition = new THREE.Spherical(radius, phi, theta).makeSafe();
            const newCamPosition = new THREE.Vector3().setFromSpherical(sphericalPosition);
            this.camera.position.copy(newCamPosition.add(this.cameraState.originalTarget));
            this.camera.updateMatrix();
            this.orbiter.update();

        }
    }

    subsetFocus(forEachable) {
        this.fitView(forEachable);
        this.updateGlobalBox();
    }

    setViewFilterState(value) {
        this.viewFilterState = value;
        this.sendMsg("view-filter", {value});
    }

    selectByPolygon(polygon) {
        const inside = new Set();
        const outside = new Set();
        this.cloudData.forEach((pt, idx) => {
            const pixel = this.getPixel(pt);
            if (this.visibleIndices.has(idx)) {
                const inPolygon = PointInPoly.pointInPolyWindingNumber([pixel.pixelX, pixel.pixelY], polygon);
                if (inPolygon) {
                    inside.add(idx);
                } else {
                    outside.add(idx);
                }
            } else {
                outside.add(idx);
            }
        });

        if (this.autoFilterMode && !this.viewFilterState) {
            if (inside.size > 0) {
                outside.forEach(idx => this.hideIndex(idx));

                if (this.autoFocusMode)
                    this.subsetFocus(inside);
                this.setViewFilterState("points");

            }
        } else {
            if (inside.size > 0) {
                inside.forEach(idx => this.processSelection(idx));
                this.notifySelectionChange();

                if (!this.autoFilterMode && this.autoFocusMode)
                    this.subsetFocus(this.selection);
            } else {
                if (!this.mouse.dragged) {
                    if (this.selection.size > 0) {
                        this.clearSelection();
                    } else {
                        this.displayAll();
                    }
                }
            }
        }

        if (this.selection.size > 0 && this.selectedObject)
            this.sendMsg("enableCommand", {name: "addPointsObjectCommand"});
        else
            this.sendMsg("disableCommand", {name: "addPointsObjectCommand"});
        this.updateGlobalBox();

        this.invalidateColor();
        this.setSelectionFeedback();

    }

    setHighlightFeedback() {
        if (this.cloudData && this.highlightedIndex && this.mouse.dragged === 0) {
            const data = this.cloudData[this.highlightedIndex];
            const pj = this.getPixel(data);
            if (pj) {
                let message = this.activeSoc.labelForIndex(data.classIndex);
                const oc = this.originalCoordinates(this.highlightedIndex);
                message += " (x: " + round2(oc.x)
                    + "m, y: " + round2(oc.y)
                    + "m, z: " + round2(oc.z) + "m)";
                this.sendMsg("bottom-right-label", {message})
            }
        } else {
            this.setSelectionFeedback();
        }
    }

    setSelectionFeedback() {
        let msg = this.selection.size + " point selected";
        if (this.selection.size > 1) {
            msg = msg.replace("point", "points");
            this.sendMsg("bottom-right-label", {message: msg});
        }
        else {
            this.setOverviewFeedback();
        }
    }

    setOverviewFeedback() {
        if (this.cloudData) {
            let message = this.visibleIndices.size + " points / ";
            const bsize = this.globalBox3.getSize(new THREE.Vector3());
            message += " Width: " + round2(bsize.x);
            message += "m / Height: " + round2(bsize.y);
            message += "m / Depth: " + round2(bsize.z);
            message += "m";
            this.sendMsg("bottom-right-label", {message})
        }
    }

    paintScene() {
        if (this.cloudData) {
            this.cloudData.forEach((pt, idx) => {
                if (this.selection.has(idx)) {
                    this.setColor(idx, {red: 1, green: 0});
                } else if (this.grayIndices.has(idx)) {
                    this.setColor(idx, {red: .5, green: 0.5, blue: 0.5});
                }
                else {
                    this.setColor(idx,
                        this.classesDescriptors.byIndex[pt.classIndex]);
                }
            });
            this.colorIsDirty = false;
            this.cloudObject.geometry.attributes.color.needsUpdate = true;
            this.invalidateAnimation();
        }
    }

    selectionIsEmpty() {
        return this.selection.size === 0;
    }

    clearSelection() {
        this.selection.clear();
        this.invalidateColor();
        this.notifySelectionChange();
    }

    addIndexToSelection(idx) {
        this.selection.add(idx);
        this.invalidateColor();

    }

    removeIndexFromSelection(idx) {
        this.selection.delete(idx);
        this.invalidateColor();
    }

    processSelection(idx) {
        if (this.selectionMode == "add") {
            this.addIndexToSelection(idx);
        } else if (this.selectionMode == "remove") {
            this.removeIndexFromSelection(idx);
        }
        else {
            if (this.selection.has(idx))
                this.removeIndexFromSelection(idx);
            else {
                this.addIndexToSelection(idx);
            }
        }
    }

    drawPolyLine(pts, color, xField = 0, yField = 1, close) {
        if (!pts || !pts.length) return;
        this.context2d.beginPath();
        this.context2d.lineWidth = 1;
        this.context2d.strokeStyle = color;
        this.context2d.moveTo(pts[0][xField], pts[0][yField]);
        for (let i = 1; i < pts.length; i++) {
            this.context2d.lineTo(pts[i][xField], pts[i][yField]);
        }
        if (close)
            this.context2d.lineTo(pts[0][xField], pts[0][yField]);
        this.context2d.stroke();
    }

    clearCanvas2d() {
        this.context2d.clearRect(0, 0, this.viewWidth, this.viewHeight);
    }

    originalCoordinates(idx) {
        const geometry = new THREE.Geometry();
        let {x, y, z} = this.cloudData[idx];
        geometry.vertices.push(new THREE.Vector3(x, y, z));
        geometry.rotateZ(this.meta.rotationZ || 0).rotateY(this.meta.rotationY || 0).rotateX(this.meta.rotationX || 0);
        const v = geometry.vertices[0];
        return {x: v.x, y: v.y, z: v.z};
    }

    updatePixelProjection(idx) {
        if (!this.cloudData)
            return;

        this.frustum.setFromMatrix(new THREE.Matrix4()
            .multiplyMatrices(this.camera.projectionMatrix,
                this.camera.matrixWorldInverse));

        const vector = new THREE.Vector3();
        const pp = this.pixelProjection;
        let projection;

        const toScreen = (item, idx) => {
            vector.set(item.x, item.y, item.z);
            projection = pp.get(item);
            if (!projection) {
                projection = {};
                this.pixelProjection.set(item, projection)
            }
            const inFrustrum = this.frustum.containsPoint(vector);
            if (inFrustrum)
                this.frustrumIndices.add(idx);
            else {
                this.frustrumIndices.delete(idx);
            }
            if (inFrustrum || this.selection.has(idx)) {
                vector.project(this.camera);
                projection.pixelX = Math.round((vector.x * this.viewWidth2) + this.viewWidth2);
                projection.pixelY = Math.round((-vector.y * this.viewHeight2) + this.viewHeight2);
            } else {
                projection.pixelX = projection.pixelY = NaN;
            }
            return {x: projection.pixelX, y: projection.pixelY};
        };

        if (idx !== undefined)
            return toScreen(this.cloudData[idx], idx);
        else
            this.cloudData.forEach((pt, idx) => {
                toScreen(pt, idx);
            });
    }

    resizeCanvas() {
        const box = this.canvasContainer.getBoundingClientRect();
        this.viewWidth = box.width;
        this.viewHeight = box.height;
        this.viewWidth2 = box.width / 2;
        this.viewHeight2 = box.height / 2;
        this.clippingBox = [-2, -2, this.viewWidth + 4, this.viewHeight + 4];
        const d = this.renderer.domElement.ownerDocument.documentElement;
        this.screen = {};
        this.screen.left = box.left + window.pageXOffset - d.clientLeft;
        this.screen.top = box.top + window.pageYOffset - d.clientTop;
        this.screen.width = box.width;
        this.screen.height = box.height;
        this.camera.aspect = this.viewWidth / this.viewHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.viewWidth, this.viewHeight);
        this.canvas2d.width = this.viewWidth;
        this.canvas2d.height = this.viewHeight;

        if (this.orbiter && this.orbiter.handleResize)
            this.orbiter.handleResize();
        this.invalidateAnimation();
    }

    highlightIndex(idx) {
        this.highlightedIndex = idx;
        this.setHighlightFeedback();
        this.invalidate2dOverlay();
    }

    _orientationRaycasting() {
        SseGlobals.setCursor("default");
        this.raycaster.setFromCamera(this.mouse, this.camera);
        this.orientationArrows.forEach(a => a.children[0].material.color.g = 1);
        if (this.mouse.dragged > 0)
            return;

        let intersects = this.raycaster.intersectObjects(this.scene.children, true);

        intersects = intersects.filter(x => {
            return x.object.parent && x.object.parent.arrowDirection
        });
        const dcam = x => this.camera.position.distanceTo(x);
        intersects.sort((a, b) => dcam(a) < dcam(b));

        if (intersects.length > 0) {
            intersects[0].object.material.color.g = 0;
            this.pendingOrientationArrow = intersects[0].object.parent;
            SseGlobals.setCursor("pointer");
        } else {
            this.pendingOrientationArrow = null;
        }
    }

    _raycasting() {
        this.raycaster.setFromCamera(this.mouse, this.camera);

        const intersects = this.raycaster.intersectObjects(this.scene.children).filter(x => x.object.type === "Points");
        if (intersects.length) {
            intersects.sort((a, b) => a.distanceToRay < b.distanceToRay ? -1 : 1);
            const closer = intersects[0];
            this.mouseTargetIndex = closer.index;
            if (closer.object.type === "Points" && closer.distanceToRay < 1) {
                this.highlightIndex(closer.index);
                SseGlobals.setCursor("pointer");
            } else {
                this.mouseTargetIndex = undefined;
                this.highlightIndex(undefined);
            }

        } else {
            this.mouseTargetIndex = undefined;
            if (!this.mouse.down) {
                SseGlobals.setCursor("crosshair");
            }
            this.highlightIndex(undefined);
        }
    }

    invalidateAnimation() {
        this.nothingToAnimate = false;
    }

    invalidatePosition() {
        this.cloudObject.geometry.attributes.position.needsUpdate = true;
        this.invalidateAnimation();
    }

    invalidateColor() {
        this.colorIsDirty = true;
        this.invalidateAnimation();
    }

    invalidate2dOverlay() {
        this.overlayIsDirty = true;
    }

    drawCanvas2d() {
        if (!this.overlayIsDirty)
            return;
        this.overlayIsDirty = false;
        this.updatePixelProjection();
        this.clearCanvas2d();
        const ctx = this.context2d;

        // Lasso line
        if (this.currentTool.polygon && this.currentTool.polygon.length) {
            this.drawPolyLine(this.currentTool.polygon, "yellow");
        }

        // Hovered point
        else if (this.highlightedIndex && this.mouse.dragged === 0) {
            const data = this.cloudData[this.highlightedIndex];

            const pj = this.getPixel(data);
            if (pj) {
                ctx.beginPath();
                ctx.strokeStyle = "#FFFF00";
                ctx.lineWidth = 1;
                ctx.arc(pj.pixelX, pj.pixelY, 5, 0, DOUBLEPI);
                ctx.stroke();
            }
        }

        // Selection outline
        if (!this.cameraState.moving && !this.orbiting && this.selectionOutlineMode && this.selection.size > 0) {
            const selectionPts = [];
            let notInFrustrumCount = 0;
            this.selection.forEach(idx => {
                if (!this.frustrumIndices.has(idx))
                    notInFrustrumCount++;
                const pixel = this.getPixel(this.cloudData[idx]);
                const x = pixel.pixelX;
                const y = pixel.pixelY;
                selectionPts.push([x, y]);
            });
            if (selectionPts.length - notInFrustrumCount < 3)
                return;
            const filtered = selectionPts.filter(p => !isNaN(p[0]) && !isNaN(p[1]));
            let hullPol = hull(filtered, Infinity);
            hullPol.splice(-1, 1);
            if (hullPol.length < 3)
                return;
            hullPol = lineclip.polygon(hullPol, this.clippingBox);
            const drawCircle = (x, y, r) => {
                const pts = [];
                const total = 8;
                for (let i = 0; i <= total; i++) {
                    pts.push([x + Math.cos(DOUBLEPI * i / total) * r, y + Math.sin(DOUBLEPI * i / total) * r]);
                }
                return pts;
            };
            const circles = [];
            hullPol.forEach(p => {
                circles.push(drawCircle(p[0], p[1], 5));
            });
            const polygons = [];
            const polyFromArr = (pts => {
                return {
                    regions: [pts],
                    inverted: false
                }
            });
            polygons.push(polyFromArr(hullPol));
            circles.map(x => {
                polygons.push(polyFromArr(x));
            });
            let segments = PolyBool.segments(polygons[0]);
            for (let i = 1; i < polygons.length; i++) {
                const seg2 = PolyBool.segments(polygons[i]);
                const comb = PolyBool.combine(segments, seg2);
                segments = PolyBool.selectUnion(comb);
            }
            this.drawPolyLine(PolyBool.polygon(segments).regions[0], "yellow", 0, 1, true);
        }
    }

    animate(time) {
        requestAnimationFrame(this.animate.bind(this));
        this.drawCanvas2d();
        if (this.nothingToAnimate &&
            this.visibilityState.moving === false &&
            this.cameraState.moving === false)
            return;
        this.nothingToAnimate = true;
        this.updateCamera(time);

        if (this.visibilityState.moving) {
            this.visibilityTween.update(time);
            if (this.hiddenIndices.size > 0) {

                this.hiddenIndices.forEach(idx => {
                    const pos = this.visibilityState.position;
                    this.positionArray[idx * 3 + 1] -= (pos / 10);
                });

            }
            this.invalidatePosition();
        }

        if (this.orientationArrows.size > 0)
            this._orientationRaycasting();
        else
            this._raycasting();
        this.renderer.render(this.scene, this.camera);
        if (this.colorIsDirty) {
            this.paintScene();
        }
    }

    rotateGeometry(rx, ry, rz) {
        this.meta.rotationX = rx || 0;
        this.meta.rotationY = ry || 0;
        this.meta.rotationZ = rz || 0;
        this.cloudGeometry.rotateX(this.meta.rotationX).rotateY(this.meta.rotationY).rotateZ(this.meta.rotationZ);
        this.display(this.objects, this.positionArray, this.labelArray);
        this.saveMeta();
    }

    resetRotation() {
        const {rotationX, rotationY, rotationZ} = this.meta;
        this.cloudGeometry.rotateZ(-rotationZ || 0).rotateY(-rotationY || 0).rotateX(-rotationX || 0);
        this.meta.rotationX = this.meta.rotationY = this.meta.rotationZ = 0;
        this.updateGlobalBox();
        this.invalidatePosition();
    }

    endPointcloudOrientation(upDirection, frontDirection) {
        const config = upDirection + "," + frontDirection;

        let rx = 0, ry = 0, rz = 0;
        switch (config) {
            case "up,front": /* Nothing to do */
                break;
            case "up,left":
                ry = HALFPI;
                break;
            case "up,right":
                ry = -HALFPI;
                break;
            case "up,back":
                ry = PI;
                break;

            case "down,front":
                rz = PI;
                break;
            case "down,left":
                ry = HALFPI;
                rz = PI;
                break;
            case "down,right":
                ry = -HALFPI;
                rz = PI;
                break;
            case "down,back":
                ry = PI;
                rz = PI;
                break;

            case "front,left":
                rx = HALFPI;
                ry = HALFPI;
                break;
            case "front,right":
                rx = HALFPI;
                ry = -HALFPI;
                break;
            case "front,up":
                rx = HALFPI;
                ry = PI;
                break;
            case "front,down":
                rx = HALFPI;
                break;

            case "back,left":
                rx = -HALFPI;
                ry = HALFPI;
                break;
            case "back,right":
                rx = -HALFPI;
                ry = -HALFPI;
                break;
            case "back,up":
                rx = -HALFPI;
                break;
            case "back,down":
                rx = -HALFPI;
                ry = PI;
                break;

            case "left,front":
                rz = HALFPI;
                break;
            case "left,back":
                rz = -HALFPI;
                ry = PI;
                break;
            case "left,up":
                rx = HALFPI;
                ry = PI;
                rz = -HALFPI;
                break;
            case "left,down":
                rx = -HALFPI;
                ry = PI;
                rz = -HALFPI;
                break;

            case "right,front":
                rz = -HALFPI;
                break;
            case "right,back":
                rz = HALFPI;
                ry = -PI;
                break;
            case "right,down":
                rx = -HALFPI;
                ry = -PI;
                rz = HALFPI;
                break;
            case "right,up":
                rx = HALFPI;
                ry = -PI;
                rz = HALFPI;
                break;
        }


        this.meta.rotationX = rx;
        this.meta.rotationY = ry;
        this.meta.rotationZ = rz;
        this.meta.rotationDescription = config;
        this.rotateGeometry(rx, ry, rz);

        let obj, idx = 0;
        this.positionArray.forEach((v, i) => {
            switch (i % 3) {
                case 0:
                    obj = {x: v};
                    break;
                case 1:
                    obj.y = v;
                    break;
                case 2:
                    obj.z = v;
                    Object.assign(this.cloudData[idx], obj);
                    idx++;
                    break;
            }
        });
        this.updateGlobalBox();
        this.stopPointcloudOrientation();
        this.cameraPreset("front", true);
    }

    startPointcloudOrientation() {
        if (this.orientationArrows.size > 0)
            return;
        this.cameraPreset("front", true);
        this.resetRotation();
        const bbox = this.globalBox3;
        this.sendMsg("alert", {
            autoHide: false,
            message: "Point cloud orientation: Select the UP direction arrow",
            buttonText: "CANCEL",
            closeMessage: "orientation-abort",
            forceCloseMessage: "orientation-close"
        });

        const drawArrow = (bbox, direction) => {
            const bcenter = bbox.getCenter(new THREE.Vector3());
            const bsize = bbox.getSize(new THREE.Vector3());
            const min = Math.min(bsize.x, bsize.y, bsize.y);
            const max = Math.max(bsize.x, bsize.y, bsize.y);
            const dim = (min + max) / 20;

            const offset = dim * 2;
            const arrow = new THREE.Group();
            arrow.arrowDirection = direction;
            this.scene.add(arrow);
            this.orientationArrows.set(direction, arrow);
            let geometry = new THREE.CylinderGeometry(dim, dim, dim * 3, 128);
            const meshMaterial = new THREE.MeshPhongMaterial({
                color: 0xca7800, emissive: 0x808080,
                side: THREE.DoubleSide, flatShading: true
            });

            const cylinder = new THREE.Mesh(geometry, meshMaterial);
            arrow.add(cylinder);
            geometry = new THREE.ConeBufferGeometry(dim * 2, dim * 4, 128);
            const cone = new THREE.Mesh(geometry, meshMaterial);
            cone.position.y = dim * 2;


            if (direction === "front") {
                arrow.rotation.x = HALFPI;
                arrow.position.x = bcenter.x;
                arrow.position.y = bcenter.y;
                arrow.position.z = bcenter.z + bsize.z / 2 + offset;
            } else if (direction === "back") {
                arrow.rotation.x = -HALFPI;
                arrow.position.x = bcenter.x;
                arrow.position.y = bcenter.y;
                arrow.position.z = bcenter.z - bsize.z / 2 - offset;
            }
            else if (direction === "left") {
                arrow.rotation.z = HALFPI;
                arrow.position.x = bcenter.x - bsize.x / 2 - offset;
                arrow.position.y = bcenter.y;
                arrow.position.z = bcenter.z
            }
            else if (direction === "right") {
                arrow.rotation.z = -HALFPI;
                arrow.position.x = bcenter.x + bsize.x / 2 + offset;
                arrow.position.y = bcenter.y;
                arrow.position.z = bcenter.z
            } else if (direction === "down") {
                arrow.position.x = bcenter.x;
                arrow.position.y = bcenter.y + bsize.y / 2 + offset;
                arrow.position.z = bcenter.z
            }
            else if (direction === "up") {
                arrow.rotation.z = PI;
                arrow.position.x = bcenter.x;
                arrow.position.y = bcenter.y - bsize.y / 2 - offset;
                arrow.position.z = bcenter.z
            }
            arrow.add(cone);
        };
        // Look front
        drawArrow(bbox, "front");
        // Look back
        drawArrow(bbox, "back");
        // Look left
        drawArrow(bbox, "left");
        // Look right
        drawArrow(bbox, "right");
        // Look down
        drawArrow(bbox, "down");
        // Look up
        drawArrow(bbox, "up");
        this.invalidateAnimation();

    }

    stopPointcloudOrientation() {
        this.orientationArrows.forEach(a => this.scene.remove(a));
        this.orientationArrows.clear();
        this.pendingUpVector = this.pendingOrientationArrow = undefined;
        this.sendMsg("orientation-close");
        this.invalidateAnimation();
    }

    setupRaycaster() {
        this.raycaster = new THREE.Raycaster();
        this.raycaster.linePrecision = .5;
        this.raycaster.params.Points.threshold = 1;
    }

    setupAxes() {
        const axes = new THREE.AxesHelper(2);
        this.scene.add(axes);
    }

    getCenter(forEachable) {
        const geometry = new THREE.Geometry();
        forEachable.forEach(idx => {
            const item = this.cloudData[idx];
            geometry.vertices.push(new THREE.Vector3(item.x, item.y, item.z));
        });
        return new THREE.Box3().setFromObject(new THREE.Mesh(geometry)).getCenter(new THREE.Vector3());
    }

    getBox3(forEachable) {
        const geometry = new THREE.Geometry();
        forEachable.forEach(idx => {
            const item = this.cloudData[idx];
            geometry.vertices.push(new THREE.Vector3(item.x, item.y, item.z));
        });
        return new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
    }

    destroyGlobalBox() {
        this.scene.remove(this.globalBoxObject);
        this.scene.remove(this.hullObject);
        this.scene.remove(this.globalSphereObject);
        this.hullObject = null;
        this.globalBoxObject = null;
    }

    drawGlobalBox() {
        const gbb = this.drawBBox(this.visibleIndices);
        this.globalBoxObject = gbb[0];
        this.globalBox3 = gbb[1];
        this.globalBoxObject.visible = this.globalBoxMode;
    }

    updateGlobalBox() {
        this.destroyGlobalBox();
        this.drawGlobalBox();
        this.invalidateAnimation();
    }

    drawBBox(forEachableIndices) {
        let geom;
        if (this.hiddenIndices.size > 0) {
            let flat = [];
            if (!forEachableIndices) {
                this.cloudData.forEach(p => {
                    flat.push(p.x, p.y, p.z);
                });
            } else {
                forEachableIndices.forEach(pto => {
                    const p = this.cloudData[pto];
                    flat.push(p.x, p.y, p.z);
                });
            }

            geom = new THREE.BufferGeometry();
            const vertices = new Float32Array(flat);
            geom.addAttribute('position', new THREE.BufferAttribute(vertices, 3));
            geom.computeBoundingBox();
        } else {
            geom = this.cloudGeometry;
            this.cloudGeometry.computeBoundingBox();
        }

        const material = new THREE.LineBasicMaterial({
            color: 0x787878,
            linewidth: 1,
            linecap: 'round',
            linejoin: 'round'
        });
        const bbox = geom.boundingBox;
        const bbo = new THREE.Mesh(geom, material);
        const bh = new BoxHelper(bbo, 0x505050);
        bh.userData = forEachableIndices;
        this.drawBSphere(forEachableIndices);
        this.scene.add(bh);
        return [bh, bbox];
    }

    drawBSphere(arr) {
        const flat = [];

        if (!arr) {
            this.cloudData.forEach(p => {
                flat.push(p.x, p.y, p.z);
            });
        } else {
            arr.forEach(pto => {
                const p = this.cloudData[pto];
                flat.push(p.x, p.y, p.z);
            });
        }
        const sphere = new THREE.Sphere();
        let pts = [];
        if (arr)
            arr.forEach(idx => pts.push(this.cloudData[idx]));
        else
            arr = this.cloudData;
        sphere.setFromPoints(pts);

        const geometry = new THREE.SphereBufferGeometry(sphere.radius, 64, 64);
        const material = new THREE.MeshBasicMaterial({
            color: 0xCACACA,
            wireframe: true
        });
        const bbo = new THREE.Mesh(geometry, material);

        if (this.globalSphereObject)
            this.scene.remove(this.globalSphereObject);
        this.globalSphereObject = bbo;
        this.globalSphere = sphere;
        const cloudPosition = this.getCenter(arr);
        this.globalSphereObject.position.copy(cloudPosition);
        this.globalSphereObject.visible = false;
        this.scene.add(bbo);
    }

    activateTool(tool) {
        if (this.currentTool && this.currentTool.deactivate)
            this.currentTool.deactivate.bind(this.currentTool)();
        if (tool.activate)
            tool.activate.bind(tool)();
        this.currentTool = tool;
    }

    setupTools() {
        this.selector = new Sse3dLassoSelector(this);
        this.rectangleSelector = new Sse3dRectangleSelector(this);
        this.circleSelector = new Sse3dCircleSelector(this);
        this.canvasContainer.addEventListener("mousedown", this.mouseDown.bind(this), false);
        this.canvasContainer.addEventListener("mousemove", this.mouseMove.bind(this), false);
        this.canvasContainer.addEventListener("mouseup", this.mouseUp.bind(this), false);
        this.canvasContainer.addEventListener("wheel", () => this.invalidateAnimation(), false);
        $("body").on('keydown', this.keyDown.bind(this));
        $("body").on('keyup', this.keyUp.bind(this));
        this.activateTool(this.selector);
    }

    orbiterStart() {
        this.orbiting = true;
        this.invalidate2dOverlay();
    }

    orbiterChange() {
        this.invalidate2dOverlay();
    }

    orbiterEnd() {
        this.orbiting = false;
        this.invalidate2dOverlay()
    }

    assignNewClass(pointIndex, classIndex) {
        const item = this.cloudData[pointIndex];
        this.cloudData.byClassIndex[item.classIndex].delete(item);
        item.classIndex = classIndex;
        //this.updateMaximumClassIndex();
        if (!this.cloudData.byClassIndex[item.classIndex])
            this.cloudData.byClassIndex[item.classIndex] = new Set();
        this.cloudData.byClassIndex[item.classIndex].add(item);
        this.selection.delete(pointIndex);
        const obj = this.pointToObject.get(pointIndex);
        if (obj && obj.classIndex !== classIndex) {
            obj.points.splice(obj.points.indexOf(pointIndex), 1);
        }
        this.ungrayIndex(pointIndex);
        this.setColor(pointIndex, this.classesDescriptors.byIndex[classIndex]);
        this.invalidateColor();
    }

    changeTarget(ev) {
        if (this.mouseTargetIndex) {
            const newTarget = new THREE.Vector3().copy(this.cloudData[this.mouseTargetIndex]);
            this.moveCamera(undefined, newTarget);
        }
    }

    keyDown(ev) {
        switch (ev.key) {
            case 'Control':
                this.ctrlDown = true;
                break;
            case 'Delete':
                this.selection.forEach(idx => {
                    this.assignNewClass(idx, 0);
                });
                this.updateClassFilter();
                break;
        }
    }

    keyUp(ev) {
        this.ctrlDown = false;
    }

    mouseDown(ev) {
        if (ev.button == 1 || this.ctrlDown) {
            this.changeTarget(ev);
        } else {
            this.cameraTween.stop();
            this.mouse.down = ev.which;
            this.mouse.downX = ev.pageX;
            this.mouse.downY = ev.pageY;
            this.cameraPresetInfo = undefined;
            if (this.currentTool.mouseDown)
                this.currentTool.mouseDown.bind(this.currentTool)(ev);
            this.invalidateAnimation();
            this.sendMsg("mouse-down", ev);
        }
    }

    mouseUp(ev) {
        this.mouse.down = 0;
        if (this.currentTool.mouseUp)
            this.currentTool.mouseUp.bind(this.currentTool)(ev);
        this.mouse.downX = NaN;
        this.mouse.downY = NaN;
        if (this.mouse.dragged < 2 && this.highlightedIndex && !this.ctrlDown && ev.button != 1) {
            this.processSelection(this.highlightedIndex);
            this.notifySelectionChange();
            this.setSelectionFeedback();
        }

        if (this.mouse.dragged < 4 && this.mouseTargetIndex == undefined
            && (ev.button != 1 && !this.ctrlDown)) {
            this.clearSelection();
            this.displayAll();
        }

        if (this.mouse.dragged < 4 && this.pendingOrientationArrow) {
            const av = this.pendingOrientationArrow.arrowDirection;
            if (this.pendingUpVector) {
                this.endPointcloudOrientation(this.pendingUpVector, av);
            }
            else {
                this.pendingUpVector = av;
                let toHide;
                switch (av) {
                    case "left":
                        toHide = this.orientationArrows.get("right");
                        break;
                    case "right":
                        toHide = this.orientationArrows.get("left");
                        break;
                    case "up":
                        toHide = this.orientationArrows.get("down");
                        break;
                    case "down":
                        toHide = this.orientationArrows.get("up");
                        break;
                    case "front":
                        toHide = this.orientationArrows.get("back");
                        break;
                    case "back":
                        toHide = this.orientationArrows.get("front");
                        break;
                }
                this.scene.remove(toHide);
                this.orientationArrows.delete(toHide);
                this.scene.remove(this.pendingOrientationArrow);
                this.sendMsg("orientation-close");
                this.sendMsg("alert", {
                    autoHide: false,
                    message: "Point cloud orientation: Now select the arrow which points to the FRONT",
                    buttonText: "CANCEL",
                    closeMessage: "orientation-abort",
                    forceCloseMessage: "orientation-close"
                });

            }
        }
        this.mouse.dragged = 0;
        this.invalidate2dOverlay();
        this.sendMsg("mouse-up", ev);
    }

    mouseMove(iev) {
        // Workaround for FF: ev.which and mouseDown.ev.which are different, not on Chrome
        const ev = {
            offsetX: iev.offsetX,
            offsetY: iev.offsetY,
            pageX: iev.pageX,
            pageY: iev.pageY,
            which: this.mouse.down
        };

        this.mouse.x = ((ev.pageX - this.screen.left) / this.screen.width) * 2 - 1;
        this.mouse.y = -((ev.pageY - this.screen.top) / this.screen.height) * 2 + 1;

        if (this.currentTool.mouseMove)
            this.currentTool.mouseMove.bind(this.currentTool)(ev);

        if (this.mouse.down)
            this.mouseDrag(ev);
        this.invalidate2dOverlay();
        this.invalidateAnimation();
        this.sendMsg("mouse-move", ev);
    }

    mouseDrag(ev) {
        if (this.currentTool.mouseDrag)
            this.currentTool.mouseDrag.bind(this.currentTool)(ev);
        this.mouse.dragged++;
        this.sendMsg("mouse-drag", ev);
    }

    setupLight() {
        let light = new THREE.PointLight(0xffffff, 1, 1000);
        light.position.set(0, -50, 50);
        this.scene.add(light);
        light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(50, -50, 0);
        this.scene.add(light);
        light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(50, -50, 50);
        this.scene.add(light);
        light = new THREE.PointLight(0xffffff, 1, 100);
        light.position.set(-50, -50, 50);
        this.scene.add(light);
    }

    notifySelectionChange() {
        this.sendMsg("selection-changed", {selection: this.selection});
    }

    fitView(forEachableIndices, ev3) {
        forEachableIndices = forEachableIndices || this.visibleIndices;

        const eyeVec3 = ev3 || this.camera.position;
        const targetVec3 = this.getCenter(forEachableIndices);
        const line = new THREE.Line3(targetVec3, eyeVec3);
        this.drawBSphere(forEachableIndices);
        const radius = this.globalSphere.radius;
        const angle = this.camera.fov * PI / 360;
        const distanceToCenter = radius / Math.tan(angle);
        const delta = 1.5 * distanceToCenter / line.distance();
        const newEyeVec3 = line.at(delta, new THREE.Vector3());
        this.moveCamera(newEyeVec3, targetVec3);
    }

    get _allIndices() {
        return Array.from(Array(this.cloudData.length).keys());
    }

    get positionArray() {
        return this.cloudGeometry.getAttribute("position").array;
    }

    get colorArray() {
        return this.cloudGeometry.getAttribute("color").array;
    }

    buildPointToObjectMap() {
        this.pointToObject = new Map();
        this.objects.forEach(obj => {
            obj.points.forEach(idx => {
                this.pointToObject.set(idx, obj);
            })
        });
    }

    getPixel(o) {
        return this.pixelProjection.get(o);
    }

    display(objectArray, positionArray, labelArray) {
        this.scene.remove(this.cloudObject);
        const geometry = this.geometry = new THREE.BufferGeometry();
        this.cloudData = [];
        let obj;

        this.objects = new Set(objectArray);
        this.buildPointToObjectMap();
        this.labelArray = labelArray;

        positionArray.forEach((v, i) => {
            switch (i % 3) {
                case 0:
                    obj = {x: v};
                    break;
                case 1:
                    obj.y = v;
                    break;
                case 2:
                    obj.z = v;
                    this.cloudData.push(obj);
                    break;
            }
        });
        const colorArray = [];
        if (labelArray) {
            labelArray.forEach((v, i) => {
                this.cloudData[i].classIndex = v;
                const rgb = this.activeSoc.colorForIndexAsRGBArray(v);
                colorArray.push(rgb[0], rgb[1], rgb[2]);
            });
        }

        geometry.addAttribute('position', new THREE.Float32BufferAttribute(positionArray, 3));
        geometry.addAttribute('color', new THREE.Float32BufferAttribute(colorArray, 3));

        geometry.computeBoundingSphere();

        const material = new THREE.PointsMaterial({size: 2, vertexColors: THREE.VertexColors});
        material.sizeAttenuation = false;

        // build mesh
        this.cloudObject = new THREE.Points(geometry, material);

        this.visibleIndices = new Set([...Array(this.cloudData.length).keys()]);

        this.cloudData.byClassIndex = {};

        this.cloudData.reduce((acc, cur) => {
            if (acc[cur.classIndex])
                acc[cur.classIndex].add(cur);
            else
                acc[cur.classIndex] = new Set([cur]);
            return acc;
        }, this.cloudData.byClassIndex);

        this.cloudGeometry = geometry;
        this.camera.up.set(0, -1, 0);

        this.scene.add(this.cloudObject);

        this.invalidateCounters();
        this.invalidateObjects();
        this.invalidateColor();
        this.invalidatePosition();
        this.invalidateAnimation();

        this.updateClassFilter(-1);

        this.cameraPreset("front", true);
    }

    loadPCDFile(fileUrl) {
        const loader = new THREE.PCDLoader();
        return new Promise((res) => {
            loader.load(fileUrl, (arg) => {
                $("#waiting").addClass("display-none");
                this.display(arg.object, arg.position, arg.label);
                Object.assign(this.meta, {header: arg.header});
                res();
            });
        });

    }

    saveBinaryLabels() {
        this.dataManager.saveBinaryFile(this.props.imageUrl + ".labels", this.cloudData.map(x => x.classIndex));
    }

    saveBinaryObjects() {
        this.dataManager.saveBinaryFile(this.props.imageUrl + ".objects", Array.from(this.objects));
    }

    saveAll() {
        this.saveBinaryLabels();
        this.saveBinaryObjects();
        this.saveMeta();
    }

    saveMeta() {
        Meteor.call("saveData", this.meta);
    }

    start() {
        const serverMeta = SseSamples.findOne({url: this.props.imageUrl});
        this.meta = serverMeta || {url: this.props.imageUrl};
        if (serverMeta) {
            this.meta.socName = serverMeta.socName;
            this.sendMsg("active-soc-name", {value: this.meta.socName});
        } else {
            this.meta.socName = this.activeSoc.name;
        }

        this.sendMsg("currentSample", {data: this.meta});
        const fileUrl = SseGlobals.getFileUrl(this.props.imageUrl);

        this.loadPCDFile(fileUrl).then(() => {
            this.rotateGeometry(this.meta.rotationX, this.meta.rotationY, this.meta.rotationZ);
            this.dataManager.loadBinaryFile(this.props.imageUrl + ".labels")
                .then(result => {
                    this.labelArray = result;
                    this.maxClassIndex = Math.max(...this.labelArray);
                    this.sendMsg("maximum-classIndex", {value: this.maxClassIndex});
                }, () => {
                    this.saveBinaryLabels();
                }).then(() => {

                this.dataManager.loadBinaryFile(this.props.imageUrl + ".objects").then(result => {
                    if (result.forEach)
                        this.display(result, this.positionArray, this.labelArray);
                    else
                        this.display(undefined, this.positionArray, this.labelArray);
                }, () => {
                });
            });
        });
    }
}