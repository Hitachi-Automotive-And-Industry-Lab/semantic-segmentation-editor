import React from 'react';
import SseToolbar from "../../common/SseToolbar";
import {
    ArrangeBringForward, ArrangeSendBackward, AutoFix, CallMerge, CheckOutline, ContentCut, CropLandscape,
    CursorDefaultOutline, DeleteForever, Download, CodeJson, Looks, Redo, Undo, VectorPolygon
} from 'mdi-material-ui';
import SseBranding from "../../common/SseBranding";

export default class SseToolbar2d extends SseToolbar {

    componentDidMount() {
        super.componentDidMount();
        this.addCommand("undoCommand", "Undo", false, "Ctrl+Z", "undo", Undo, "disabled");
        this.addCommand("redoCommand", "Redo", false, "Ctrl+Y", "redo", Redo, "disabled");
        this.addCommand("pointerCommand", "Manipulation Tool", 1, "Alt", "pointer", CursorDefaultOutline);
        this.addCommand("cutCommand", "Cut/Expand Tool", 1, "C", "cut", ContentCut, "disabled");
        this.addCommand("rectangleCommand", "Rectangle Tool", 1, "R", "rectangle", CropLandscape);
        this.addCommand("polygonCommand", "Polygon Tool", 1, "P", "polygon", VectorPolygon);
        this.addCommand("magicCommand", "Magic Tool", 1, "A", "flood", AutoFix);
        this.addCommand("deleteCommand", "Delete Selection", false, "Del", "delete", DeleteForever, "disabled");
        this.addCommand("downCommand", "Send Backward", false, "Down", "moveback", ArrangeSendBackward, "disabled");
        this.addCommand("upCommand", "Bring Forward", false, "Up", "movefront", ArrangeBringForward, "disabled");
        this.addCommand("mergeCommand", "Merge Polygons", false, "M", "merge", CallMerge, "disabled");
        this.addCommand("followCommand", "Follow Polygon Outline", false, "F", "follow", Looks, "disabled");
        this.addCommand("enterCommand", "Create Polygon", false, "Enter", "closepolygon", CheckOutline, "disabled");
        this.addCommand("jsonCommand", "Show JSON Output", false, "J", "openJsonView", CodeJson);
        this.addCommand("downloadCommand", "Download", false, "D", "download", Download);
        this.sendMsg("pointer");

    }

    render() {
        return (
            <div className="hflex flex-justify-content-space-around sse-toolbar no-shrink">

                <SseBranding/>
                <div className="group">
                    {this.renderCommand("undoCommand")}
                    {this.renderCommand("redoCommand")}
                </div>
                <div className="group">
                    {this.renderCommand("pointerCommand")}
                    {this.renderCommand("cutCommand")}
                </div>
                <div className="group">
                    {this.renderCommand("rectangleCommand")}
                    {this.renderCommand("polygonCommand")}
                    {this.renderCommand("magicCommand")}
                </div>
                <div className="group">
                    {this.renderCommand("deleteCommand")}
                    {this.renderCommand("downCommand")}
                    {this.renderCommand("upCommand")}
                    {this.renderCommand("mergeCommand")}
                    {this.renderCommand("followCommand")}
                    {this.renderCommand("enterCommand")}
                </div>
                <div className="group">
                    {this.renderCommand("jsonCommand")}
                    {this.renderCommand("downloadCommand")}
                </div>

            </div>
        )
    }


}