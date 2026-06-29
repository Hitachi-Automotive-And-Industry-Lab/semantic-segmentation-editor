import React from 'react';
import {Button, Dialog, IconButton} from '@material-ui/core';
import MDI, {ChevronRight, Eye, EyeOff} from 'mdi-material-ui';
import SseGlobals from './SseGlobals';
import SseToolbar from "./SseToolbar";
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';

export default class SseClassChooser extends SseToolbar {

    constructor(props) {
        super();
        this.pendingState.counters = {};
        this.classesSets = props.classesSets;
        this.classesSetByName = new Map();
        this.classesSets.map(cset => {
            this.classesSetByName.set(cset.name, cset);
        });
        this.state = {
            counters: {},
            soc: null,
            activeClassIndex: 0,
            mode: null,
        };
    }

    getIcon(objDesc) {
        if (objDesc && MDI[objDesc.icon]) {
            const Comp = MDI[objDesc.icon];
            return <Comp/>;
        }
        return <MDI.Label/>;
    }

    resolveClassesSet(name) {
        const soc = name ? this.classesSetByName.get(name) : undefined;
        if (soc) {
            return soc;
        }
        if (name) {
            console.warn(
                `[SSE] Set of classes "${name}" is not in settings; using "${this.classesSets[0].name}".`
            );
        }
        return this.classesSets[0];
    }

    messages() {
        this.onMsg("classSelection", (arg) => {
            this.setState({activeClassIndex: arg.descriptor.classIndex});
        });

        this.onMsg("classIndex-select", (arg) => {
            this.setState({activeClassIndex: arg.value});
        });

        this.onMsg("class-instance-count", arg => {
            this.pendingState.counters[arg.classIndex] = arg.count;
            this.invalidate();
        });

        this.onMsg("editor-ready", (arg) => {
            const socName = arg && arg.socName;
            if (socName) {
                this.sendMsg("active-soc", {value: this.resolveClassesSet(socName)});
            } else {
                this.setState({mode: 'required-set-chooser'});
            }
        });

        this.onMsg("active-soc", (arg) => {
            this.soc = arg.value;
            this.setState({soc: arg.value});
            this.displayAll();
        });

        this.onMsg("toggle-background-visibility", () => this.toggleBackgroundVisibility());
    }

    displayAll() {
        if (this.state) {
            Object.keys(this.state).forEach(k => {
                if (k.toString().startsWith("mute") || k.toString().startsWith("solo")) {
                    delete this.state[k];
                }
            });
        }
    }

    toggleButton(prop, idx) {
        const o = {};
        const p = this.state[prop + idx] || false;
        o[prop + idx] = !p;
        this.setState(o);
    }

    muteOrSolo(name, argument, idx) {
        if (this.state.counters[argument.classIndex] ||
            (!this.state.counters[argument.classIndex] && this.state[name + idx]) ||
            (name === "mute" && this.state["solo" + idx])) {
            this.toggleButton(name, idx);
            this.sendMsg(name, argument);
        }
    }

    toggleBackgroundVisibility() {
        if (!this.soc) {
            return;
        }
        const backgroundIndex = this.soc.descriptors.findIndex(objDesc => objDesc.classIndex === 0);
        if (backgroundIndex !== -1) {
            this.muteOrSolo("mute", this.soc.descriptors[backgroundIndex], backgroundIndex);
        }
    }

    changeClassesSet(name) {
        let newSoc = name ? this.classesSetByName.get(name) : undefined;
        if (!newSoc) {
            if (name) {
                console.warn(
                    `[SSE] Set of classes "${name}" is not in settings; using "${this.classesSets[0].name}".`
                );
            }
            newSoc = this.classesSets[0];
        }
        const t = this.state.counters;
        const usedClassIndices = Object.keys(t)
            .filter(k => t[k] > 0)
            .map(k => parseInt(k));
        let maxClassIndex = usedClassIndices.length ? Math.max(...usedClassIndices) : 0;

        if (newSoc.descriptors.length > maxClassIndex) {
            this.setState({
                soc: newSoc,
                classes: newSoc.descriptors,
                mode: "normal",
                activeClassIndex: 0
            });
            this.sendMsg("active-soc", {value: newSoc});
        } else {
            this.sendMsg("alert", {
                variant: "error",
                forceCloseMessage: "dismiss-not-enough-classes",
                message: "This set of classes only supports " + newSoc.descriptors.length
                    + " different classes (index from 0 to " + (newSoc.descriptors.length - 1) +
                    ") but the current maximum class index for your data is " + maxClassIndex
            });
        }
    }

    shouldComponentUpdate(np, ns) {
        if (this.state.mode == "set-chooser" && ns.mode == "normal")
            this.sendMsg("dismiss-not-enough-classes");
        return true;
    }

    renderDialog() {
        const {soc} = this.state;
        return (
            <Dialog open={this.state.mode == "set-chooser"}>
                <DialogTitle>Sets of Object Classes</DialogTitle>
                <DialogContent>
                    <div className="vflex">
                        <span>Choose which set to use:</span>
                        <div className="hflex w100 wrap">
                            {this.classesSets.map((cset) => (
                                <Button
                                    onClick={() => this.changeClassesSet(cset.name)}
                                    key={cset.name}>
                                    {cset.name + (soc && cset.name === soc.name ? " (current)" : "")}
                                </Button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => this.setState({mode: "normal"})} color="primary">
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }

    _renderRequiredSetChooser() {
        return (
            <Dialog open={true}>
                <DialogTitle>Choose a Set of Object Classes</DialogTitle>
                <DialogContent>
                    <div className="vflex">
                        <span>Select a labeling set to start annotating:</span>
                        <div className="hflex w100 wrap" style={{marginTop: 8}}>
                            {this.classesSets.map((cset) => (
                                <Button
                                    key={cset.name}
                                    onClick={() => {
                                        this.setState({mode: null});
                                        this.sendMsg("active-soc", {value: cset});
                                    }}>
                                    {cset.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        );
    }

    initSetChange() {
        this.setState({mode: "set-chooser"});
    }

    render() {
        const {soc, mode} = this.state;
        const smallIconStyle = {width: "25px", height: "25px", color: "darkgray"};
        const smallIconSelected = {width: "25px", height: "25px", color: "red"};
        return (
            <div className="sse-class-chooser vflex scroller"
                 style={{"backgroundColor": "#393536", "padding": "5px 5px 0 0"}}>
                {soc && soc.descriptors.map((objDesc, idx) => {
                    const isSelected = objDesc.classIndex == this.state.activeClassIndex;
                    return (
                        <div className="hflex flex-align-items-center no-shrink" key={objDesc.label}>
                            <ChevronRight className="chevron" color={isSelected ? "primary" : "disabled"}/>
                            <Button className="class-button"
                                    onDoubleClick={() => this.sendMsg("class-multi-select", {name: objDesc.label})}
                                    onClick={() => this.sendMsg('classSelection', {descriptor: objDesc})}
                                    style={{
                                        "width": "100%",
                                        "minHeight": "20px",
                                        "margin": "1px",
                                        "backgroundColor": objDesc.color,
                                        "color": SseGlobals.computeTextColor(objDesc.color),
                                        "border": isSelected ? "solid 1px #E53935" : "solid 1px black",
                                        "padding": "0 3px"
                                    }}>
                                <div className="hflex flex-align-items-center w100">
                                    {this.getIcon(objDesc)}<span className="class-label" title={objDesc.label} data-tippy-delay="100">{objDesc.label}</span>
                                </div>
                                <sup>{this.state.counters[objDesc.classIndex] > 0 ? this.state.counters[objDesc.classIndex] : ""}</sup>
                            </Button>
                            {this.props.mode == "3d" ?
                                <div className="hflex">
                                    <IconButton
                                        onClick={() => this.muteOrSolo("mute", objDesc, idx)}
                                        style={this.state["mute" + idx] ? smallIconSelected : smallIconStyle}>
                                        <EyeOff/>
                                    </IconButton>
                                    <IconButton
                                        onClick={() => this.muteOrSolo("solo", objDesc, idx)}
                                        style={this.state["solo" + idx] ? smallIconSelected : smallIconStyle}>
                                        <Eye/>
                                    </IconButton>
                                </div> : null}
                        </div>
                    );
                })}
                {soc && <Button onClick={() => this.initSetChange()}>Classes Sets</Button>}
                {mode === 'required-set-chooser' && this._renderRequiredSetChooser()}
                {this.renderDialog()}
            </div>
        );
    }
}
