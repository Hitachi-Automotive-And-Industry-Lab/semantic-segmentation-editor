import React from 'react';
import {Meteor} from "meteor/meteor";
import {withTracker} from 'meteor/react-meteor-data';
import SseApp2d from "./2d/SseApp2d";
import SseApp3d from "./3d/SseApp3d";
import $ from "jquery";

class SseEditorApp extends React.Component {

    render() {
        if (!this.props.subReady)
            return null;
        if (this.props.mode == "2d")
            return <SseApp2d imageUrl={this.props.imageUrl}/>;
        else if (this.props.mode == "3d")
            return <SseApp3d imageUrl={this.props.imageUrl}/>;
        else return null;
    }
}

export default withTracker((props) => {
    $("#waiting").removeClass("display-none");
    const imageUrl = "/" + props.match.params.path;
    let subName = "sse-data-descriptor";
    const subscription = Meteor.subscribe(subName, imageUrl);
    const subReady = subscription.ready();
    const mode = props.match.params.path.endsWith(".pcd") ? "3d" : "2d";
    return {imageUrl, subReady, mode};
})(SseEditorApp);
