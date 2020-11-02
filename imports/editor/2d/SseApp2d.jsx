import React from 'react';


import SseClassChooser from "../../common/SseClassChooser";

import SseEditor2d from "./SseEditor2d";
import SseSliderPanel from "./SseSliderPanel";
import {darkBaseTheme, MuiThemeProvider} from '@material-ui/core/styles';

import SseGlobals from "../../common/SseGlobals";
import {Meteor} from "meteor/meteor";
import SseSnackbar from "../../common/SsePopup";
import {withTracker} from 'meteor/react-meteor-data';
import SseBottomBar from "../../common/SseBottomBar";

import SseConfirmationDialog from "../../common/SseConfirmationDialog";
import {Autorenew} from 'mdi-material-ui';
import SseTheme from "../../common/SseTheme";
import SseToolbar2d from "./SseToolbar2d";
import SseSetOfClasses from "../../common/SseSetOfClasses";
import SseTooltips2d from "./SseTooltips2d";
import tippy from "tippy.js";
import $ from "jquery";
import SseSearchList from "../../common/SseSearchList";

export default class SseApp2d extends React.Component {

    constructor() {
        super();

        this.state = {};

        this.state.imageReady = false;
        this.state.classesReady = false;

        this.classesSets = [];
        Meteor.call("getClassesSets", (err, res) => {
            this.classesSets = res.map(cset => new SseSetOfClasses(cset));
            this.setState({classesReady: true});
        });
    }

    setupTooltips() {
        tippy('[title]', {
            theme: 'sse',
            arrow: true,
            delay: [800, 0]
        })
    }

    componentDidUpdate() {
        this.setupTooltips();
    }

    componentDidMount() {
        this.setupTooltips();
        const sourceImage = $("#sourceImage");
        sourceImage.on("load", () => {
                this.setState({imageReady: true});
        });
        sourceImage.attr("src", SseGlobals.getFileUrl(this.props.imageUrl));
    }

    componentWillUnmount() {
        $("#sourceImage").off();
    }

    render() {
        const ready = this.state.imageReady && this.state.classesReady;
        return (
            <div className="w100 h100">
                <MuiThemeProvider theme={new SseTheme().theme}>
                    <div className="w100 h100 editor">
                        <div className="vflex w100 h100 box1">
                            <SseToolbar2d/>
                            <div className="hflex grow box2 relative h0">
                                <div className="leftside" style={{ width: "300x" }}>
                                    <div>
                                        {ready ? <SseClassChooser classesSets={this.classesSets}/> : null}
                                    </div>
                                    <div className="search" style={{ "color": "black" }}>
                                        <SseSearchList
                                            imageUrl={this.props.imageUrl} />
                                    </div>     
                                </div> 

                                <div id="canvasContainer" className="grow relative">
                                    {ready
                                        ? <SseEditor2d
                                            imageUrl={this.props.imageUrl}/>
                                        : null}
                                    <div id="waiting"
                                         className="hflex flex-align-items-center absolute w100 h100">
                                        <div className="grow vflex flex-align-items-center">
                                            <Autorenew/>
                                        </div>
                                    </div>

                                </div>
                                <SseSliderPanel/>
                            </div>
                            <SseBottomBar/>
                        </div>
                        <SseSnackbar/>
                        <SseConfirmationDialog
                            startMessage="reset-start" endMessage="reset-end"
                            title="Segmentation Reset"
                            text="This will delete all existing polygons and tags, are you sure?"></SseConfirmationDialog>
                    </div>
                    <SseTooltips2d/>
                </MuiThemeProvider>
            </div>
        );
    }
}

