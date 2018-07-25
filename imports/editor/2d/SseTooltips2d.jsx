import React from 'react';

export default class SseTooltips2d extends React.Component {
    render() {
        return <div className="display-none">
            <div id="polygonCommandHelp">
                <p><strong>Polygon Drawing Tool</strong></p>
                <p className="italic">Click and/or drag to create points</p>
                <p>Type ESC to remove last created points in reverse order</p>
                <p>Drag the mouse pointer or hold Shift to create a complex polygon without having to click for
                    each point</p>
                <p>Type ENTER or double click the first point to close the polygon</p>
            </div>
            <div id="magicCommandHelp">
                <p><strong>Magic Tool</strong></p>
                <p className="italic">Create a polygon automatically using contrast threshold detection </p>
                <p>This tool is only useful to draw the outline of objects that have sharp contrasted edges
                    (examples: sky, lane marking)</p>
                <p>Click inside the area you want to outline, then adjusts any sliders on the right to adjust
                    the result</p>
                <p>Type ENTER to validate the result</p>
            </div>

            <div id="pointerCommandHelp">
                <p><strong>Manipulation Tool</strong></p>
                <p className="italic">Select, move and add point(s) to existing polygons</p>
                <p>Click inside a polygon to select it</p>
                <p>Click a point to select it</p>
                <p>Draw a lasso around multiple points to select them</p>
                <p>Drag a point with the mouse to move it</p>
                <p>Hold Shift to separate points that belongs to more than one polygon</p>
                <p>Click the line of a polygon to create a new point and drag the newly created point to place
                    it</p>
            </div>
            <div id="cutCommandHelp">
                <p><strong>Cutting/Expanding Tool</strong></p>
                <p className="italic">Modify the shape of an existing polygon</p>
                <p>Select the polygon you want to modify</p>
                <p>Draw a line starting and ending on the outline of a polygon</p>
                <p>The new line replace the existing path between starting and ending points</p>
                <p>The resulting shape is always the largest one</p>
            </div>
            <div id="followCommandHelp">
                <p><strong>Contiguous Polygon Tool</strong></p>
                <p className="italic">Create contiguous polygons easily</p>
                <p>Start a new polygon with the Polygon Drawing Tool</p>
                <p>Create the starting point by snapping
                    to the outline of the polygon you want to workaround</p>
                <p>Create the ending point by snapping to another outline, at this point you must have a
                    straight line crossing one or more existing polygons</p>
                <p>Hit F one or several times to choose what workaround path to use</p>
            </div>
        </div>
    }
}