import React from 'react';

import {withTracker} from 'meteor/react-meteor-data';
import Slider from 'rc-slider';
import SseMsg from "../../../common/SseMsg";

export default class SseFloodPanel extends React.Component {

    constructor() {
        super();
        SseMsg.register(this);
        this.state = {};
        this.state.data = {
            threshold: 15,
            blurRadius: 5
        }

    }

    modifyInRange(attr, order, min, max, mult = 1) {
        let nv = this.state.data[attr] + order * mult;
        nv = Math.min(nv, max);
        nv = Math.max(nv, min);
        this.state.data[attr] = nv;
    }

    dataChange(filterName) {
        return (value) => {
            this.state.data[filterName] = value;
            this.sendMsg("flood-properties", this.state.data);
        }
    }

    componentDidMount() {
        this.onMsg("flood-properties", (arg) => {
            this.setState({data: arg});
        });
        this.onMsg("midi", (arg) => {
            switch (arg.index) {
                case 5:
                    this.modifyInRange("threshold", arg.value, 1, 150, 1);
                    break;
                case 6:
                    this.modifyInRange("blurRadius", arg.value, 1, 30, 1);
                    break;
            }
            this.setState(this.state.data);
            this.sendMsg("flood-properties", this.state.data)
        });
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    render() {
        return (
            <div>
                <h1>Flood Tool</h1>
                <div>Color Threshold</div>
                <Slider
                    style={{marginTop: "2px", marginBottom: "2px"}}
                    min={1}
                    max={100}
                    step={.5}
                    value={this.state.data.threshold}
                    onChange={this.dataChange('threshold').bind(this)}
                />
                <div>Blur Radius</div>
                <Slider
                    style={{marginTop: "2px", marginBottom: "2px"}}
                    min={1}
                    max={30}
                    step={1}
                    value={this.state.data.blurRadius}
                    onChange={this.dataChange('blurRadius').bind(this)}
                />
            </div>
        );
    }
}
