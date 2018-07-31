import React from 'react';

import SseClassChooser from "../../common/SseClassChooser";

import {darkBaseTheme, MuiThemeProvider} from '@material-ui/core/styles';

import {Meteor} from "meteor/meteor";
import SseSnackbar from "../../common/SsePopup";
import {withTracker} from 'meteor/react-meteor-data';
import SseBottomBar from "../../common/SseBottomBar";

import SseConfirmationDialog from "../../common/SseConfirmationDialog";
import {Autorenew} from 'mdi-material-ui';
import SseTheme from "../../common/SseTheme";
import SseSetOfClasses from "../../common/SseSetOfClasses";
import SseEditor3d from "./SseEditor3d";
import SseToolbar3d from "./SseToolbar3d";
import SseCameraToolbar from "./SseCameraToolbar";
import SseObjectToolbar from "./SseObjectToolbar";
import tippy from "tippy.js";
import SseTooltips3d from "./SseTooltips3d";


export default class SseApp3d extends React.Component {

    constructor() {
        super();

        this.state = {};

        this.classesSets = [];
        Meteor.call("getClassesSets", (err, res) => {
            this.classesSets = res.map(cset => new SseSetOfClasses(cset));
            this.setState({classesReady: true});
        });
    }

    setupTooltips() {
        setTimeout(() => tippy('[title]', {
            theme: 'sse',
            arrow: true,
            delay: [800, 0]
        }), 2000);
    }

    componentDidUpdate() {
        this.setupTooltips();
    }

    componentDidMount() {
        this.setupTooltips();
    }

    render() {
        if (!this.state.classesReady)
            return null;
        return (
            <div className="w100 h100">
                <SseTooltips3d/>
                <MuiThemeProvider
                    theme={new SseTheme().theme}>
                    <div className="w100 h100 editor">
                        <div className="vflex w100 h100 box1">
                            <SseToolbar3d/>
                            <div className="hflex grow box2 h0">
                                <SseClassChooser
                                    mode="3d"
                                    classesSets={this.classesSets
                                    }
                                />
                                <div
                                    className="vflex grow relative">
                                    <div
                                        className="hflex grow">
                                        <div
                                            id="canvasContainer"
                                            className="grow relative">
                                            <SseEditor3d
                                                imageUrl={this.props.imageUrl
                                                }
                                            />
                                            <div
                                                id="waiting"
                                                className="hflex flex-align-items-center absolute w100 h100">
                                                < div
                                                    className="grow vflex flex-align-items-center">
                                                    <Autorenew/>
                                                </div>
                                            </div>

                                        </div>
                                        <SseCameraToolbar/>
                                    </div>
                                    <SseObjectToolbar/>
                                </div>

                            </div>
                            <SseBottomBar/>
                        </div>
                        <SseSnackbar/>
                        <SseConfirmationDialog
                            startMessage="reset-start"
                            endMessage="reset-end"
                            title="Segmentation Reset"
                            text="This will remove all existing polygons and tags, are you sure?">
                        </SseConfirmationDialog>
                    </div>
                </MuiThemeProvider>
            </div>
        )
            ;
    }
}




