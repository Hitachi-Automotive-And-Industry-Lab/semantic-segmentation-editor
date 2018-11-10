# Semantic Segmentation Editor

A web based labeling tool for creating AI training data sets (2D and 3D).
The tool has been developed in the context of autonomous driving research.
It supports images (.jpg or .png) and point clouds (.pcd).
It is a [Meteor](http://www.meteor.com) app developed with [React](http://reactjs.org),
[Paper.js](http://paperjs.org/) and [three.js](https://threejs.org/).

## Bitmap Image Editor

:movie_camera: [VIDEO: Bitmap labeling overview](https://vimeo.com/282003466)

:rocket: [DEMO: Bitmap editor](http://sse.hup.li/edit/%2Fsamples%2Fbitmap.png)

<a href="https://github.com/dmandrioli/sse-extra/raw/master/Capture2D1.PNG"><img width="400" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture2D1.jpg"/></a>
<a href="https://github.com/dmandrioli/sse-extra/raw/master/Capture2D2.PNG"><img width="400" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture2D2.jpg"/></a>

## PCD Point Cloud Editor

:movie_camera: [VIDEO: Point cloud labeling overview](https://vimeo.com/282222626)

:rocket: [DEMO: Point cloud editor](http://sse.hup.li/edit/%2Fsamples%2Fpointcloud.pcd)

<a href="https://github.com/dmandrioli/sse-extra/raw/master/Capture3D1.PNG"><img width="400" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture3D1.jpg"/></a>
<a href="https://github.com/dmandrioli/sse-extra/raw/master/Capture3D2.PNG"><img width="400" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture3D2.jpg"/></a>

## How to run

#### Install Meteor (OSX or Linux) 

```shell
curl https://install.meteor.com/ | sh
```

or download [Meteor Windows Installer](http://www.meteor.com/install)

#### Download and unzip latest version from [here](https://github.com/Hitachi-Automotive-And-Industry-Lab/semantic-segmentation-editor/releases)

#### Start the application
```shell
cd semantic-segmentation-editor-x.x.x
meteor npm install
meteor npm start
```


The editor will run by default on `http://localhost:3000`

__(Optional) Edit settings.json__
 
 By default, images are served from <code>your_home_dir/sse-images</code> and pointcloud binary segmentation data are stored in <code>your_home_dir/sse-internal</code>.
 You can configure these folders in settings.json by modifying <code>images-folder</code> and <code>internal-folder</code> properties. 
On Windows, use '/' separators, example <code>c:/Users/john/images</code>



Check [Meteor Environment Variables](https://docs.meteor.com/environment-variables.html) to configure your app
(`MONGO_URL`, `DISABLE_WEBSOCKETS`, etc...)


### Running the app using Docker

A Docker image of  v1.0.0 is available [here](https://hub.docker.com/r/hitachiail/semantic-segmentation-editor/)

To run it:
```
docker pull hitachiail/semantic-segmentation-editor
docker run -it -p PORT:3000 -v INPUT_FOLDER:/mnt/images -v OUTPUT_FOLDER:/mnt/pcd hitachiail/semantic-segmentation-editor:latest
```
Replace <code>PORT</code>, <code>INPUT_FOLDER</code> and <code>OUTPUT_FOLDER</code> according to your needs.

## Configuration File: settings.json

```
{
  "configuration": {
    "images-folder": "/mnt/images", // The root folder containing images and PCD files
    "internal-folder": "/mnt/pointcloud_data" // Segmentation data (only 3D) will be stored in this folder
  },
  // The different sets of classes available in the tool
  // For object classes, only the 'label' field is mandatory
  // The icon field can be set with an icon from the mdi-material-ui package
  "sets-of-classes": [
    {
      "name": "Cityscapes", "objects": [
      {"label": "VOID", "color": "#CFCFCF"},
      {"label": "Road", "color": "#804080", "icon": "Road"},
      {"label": "Sidewalk", "color": "#F423E8", "icon": "NaturePeople"},
      {"label": "Parking", "color": "#FAAAA0", "icon": "Parking"},
      {"label": "Rail Track", "color": "#E6968C", "icon": "Train"},
      {"label": "Person", "color": "#DC143C", "icon": "Walk"},
      {"label": "Rider", "color": "#FF0000", "icon": "Motorbike"},
      {"label": "Car", "color": "#0000E8", "icon": "Car"}
    },
    { ... }
  ]
}
```

## How to use

The editor is built around 3 different screens:

The file navigator let's you browse available files to select a bitmap images or a point cloud for labeling
<img width="300" src="https://github.com/dmandrioli/sse-extra/raw/master/CaptureN1.jpg"/>
  
The bitmap image editor is dedicated to the labeling of jpg and png files by drawing polygons
<img width="300" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture2D2.jpg"/>

The point cloud editor is dedicated to the labeling of point clouds by creating objects made of subsets of 3D points
<img width="300" src="https://github.com/dmandrioli/sse-extra/raw/master/Capture3D3.jpg"/>


### Using the bitmap image editor

There are several tools to create labeling polygons:
#### Polygon Drawing Tool (P)
  - Click and/or drag to create points
  - Type ESC to remove last created points in reverse order 
  - Drag the mouse pointer or hold Shift to create a complex polygon without having to click for each point
  - Type ENTER or double click the first point to close the polygon

#### Magic Tool (A)
  - Create a polygon automatically using contrast threshold detection
  - This tool is only useful to draw the outline of objects that have sharp contrasted edges (examples: sky, lane
marking)
  - Click inside the area you want to outline, then adjusts any sliders on the right to adjust the result
  - Type ENTER to validate the result

#### Manipulation Tool (Alt)
  - Select, move and add point(s) to existing polygons
  - Click inside a polygon to select it
  - Click a point to select it
  - Draw a lasso around multiple points to select them
  - Drag a point with the mouse to move it
  - Hold Shift to separate points that belongs to more than one polygon
  - Click the line of a polygon to create a new point and drag the newly created point to place it

#### Cutting/Expanding Tool (C)
  - Modify the shape of an existing polygon
  - Select the polygon you want to modify
  - Draw a line starting and ending on the outline of a polygon
  - The new line replace the existing path between starting and ending points
  - The resulting shape is always the largest one

#### Contiguous Polygon Tool (F)
  - Create contiguous polygons easily</p>
  - Start a new polygon with the Polygon Drawing Tool</p> 
  - Create the starting point by snapping to the outline of the polygon you want to workaround
  - Create the ending point by snapping to another outline, at this point you must have a straight line crossing one or more existing polygons
  - Hit F one or several times to choose what workaround path to use

### Using the point cloud editor

  - Mouse left button: Rotate the point cloud around the current focused point (the center of the point cloud by
  default), clickon a single point to add it to the current selection
  - Mouse wheel: Zoom in/out
  - Mouse middle button (or Ctrl+Click): Change the target of the camera
  - Mouse right button: Used to select multiple points at the same time depending on the current Selection Tool and
  Selection Mode.

### API Endpoints

 - <code>/api/listing</code>: List all annotated images
 - <code>/api/json/[PATH_TO_FILE]</code>: (2D only) Get the polygons and other data for that file
 - <code>/api/pcdtext/[PATH_TO_FILE]</code>: (3D only) Get the labeling of a pcd file using 2 addditional
 columns: <code>label</code>
 and <code>object</code>
 -  <code>/api/pcdfile/[PATH_TO_FILE]</code>: (3D only) The same but returned as "plain/text" attachment file download


