import React from 'react';

import {Close, Delete, MinusCircleOutline, Plus, PlusCircleOutline, Target} from 'mdi-material-ui';
import SseToolbar from "../../common/SseToolbar";
import SseGlobals from "../../common/SseGlobals";
import SseMsg from "../../common/SseMsg";

const UNDEFINED_CLASS = "Undefined Class";

class SseObjectButton extends React.Component {
    constructor() {
        super();
        SseMsg.register(this);
        this.state = {selected: false};
    }

    componentDidMount() {
        this.onMsg("object-select", (arg) => {
            const selected = arg.value == this.props.object;
            this.setState({selected});
        });
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    positionIndicator(backgroundColor = "#56FE45") {
        const w = 15;
        const h = 15;

        const indicatorStyle = {
            width: w + 'px',
            height: h + 'px',
            backgroundColor: backgroundColor
        };
        return (<div
            style={indicatorStyle}
            className="position-indicator">
        </div>)
    }

    onClick() {
        this.sendMsg("object-select", {value: this.props.object});
    }

    render() {
        let color = "black";
        let textColor = "white";
        let label = UNDEFINED_CLASS;
        if (this.props.soc) {
            const props = this.props.soc.propsForIndex(this.props.object.classIndex);
            label = props.label;
            color = props.color;
        }

        return (<div className={"object-button" + (this.state.selected ? " selected" : "")}>
            <button onClick={() => this.onClick()}>
                <div className="hflex flex-align-items-center">
                    {this.positionIndicator(color)}
                    <span>{label}</span>
                </div>
            </button>
        </div>);
    }
}

export default class SseObjectToolbar extends SseToolbar {
    constructor() {
        super();
        this.state = {objects: [], newButtonVisible: false};
    }

    componentDidMount() {
        super.componentDidMount();
        this.addCommand("newObjectCommand", "New Object", false, "Create new object", "object-new", Plus, undefined, "Create Object");
        this.addCommand("deleteObjectCommand", "Delete Object", false, ",", "object-delete", Delete, undefined, "Delete Object");
        this.addCommand("addPointsObjectCommand", "Add Points", false, "", "object-add-points", PlusCircleOutline, "undefined", "Add Points");
        this.addCommand("removePointsObjectCommand", "Remove Points", false, "", "object-remove-points", MinusCircleOutline, "undefined", "Remove Points");
        this.addCommand("unselectObjectCommand", "Unselect Object", false, "", "object-unselect", Close, undefined, undefined);
        this.addCommand("focusObjectCommand", "Focus Object", false, "", "object-focus", Target, undefined, "Focus Object");
        this.setState({ready: true});
        this.retriggerMsg("active-soc");
    }

    wheelScrolling(ev) {
        $(".object-list").get(0).scrollLeft += ev.deltaY > 0 ? 130 : -130;
    }

    updateState() {
        const ssize = this.selection && this.selection.size;
        if (ssize && this.selectedObject) {
            const objPoints = new Set(this.selectedObject.points);
            const selectionArray = Array.from(this.selection);
            const removeButtonVisible = selectionArray.find(idx => objPoints.has(idx)) != undefined;
            const addButtonVisible = selectionArray.find(idx => !objPoints.has(idx)) != undefined;
            this.setState({removeButtonVisible, addButtonVisible});
        } else {
            this.setState({
                removeButtonVisible: false,
                addButtonVisible: false,
                newButtonVisible: !!ssize
            });
        }
    }

    messages() {
        this.onMsg("objects-update", (arg) => {
            const objects = arg.value;
            this.setState({objects});
        });

        this.onMsg("object-select", (arg) => {
            this.setState({objectSelected: arg.value, pointCount: arg.value ? arg.value.points.length : 0});
            this.selectedObject = arg.value;
            this.updateState();
        });

        this.onMsg("active-soc", arg => {
            this.setState({soc: arg.value});
        });

        this.onMsg("selection-changed", (arg) => {

            this.selection = arg.selection;
            this.updateState();

        });

        this.onMsg("update-object-stat", (arg) => {
            this.setState({pointCount: this.state.objectSelected.points.length})
        });


    }

    renderSelection() {
        let label = UNDEFINED_CLASS;
        let color = "black";
        let textColor = "white";
        if (this.state.soc) {
            const props = this.state.soc.propsForIndex(this.state.objectSelected.classIndex);
            label = props.label;
            color = props.color;
            textColor = SseGlobals.computeTextColor(props.color);
        }
        return <div className="vflex">
            <div className="hflex">
                <div className="grow" style={{
                    padding: "3px",
                    backgroundColor: color,
                    color: textColor
                }}>{label + " (" + this.state.pointCount + ' pts)'}</div>
                {<div style={{
                    backgroundColor: color,
                    color: textColor
                }}>{this.renderMiniCommand("unselectObjectCommand")}</div>}
            </div>
            {(!this.state.removeButtonVisible && !this.state.addButtonVisible) ?
                <div className="hflex">
                    {this.renderMiniCommand("deleteObjectCommand", "object-buttons grow")}
                    {this.renderMiniCommand("focusObjectCommand", "object-buttons grow")}
                </div>
                :
                <div className="hflex">
                    {this.state.removeButtonVisible ? this.renderMiniCommand("removePointsObjectCommand", "object-buttons grow") : null}
                    {this.state.addButtonVisible ? this.renderMiniCommand("addPointsObjectCommand", "object-buttons grow") : null}
                </div>

            }
        </div>
    }

    renderEmpty() {
        return (
            <div className="hflex h100 flex-justify-content-center flex-align-items-center">
                {this.state.newButtonVisible ?
                    this.renderMiniCommand("newObjectCommand", "object-buttons") :
                    <div>No Selected Object</div>
                }
            </div>);
    }

    render() {
        if (!this.state.ready)
            return null;
        return (
            <div className="sse-object-toolbar hflex no-shrink">
                <div className="object-selected group">
                    {this.state.objectSelected ? this.renderSelection()
                        : this.renderEmpty()}
                </div>
                <div className="object-list scroller group vflex grow wrap"
                     onWheel={ev => this.wheelScrolling(ev)}>
                    {Array.from(this.state.objects).map((o, idx) => (
                        <SseObjectButton key={"_" + idx}
                                         soc={this.state.soc}
                                         object={o}/>))}
                </div>
            </div>


        )
    }
}