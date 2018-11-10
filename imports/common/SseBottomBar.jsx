import React from "react";
import SseText from "./SseText";
import {Button, Dialog, TextField} from "@material-ui/core";
import {Meteor} from "meteor/meteor";
import {withTracker} from "meteor/react-meteor-data";
import _ from "underscore";
import DialogActions from "@material-ui/core/DialogActions";
import DialogContent from "@material-ui/core/DialogContent";
import DialogTitle from "@material-ui/core/DialogTitle";
import SseMsg from "./SseMsg";

class SseBottomBar extends React.Component {

    constructor() {
        super();
        SseMsg.register(this);
        this.state = {helpString: "", open: false, tags: []};
        this.hooks = {};
    }

    componentDidMount() {
        this.onMsg("enableCommand", arg => {
            this.hooks[arg.key] = arg.text;
        });
        this.onMsg("disableCommand", arg => {
            delete this.hooks[arg.key];
        });

        this.onMsg("currentSample", (arg) => {
            this.currentSample = arg.data;
            this.setState({tags: this.currentSample.tags || []})
        });
        this.retriggerMsg("currentSample");
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    handleOpen = () => {
        this.setState({open: true});
        this.cancelTags = this.state.tags.concat();
    };

    tagsArrayToString(arr) {
        return arr.toString();
    }

    tagsStringToArray(str) {
        return _.uniq(str.replace(/^,/, "").replace(",,", ",").split(",").map(t => t.trim()));
    }

    handleClose = () => {
        this.setState({open: false});
        this.currentSample.tags = this.tagsStringToArray($("#tagField").val()).filter(x => x);
        this.sendMsg("tagsChanged");
    };

    handleCancel = () => {
        this.setState({open: false, tags: this.cancelTags});
    };

    addTag(t) {
        this.setState({tags: this.tagsStringToArray(this.tagsArrayToString(this.state.tags) + "," + t)});
    }

    render() {

        return (
            <div className={this.props.className}
                 style={{
                     "backgroundColor": "#393536",
                     "padding": "5px",
                     "borderBottom": "solid 1px #343434"
                 }}>
                <div className="hflex">
                    <div className="grow hflex flex-align-items-center children-margin">
                        <SseText msgKey="status"/>
                        <button className="sse-button" onClick={() => this.handleOpen()}>Set Tags</button>

                        {this.state.tags.map(t => (<div key={t} className="sse-tag">{t}</div>))}
                    </div>
                    <SseText msgKey="bottom-right-label"/>
                </div>
                <Dialog open={this.state.open}>
                    <DialogTitle>Tags</DialogTitle>
                    <DialogContent>
                        <div className="vflex">
                            <span>Type a list of comma-separated tags</span>
                            <TextField className="w100" id="tagField"
                                       style={{width: "100%"}}

                                       value={this.state.tags}
                                       onChange={(event) => (this.setState({
                                           tags: this.tagsStringToArray(event.target.value),
                                       }))}
                            />
                            <div className="m5-bottom m5-top">Tags previously used</div>
                            <div className="hflex w100 wrap">
                                {this.props.appProps.tags.value.map(t => (
                                    <div
                                        onClick={() => this.addTag(t)}
                                        key={t}
                                        className="sse-tag m5-bottom cursor-pointer">{t}</div>))}
                            </div>
                        </div>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={this.handleCancel} color="primary">
                            Cancel
                        </Button>
                        <Button onClick={this.handleClose} color="default" autoFocus>
                            OK
                        </Button>
                    </DialogActions>
                </Dialog>
            </div>
        );
    }
}

export default withTracker((props) => {
    Meteor.subscribe("sse-props");
    const aps = SseProps.find().fetch();
    const appProps = _.indexBy(aps, "key");
    if (!appProps.tags)
        appProps.tags = {value: []};

    return {appProps};
})(SseBottomBar);
