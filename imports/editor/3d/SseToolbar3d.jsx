import React from 'react';

import SseToolbar from "../../common/SseToolbar";
import SseBranding from "../../common/SseBranding";
import {
    CircleOutline, FileDownloadOutline, Gesture, Minus, Plus, PlusMinus, Redo, SquareOutline,
    Undo
} from 'mdi-material-ui';

export default class SseToolbar3d extends SseToolbar {

    constructor() {
        super();
        this.state = {pointSize: 2}
    }


    componentDidMount() {
        super.componentDidMount();


        this.addCommand("selectorCommand", "Lasso Selector", 1, "H", "selector", Gesture, undefined, undefined);
        this.addCommand("rectangleCommand", "Rectangle Selector", 1, "J", "rectangle", SquareOutline, undefined, undefined);
        this.addCommand("circleCommand", "Circle Selector", 1, "K", "circle", CircleOutline, undefined, undefined);

        this.addCommand("selectionAddCommand", "Selection Mode: Add", 2, "Y", "selection-mode-add", Plus, undefined, undefined);
        this.addCommand("selectionToggleCommand", "Selection Mode: Toggle", 2, "U", "selection-mode-toggle", PlusMinus, undefined, undefined);
        this.addCommand("selectionRemoveCommand", "Selection Mode: Remove", 2, "I", "selection-mode-remove", Minus, undefined, undefined);

        this.addCommand("moreClusterCommand", "More Cluster", false, "ctrl+up", "cluster-more", Plus, undefined, "Ctrl \u2191");
        this.addCommand("lessClusterCommand", "Less Cluster", false, "ctrl+down", "cluster-less", Minus, undefined, "Ctrl \u2193");


        this.addCommand("autoFilterCommand", "Auto Filter", false, "L", "autoFilter-checkbox");
        this.addCommand("autoFocusCommand", "Auto Focus", false, "S", "autoFocus-checkbox");
        this.addCommand("globalboxCommand", "Bounding Box", false, "G", "globalbox-checkbox");
        this.addCommand("selectionOutlineCommand", "Selection Outline", false, "V", "selectionOutline-checkbox");

        this.addCommand("undoCommand", "Undo", false, "Ctrl+Z", "undo", Undo, "disabled");
        this.addCommand("redoCommand", "Redo", false, "Ctrl+Y", "redo", Redo, "disabled");
        this.addCommand("downloadTextCommand", "PCD Output as Text", false, "", "downloadText", FileDownloadOutline);
        this.addCommand("downloadFileCommand", "PCD Output as File", false, "", "downloadFile", FileDownloadOutline);
        this.sendMsg("selector");
        this.sendMsg("selection-mode-add");
    }

    render() {
        return (
            <div className="hflex flex-justify-content-space-around sse-toolbar toolbar-3d no-shrink">
                <SseBranding/>
                <div className="vflex">
                    <div className="tool-title">Selection Tool</div>
                    <div className="hflex">
                        {this.renderCommand("selectorCommand")}
                        {this.renderCommand("rectangleCommand")}
                        {this.renderCommand("circleCommand")}
                    </div>
                </div>
                <div className="vflex">
                    <div className="tool-title">Selection Mode</div>
                    <div className="hflex">
                        {this.renderCommand("selectionAddCommand")}
                        {this.renderCommand("selectionToggleCommand")}
                        {this.renderCommand("selectionRemoveCommand")}
                    </div>
                </div>
                <div className="vflex">
                    <div className="tool-title">View Interaction</div>
                    <div className="v group">
                        {this.renderCheckbox("autoFocusCommand", false)}
                        {this.renderCheckbox("autoFilterCommand", false)}
                    </div>
                </div>
                <div className="vflex">
                    <div className="tool-title">Visual Helpers</div>
                    <div className="v group">
                        {this.renderCheckbox("selectionOutlineCommand", true)}
                        {this.renderCheckbox("globalboxCommand", true)}
                    </div>
                </div>
                <div className="vflex">
                    <div className="tool-title">PCD Output</div>
                    <div className="hflex">
                        {this.renderCommand("downloadTextCommand")}
                        {this.renderCommand("downloadFileCommand")}
                    </div>
                </div>
            </div>
        )
    }
}