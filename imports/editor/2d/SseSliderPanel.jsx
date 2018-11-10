import React from 'react';
import {withTracker} from "meteor/react-meteor-data";
import SseFloodPanel from "./tools/SseFloodPanel";
import SseLayers from "./SseLayers";
import Slider from "rc-slider";
import SseMsg from "../../common/SseMsg";


export default class SseSliderPanel extends React.Component {

    constructor() {
        super();
        SseMsg.register(this);
        this.state = {opacity: 0.75};
        this.state.filterData = {
            brightness: 0,
            contrast: 0,
            gamma: 1,
            rescale: 1,
            hue: 0,
            saturation: 0,
            lightness: 0
        };
        this.defaultFilterData = Object.assign({}, this.state.filterData);
        this.defaultOpacity = 0.75;
        this.currentPresetIndex = -1;
        this.presets = [
            {
                brightness: 100,
                contrast: 0,
                gamma: 1,
                rescale: 1,
                hue: 0,
                saturation: 100,
                lightness: 0
            },
            {
                brightness: 0,
                contrast: 100,
                gamma: 1,
                rescale: 1,
                hue: 100,
                saturation: 0,
                lightness: 0
            },
            {
                brightness: 100,
                contrast: 100,
                gamma: 1,
                rescale: 1,
                hue: 100,
                saturation: 100,
                lightness: 0
            }
        ]
    }

    resetFilters() {
        Object.assign(this.state.filterData, this.defaultFilterData);
        this.setState(this.state);
        this.sendMsg("filterChange", this.state.filterData);
        this.currentPresetIndex = -1;
    }

    resetAll() {
        Object.assign(this.state.filterData, this.defaultFilterData);
        this.state.opacity = this.defaultOpacity;
        this.setState(this.state);
        this.currentPresetIndex = -1;

    }

    nextPreset() {
        this.currentPresetIndex = (this.currentPresetIndex + 1) % (this.presets.length);
        Object.assign(this.state.filterData, this.presets[this.currentPresetIndex]);
        this.setState(this.state);
        this.sendMsg("filterChange", this.state.filterData);
    }

    modifyInRange(attr, order, min, max, mult = 1) {
        let nv = this.state.filterData[attr] + order * mult;
        nv = Math.min(nv, max);
        nv = Math.max(nv, min);
        this.state.filterData[attr] = nv;
    }

    opacityChange(value) {
        this.sendMsg("opacityChange", {value});
        this.setState({opacity: value})
    }

    filterChange(filterName) {
        return (value) => {
            this.state.filterData[filterName] = value;
            this.sendMsg("filterChange", this.state.filterData);
            this.setState(this.state);
        }
    }

    componentDidMount() {
        this.onMsg("zoomLevel", arg => this.setState({zoomLevel: arg.value}));
        this.onMsg("midi", (arg) => {
            switch (arg.index) {
                case 2:
                    this.modifyInRange("brightness", arg.value, -100, 100, 5);
                    break;
                case 4:
                    this.modifyInRange("contrast", arg.value, -100, 100, 5);
                    break;
                case 7:
                    this.modifyInRange("gamma", arg.value, 1, 5, 0.1);
                    break;
            }
            this.setState(this.state.filterData);
            this.sendMsg("filterChange", this.state.filterData)
        });


        this.onMsg("flood", () => this.setState({visiblePanel: "flood"}));
        this.onMsg("polygon", () => this.setState({visiblePanel: ""}));
        this.onMsg("rectangle", () => this.setState({visiblePanel: ""}));
        this.onMsg("pointer", () => this.setState({visiblePanel: ""}));
        this.onMsg("sse-image-loaded", () => this.resetAll());


    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    render() {
        return (
            <div className="sse-sliders vflex">
                <div className="section"><h1>Editor</h1>
                    <div className="mt3">
                        Zoom Level: {Math.round(this.state.zoomLevel * 100) / 100}x
                    </div>
                    <div className="hflex">
                        <div className="mt3">Objects Opacity</div>
                        <div className="grow ml5">
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={0}
                                max={1}
                                step={0.01}
                                value={this.state.opacity}
                                onChange={this.opacityChange.bind(this)}
                            />
                        </div>
                    </div>
                    <button className="sse-button w100" onClick={() => this.sendMsg("reset-start")}>Reset Segmentation
                    </button>
                </div>
                <div className="grow">
                    <div className={this.state.visiblePanel == "flood" ? "" : "display-none"}>
                        <SseFloodPanel/>
                    </div>
                </div>
                <div className="section"><h1>Image Filters</h1>
                    {/*<Toggle label="Edges" labelPosition="left" className="mt3"*/}
                    {/*onToggle={this.filterChange('edges').bind(this)}/>*/}
                    <div className="hflex">
                        <button className="sse-button grow" onClick={() => this.resetFilters()}>Reset</button>
                        <button className="sse-button grow ml3"
                                onClick={() => this.nextPreset()}>Presets
                        </button>
                    </div>
                    <div className="table sse-sliders-stack">
                        <div className="table-row">
                            <div className="mt3">Brightness</div>

                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={-100}
                                max={100}
                                step={1}
                                value={this.state.filterData.brightness}
                                onChange={this.filterChange('brightness').bind(this)}
                            />

                        </div>
                        <div className="table-row">
                            <div>Contrast</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={-100}
                                max={100}
                                step={1}
                                value={this.state.filterData.contrast}
                                onChange={this.filterChange('contrast').bind(this)}
                            />
                        </div>
                        <div className="table-row">
                            <div>Hue</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={-180}
                                max={180}
                                step={1}
                                value={this.state.filterData.hue}
                                onChange={this.filterChange('hue').bind(this)}
                            />
                        </div>
                        <div className="table-row">
                            <div>Saturation</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={-100}
                                max={100}
                                step={1}
                                value={this.state.filterData.saturation}
                                onChange={this.filterChange('saturation').bind(this)}
                            />
                        </div>
                        <div className="table-row">
                            <div>Lightness</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={-100}
                                max={100}
                                step={1}
                                value={this.state.filterData.lightness}
                                onChange={this.filterChange('lightness').bind(this)}
                            />
                        </div>
                        <div className="table-row">
                            <div>Gamma</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={1}
                                max={5}
                                step={0.01}
                                value={this.state.filterData.gamma}
                                onChange={this.filterChange('gamma').bind(this)}
                            />
                        </div>
                        <div className="table-row">
                            <div>Rescale</div>
                            <Slider
                                style={{marginTop: "2px", marginBottom: "2px"}}
                                min={1}
                                max={5}
                                step={0.01}
                                value={this.state.filterData.rescale}
                                onChange={this.filterChange('rescale').bind(this)}
                            />
                        </div>
                    </div>

                </div>

                <SseLayers/>
            </div>

        );
    }
}
