import React from 'react';
import {Rotate3D} from "mdi-material-ui";

export default class SseTooltips3d extends React.Component {
    render() {
        return <div className="display-none">
            <div id="selectorCommandHelp">
                <p><strong>Lasso Selection Tool</strong></p>
                <p>Draw a shape around points (mouse right button)</p>
                <p>Depending on active selection mode, enclosed points will be added or removed</p>
            </div>
            <div id="selectionAddCommandHelp">
                <p><strong>Add Selection Mode</strong></p>
                <p className="italic">With this mode, points are added to the current selection</p>
            </div>
            <div id="selectionToggleCommandHelp">
                <p><strong>Toggle Selection Mode</strong></p>
                <p className="italic">With this mode, points are added or removed whether they are currently selected or
                    not</p>
            </div>
            <div id="selectionRemoveCommandHelp">
                <p><strong>Remove Selection Mode</strong></p>
                <p className="italic">With this mode, points are removed from to the current selection</p>
            </div>
            <div id="autoFocusCommandHelp">
                <p>Automatically adapt the view to the current selection</p>
            </div>
            <div id="autoFilterCommandHelp">
                <p>If an object is selected, only object's points are displayed</p>
                <p>Otherwise the first selection gesture reduce displayed points</p>
                <p>Right click anywhere without dragging to display again all points</p>
            </div>
            <div id="viewCameraCommandHelp">
                <p>Move the camera to the origin.</p>
                <p>Use <Rotate3D/> to change the orientation of the camera</p>
            </div>
            <div id="viewCenterCommandHelp">
                <p>Adjust the view to fit all points</p>
            </div>
            <div id="orientationCommandHelp">
                <p>Camera Orientation: let's you choose top and front directions of the camera</p>
            </div>
        </div>

    }
}
