import React from 'react';

import {darkBaseTheme, MuiThemeProvider} from '@material-ui/core/styles';
import SseText from "../common/SseText";
import SseImageThumbnail from "./SseImageThumbnail";

import SseNavigatorToolbar from "./SseNavigatorToolbar";

import {CardText, CardTitle, IconButton, Typography} from '@material-ui/core';

import {withTracker} from 'meteor/react-meteor-data';
import {Meteor} from "meteor/meteor";
import {Link} from 'react-router-dom'
import {ArrowLeftBold, ArrowRightBold, Folder} from 'mdi-material-ui';
import SseTheme from "../common/SseTheme";
import SseGlobals from "../common/SseGlobals";
import SseMsg from "../common/SseMsg";

class SseNavigatorApp extends React.Component {
    constructor() {
        super();
        SseMsg.register(this);
        this.increment = 20;
        this.state = {pageLength: this.increment, selection: new Set()};
    }

    serverCall(props) {

        const params = props.match.params;
        const fi = params.fromIndex || 0;
        const ti = params.pageLength || this.increment;
        if (this.state.data) {
            this.state.data.nextPage = this.state.data.previousPage = null;
            this.setState(this.state);
        }
        Meteor.call("images", params.path, fi, ti, (err, res) => {
            this.setState({data: res});
            if (res) {

                let msg = "";
                if (res.folders.length > 0) {
                    msg += res.folders.length + " folder";
                    if (res.folders.length > 1)
                        msg += "s";
                }
                if (res.images.length > 0) {
                    if (res.folders.length > 0)
                        msg += ", ";
                    msg += res.imagesCount + " image";
                    if (res.imagesCount > 1)
                        msg += "s";
                }
                this.sendMsg("folderStats", {message: msg});

            }else{
                console.log(err);
            }
        });
    }

    UNSAFE_componentWillReceiveProps(props) {
        this.serverCall(props);
    }

    componentDidMount() {
        this.serverCall(this.props);
    }

    startEditing(image) {
        this.props.history.push(image.editUrl);
    }

    render() {
        if (this.state.data == undefined)
            return <div></div>

        if (this.state.data.error){
            return <div>{this.state.data.error}</div>
        }
        return (
            <MuiThemeProvider theme={new SseTheme().theme}>
                <div className="w100">
                    <SseNavigatorToolbar history={this.props.history}/>
                    <div className="sse-pager hflex">
                        <Link to={this.state.data.previousPage || "#"}>
                            <IconButton touch="true"
                                        classes={{"colorPrimary": "white"}}
                                        className={this.state.data.previousPage ? "" : "visibility-hidden"}>
                                <ArrowLeftBold/>
                            </IconButton>
                        </Link>
                        <SseText msgKey="folderStats" className="sse-folder-stats"></SseText>
                        <Link to={this.state.data.nextPage || "#"}>
                            <IconButton touch="true"
                                        classes={{"colorPrimary": "white"}}
                                        className={this.state.data.nextPage ? "" : "visibility-hidden"}>
                                <ArrowRightBold/>
                            </IconButton>
                        </Link>
                    </div>

                        <div className="hflex wrap w100 h100">
                        {this.state.data.folders.map((p) =>
                            (<Link key={p.url} to={p.url}>
                                <div className="vflex flex-align-items-center sse-folder">
                                    <Folder />
                                    <Typography align="center" noWrap
                                    style={{width: "200px"}}>{p.name}</Typography>
                                </div>
                            </Link>)
                        )}
                    </div>
                    <div className="hflex wrap w100 h100">
                        {this.state.data.images.map((image) =>
                            (<div
                                  onClick={() => this.startEditing(image)}
                                  onDoubleClick={() => {this.startEditing(image)}}
                                  key={SseGlobals.getFileUrl(image.url) + Math.random()}>
                                <SseImageThumbnail image={image}
                                                   annotated={this.props.urlMap.get(decodeURIComponent(image.url))}/>
                            </div>)
                        )}
                    </div>

                </div>
            </MuiThemeProvider>
        );
    }
}

export default withTracker((props) => {
    Meteor.subscribe("sse-labeled-images");
    const annotated = SseSamples.find({file: {"$exists": true}}).fetch();
    let urlMap = new Map();
    annotated.forEach(o => urlMap.set(decodeURIComponent(o.url), true));
    return {urlMap};
})(SseNavigatorApp);

