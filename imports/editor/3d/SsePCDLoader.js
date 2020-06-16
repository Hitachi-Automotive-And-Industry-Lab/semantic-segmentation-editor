// Based on three.js PCDLoader class (only support ASCII PCD files)
export default class SsePCDLoader {
    constructor(THREE) {
        THREE.PCDLoader = function (serverMode) {
            this.serverMode = serverMode;
        };

        THREE.PCDLoader.prototype = {
            constructor: THREE.PCDLoader,
            load: function (url, onLoad, onProgress, onError) {
                var scope = this;
                var loader = new THREE.FileLoader(scope.manager);
                loader.setResponseType('arraybuffer');
                loader.load(url, function (data) {
                    onLoad(scope.parse(data, url));
                }, onProgress, onError);

            },

            parse: function (data, url) {
                function decompressLZF( inData, outLength ) {
                    // from https://gitlab.com/taketwo/three-pcd-loader/blob/master/decompress-lzf.js
                    var inLength = inData.length;
                    var outData = new Uint8Array( outLength );
                    var inPtr = 0;
                    var outPtr = 0;
                    var ctrl;
                    var len;
                    var ref;
                    do {
                        ctrl = inData[ inPtr ++ ];
                        if ( ctrl < ( 1 << 5 ) ) {
                            ctrl ++;
                            if ( outPtr + ctrl > outLength ) throw new Error( 'Output buffer is not large enough' );
                            if ( inPtr + ctrl > inLength ) throw new Error( 'Invalid compressed data' );
                            do {
                                outData[ outPtr ++ ] = inData[ inPtr ++ ];
                            } while ( -- ctrl );
                        } else {
                            len = ctrl >> 5;
                            ref = outPtr - ( ( ctrl & 0x1f ) << 8 ) - 1;
                            if ( inPtr >= inLength ) throw new Error( 'Invalid compressed data' );
                            if ( len === 7 ) {
                                len += inData[ inPtr ++ ];
                                if ( inPtr >= inLength ) throw new Error( 'Invalid compressed data' );
                            }
                            ref -= inData[ inPtr ++ ];
                            if ( outPtr + len + 2 > outLength ) throw new Error( 'Output buffer is not large enough' );
                            if ( ref < 0 ) throw new Error( 'Invalid compressed data' );
                            if ( ref >= outPtr ) throw new Error( 'Invalid compressed data' );
                            do {
                                outData[ outPtr ++ ] = outData[ ref ++ ];
                            } while ( -- len + 2 );
                        }
                    } while ( inPtr < inLength );
                    return outData;
                }

                function parseHeader(data) {
                    var PCDheader = {};
                    var result1 = data.search(/[\r\n]DATA\s(\S*)\s/i);
                    var result2 = /[\r\n]DATA\s(\S*)\s/i.exec(data.substr(result1 - 1));
                    PCDheader.data = result2[1];
                    PCDheader.headerLen = result2[0].length + result1;
                    PCDheader.str = data.substr(0, PCDheader.headerLen);

                    // remove comments
                    PCDheader.str = PCDheader.str.replace(/\#.*/gi, '');

                    // parse
                    PCDheader.version = /VERSION (.*)/i.exec(PCDheader.str);
                    PCDheader.fields = /FIELDS (.*)/i.exec(PCDheader.str);
                    PCDheader.size = /SIZE (.*)/i.exec(PCDheader.str);
                    PCDheader.type = /TYPE (.*)/i.exec(PCDheader.str);
                    PCDheader.count = /COUNT (.*)/i.exec(PCDheader.str);
                    PCDheader.width = /WIDTH (.*)/i.exec(PCDheader.str);
                    PCDheader.height = /HEIGHT (.*)/i.exec(PCDheader.str);
                    PCDheader.viewpoint = /VIEWPOINT (.*)/i.exec(PCDheader.str);
                    PCDheader.points = /POINTS (.*)/i.exec(PCDheader.str);
                    // evaluate
                    if (PCDheader.version !== null)
                        PCDheader.version = parseFloat(PCDheader.version[1]);
                    if (PCDheader.fields !== null)
                        PCDheader.fields = PCDheader.fields[1].split(' ');
                    if (PCDheader.type !== null)
                        PCDheader.type = PCDheader.type[1].split(' ');
                    if (PCDheader.width !== null)
                        PCDheader.width = parseInt(PCDheader.width[1]);
                    if (PCDheader.height !== null)
                        PCDheader.height = parseInt(PCDheader.height[1]);
                    if (PCDheader.viewpoint !== null)
                        PCDheader.viewpoint = PCDheader.viewpoint[1];
                    if (PCDheader.points !== null)
                        PCDheader.points = parseInt(PCDheader.points[1], 10);
                    if (PCDheader.points === null)
                        PCDheader.points = PCDheader.width * PCDheader.height;
                    if (PCDheader.size !== null) {
                        PCDheader.size = PCDheader.size[1].split(' ').map(function (x) {
                            return parseInt(x, 10);
                        });
                    }

                    const split = PCDheader.viewpoint.split(" ");
                    PCDheader.viewpoint = {
                        tx: split[0], ty: split[1], tz: split[2],
                        qw: split[3], qx: split[4], qy: split[5], qz: split[6]
                    };
                    if (PCDheader.count !== null) {
                        PCDheader.count = PCDheader.count[1].split(' ').map(function (x) {
                            return parseInt(x, 10);
                        });
                    } else {
                        PCDheader.count = [];
                        for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
                            PCDheader.count.push(1);
                        }
                    }

                    PCDheader.offset = {};

                    var sizeSum = 0;

                    for (let i = 0, l = PCDheader.fields.length; i < l; i++) {
                        if (PCDheader.data === 'ascii') {
                            PCDheader.offset[PCDheader.fields[i]] = i;
                        } else {
                            PCDheader.offset[PCDheader.fields[i]] = sizeSum;
                            sizeSum += PCDheader.size[i];
                        }
                    }
                    PCDheader.rowSize = sizeSum;
                    return PCDheader;
                }

                var textData = this.serverMode ? (new Buffer(data)).toString() : THREE.LoaderUtils.decodeText(data);

                // parse header (always ascii format)
                var PCDheader = parseHeader(textData);

                // parse data

                var position = [];
                var color = [];
                var label = [];
                var payload = [];
                var rgb = [];

                if (PCDheader.data === 'ascii') {
                    const meta = PCDheader;

                    let camPosition = new THREE.Vector3(parseFloat(meta.viewpoint.tx), parseFloat(meta.viewpoint.ty),
                        parseFloat(meta.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(meta.viewpoint.qx,
                        meta.viewpoint.qy, meta.viewpoint.qz, meta.viewpoint.qw);

                    var offset = PCDheader.offset;

                    var pcdData = textData.substr(PCDheader.headerLen);
                    var lines = pcdData.split('\n');
                    let pt, item;
                    for (var i = 0, l = lines.length - 1; i < l; i++) {
                        if(lines[i] == ""){continue;}  // Sometimes empty lines are inserted...

                        var line = lines[i].split(' ');
                        item = {};
                        payload.push(item);

                        pt = new THREE.Vector3(parseFloat(line[offset.x]), parseFloat(line[offset.y]), parseFloat(line[offset.z]));

                        if (!this.serverMode) {
                            pt = pt.sub(camPosition);
                            pt.applyQuaternion(camQuaternion);
                        }

                        item.x = pt.x;
                        position.push(pt.x);

                        item.y = pt.y;
                        position.push(pt.y);
                        item.z = pt.z;
                        position.push(pt.z);

                        if (offset.label !== undefined) {
                            const classIndex = parseInt(line[offset.label]) || 0;
                            item.classIndex = classIndex;
                            label.push(classIndex);
                        } else {
                            item.classIndex = 0;
                            label.push(0);
                        }

                        // Initialize colors
                        if (offset.rgb != undefined) {
                            var colorRGB = parseInt(line[offset.rgb]);
                            var r = (colorRGB >> 16) & 0x0000ff;
                            var g = (colorRGB >> 8) & 0x0000ff;
                            var b = (colorRGB) & 0x0000ff;
                            rgb.push([r, g, b]);
                        }

                        color.push(0);
                        color.push(0);
                        color.push(0);

                    }
                }

                // binary-compressed
                // normally data in PCD files are organized as array of structures: XYZRGBXYZRGB
                // binary compressed PCD files organize their data as structure of arrays: XXYYZZRGBRGB
                // that requires a totally different parsing approach compared to non-compressed data
                if ( PCDheader.data === 'binary_compressed' ) {
                    var dataview = new DataView( data.slice( PCDheader.headerLen, PCDheader.headerLen + 8 ) );
                    var compressedSize = dataview.getUint32( 0, true );
                    var decompressedSize = dataview.getUint32( 4, true );
                    var decompressed = decompressLZF( new Uint8Array( data, PCDheader.headerLen + 8, compressedSize ), decompressedSize );
                    dataview = new DataView( decompressed.buffer );

                    var offset = PCDheader.offset;
                    let pt, item;

                    let camPosition = new THREE.Vector3(parseFloat(PCDheader.viewpoint.tx), parseFloat(PCDheader.viewpoint.ty),
                        parseFloat(PCDheader.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(PCDheader.viewpoint.qx,
                        PCDheader.viewpoint.qy, PCDheader.viewpoint.qz, PCDheader.viewpoint.qw);

                    for ( var i = 0; i < PCDheader.points; i ++ ) {
                        item = {};
                        payload.push(item);

                        const x = dataview.getFloat32( ( PCDheader.points * offset.x ) + PCDheader.size[ 0 ] * i, true );
                        const y = dataview.getFloat32( ( PCDheader.points * offset.y ) + PCDheader.size[ 1 ] * i, true );
                        const z = dataview.getFloat32( ( PCDheader.points * offset.z ) + PCDheader.size[ 2 ] * i, true );

                        pt = new THREE.Vector3(x, y, z);

                        if (!this.serverMode) {
                            pt = pt.sub(camPosition);
                            pt.applyQuaternion(camQuaternion);
                        }

                        item.x = pt.x;
                        position.push(pt.x);

                        item.y = pt.y;
                        position.push(pt.y);
                        item.z = pt.z;
                        position.push(pt.z);

                        if ( offset.label !== undefined ) {
                            const classIndex = dataview.getUint8( PCDheader.points * offset.label + PCDheader.size[ 3 ] * i );
                            item.classIndex = classIndex;
                            label.push( classIndex );
                        } else {
                            item.classIndex = 0;
                            label.push(0);
                        }

                        // Initialize colors
                        if (offset.rgb != undefined) {
                            var colorRGB = dataview.getUint32(row + offset.rgb, true);
                            var r = (colorRGB >> 16) & 0x0000ff;
                            var g = (colorRGB >> 8) & 0x0000ff;
                            var b = (colorRGB) & 0x0000ff;
                            rgb.push([r, g, b]);
                        }

                        color.push(0);
                        color.push(0);
                        color.push(0);
                    }
                }

                // binary

                if ( PCDheader.data === 'binary' ) {
                    var dataview = new DataView( data, PCDheader.headerLen );
                    var offset = PCDheader.offset;
                    let pt, item;
                    // test.push(offset);
                    let camPosition = new THREE.Vector3(parseFloat(PCDheader.viewpoint.tx), parseFloat(PCDheader.viewpoint.ty),
                        parseFloat(PCDheader.viewpoint.tz));
                    let camQuaternion = new THREE.Quaternion(PCDheader.viewpoint.qx,
                        PCDheader.viewpoint.qy, PCDheader.viewpoint.qz, PCDheader.viewpoint.qw);

                    for ( var i = 0, row = 0; i < PCDheader.points; i ++, row += PCDheader.rowSize ) {
                        item = {};
                        payload.push(item);

                        const x = dataview.getFloat32( row + offset.x, true );
                        const y = dataview.getFloat32( row + offset.y, true );
                        const z = dataview.getFloat32( row + offset.z, true );

                        pt = new THREE.Vector3(x, y, z);

                        if (!this.serverMode) {
                            pt = pt.sub(camPosition);
                            pt.applyQuaternion(camQuaternion);
                        }

                        item.x = pt.x;
                        position.push(pt.x);

                        item.y = pt.y;
                        position.push(pt.y);
                        item.z = pt.z;
                        position.push(pt.z);

                        if ( offset.label !== undefined ) {
                            const classIndex = dataview.getUint8( row + offset.label );
                            item.classIndex = classIndex;
                            label.push(classIndex);
                        } else {
                            item.classIndex = 0;
                            label.push(0);
                        }

                        // Initialize colors
                        if (offset.rgb != undefined) {
                            var colorRGB = dataview.getUint32(row + offset.rgb, true);
                            var r = (colorRGB >> 16) & 0x0000ff;
                            var g = (colorRGB >> 8) & 0x0000ff;
                            var b = (colorRGB) & 0x0000ff;
                            rgb.push([r, g, b]);
                        }

                        color.push(0);
                        color.push(0);
                        color.push(0);
                    }
                }

                // build geometry

                var geometry = new THREE.BufferGeometry();

                if (position.length > 0)
                    geometry.setAttribute('position', new THREE.Float32BufferAttribute(position, 3));
                if (label.length > 0)
                    geometry.setAttribute('label', new THREE.Uint8BufferAttribute(label, 3));
                if (color.length > 0) {
                    const colorAtt = new THREE.Float32BufferAttribute(color, 3);
                    geometry.setAttribute('color', colorAtt);
                }

                geometry.computeBoundingSphere();

                var material = new THREE.PointsMaterial({size: 2, color: 0xE9A96F});
                material.sizeAttenuation = false;

                // build mesh
                var mesh = new THREE.Points(geometry, material);
                var name = url.split('').reverse().join('');
                name = /([^\/]*)/.exec(name);
                name = name[1].split('').reverse().join('');
                mesh.name = url;
                return {position, label, header: PCDheader, rgb};
            }

        };

    }
}
