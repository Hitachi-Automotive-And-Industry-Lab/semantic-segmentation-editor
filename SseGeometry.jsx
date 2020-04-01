import Paper from "paper";
import MapSet from "../../common/MapSet";

export default class SseGeometry {

    constructor(polygons, ignoreLastPolygon) {
        this.nextOutlinePoints = new Map();
        this._segment2point = new Map();
        this._point2segments = new Map();
        this.includedInPolygons = new Map();
        this.polygons = polygons;
        this.intersections = new MapSet();

        if (ignoreLastPolygon) {
            polygons = polygons.concat();
            polygons.pop();
        }

        this.normalizePaperGraph(polygons);
    }

    segmentAsString(seg) {
        const p = 100000000;
        return JSON.stringify({x: Math.round(seg.point.x * p), y: Math.round(seg.point.y * p)});
    }

    segment2point(seg) {
        const ssas = this.segmentAsString(seg);
        let rep = this._segment2point.get(ssas);
        if (!rep) {
            rep = {x: seg.point.x, y: seg.point.y};
            this._segment2point.set(ssas, rep);
        }
        return rep;
    }

    isoSegmentsSet(seg) {
        return this._point2segments.get(this.segment2point(seg));
    }

    contiguousOutlinePoints(seg) {
        const contiguousOutlinePointsLocal = (seg) => {
            let next = seg.succ;
            let previous = seg.pred;


            const point = this.segment2point(seg);
            const nextPoint = this.segment2point(next);
            const previousPoint = this.segment2point(previous);

            let pointPolygons = this.includedInPolygons.get(point) || new Set();
            let nextPolygons = this.includedInPolygons.get(nextPoint) || new Set();
            let previousPolygons = this.includedInPolygons.get(previousPoint) || new Set();

            let interNext = pointPolygons.intersection(nextPolygons);
            let interPrevious = pointPolygons.intersection(previousPolygons);

            let res = [];
            if (interNext.size <= 1)
                res.push(nextPoint);

            if (interPrevious.size <= 1)
                res.push(previousPoint);

            return new Set(res);
        };
        return Array.from(this.isoSegmentsSet(seg)).reduce((acc, cur) => (acc.union(contiguousOutlinePointsLocal(cur))), new Set())
    }

    normalizePaperGraph(polygons) {
        polygons.forEach(pol => {
            pol.segments.forEach(seg => {
                const pt = this.segment2point(seg);
                let pred, succ;
                const segs = seg.path.segments;
                if (seg == seg.path.firstSegment) {
                    pred = segs.length - 1;
                    succ = 1;
                } else if (seg == seg.path.lastSegment) {
                    pred = seg.index - 1;
                    succ = 0;
                }
                else {
                    pred = seg.index - 1;
                    succ = seg.index + 1;
                }
                seg.pred = segs[pred];
                seg.succ = segs[succ];

                let s = this.includedInPolygons.get(pt) || new Set();
                s.add(pol);
                this.includedInPolygons.set(pt, s);
            });
        });
        polygons.forEach(pol => {
            pol.segments.forEach(seg => {
                const pt = this.segment2point(seg);
                const segs = this._point2segments.get(pt);
                this._point2segments.set(pt, (segs || new Set()).union(new Set([seg])));
                const nexts = this.nextOutlinePoints.get(pt);
                this.nextOutlinePoints.set(pt, (nexts || new Set()).union(this.contiguousOutlinePoints(seg)));
            });
        });
        this.computePolygonsIntersections();
    }


    findPathRec(p1, p2, path, result, length, lastVisited) {
        let nextP1 = this.nextOutlinePoints.get(p1);
        let pt = xy => new Paper.Point(xy);
        if (lastVisited) {
            length += pt(p1).subtract(pt(lastVisited)).length;
        }
        if (nextP1 && nextP1.size > 0) {
            if (nextP1.has(p2)) {
                path.add(p2);
                result.push(path);
                path.pixelLength = length;
                return length;
            } else {
                return nextP1.forEach(p => {
                    if (!path.has(p))
                        return this.findPathRec(p, p2, path.union(new Set([p])), result, length, p1)
                })
            }
        }
    }

    isoSegments(segment) {
        const rep = this.segment2point(segment);
        return this._point2segments.get(rep) || new Set([segment]);
    }

    findPath(seg1, seg2) {
        let p1 = this.segment2point(seg1);
        let p2 = this.segment2point(seg2);
        let adj = this.nextOutlinePoints.get(p1);
        if (adj && adj.has(p2)) {
            return [];
        }
        const res = [];
        this.findPathRec(p1, p2, new Set([p1]), res, 0, null);
        return res.sort((a, b) => (a.pixelLength - b.pixelLength));
    }

    computePolygonsIntersections() {
        this.intersections = new MapSet();
        this.polygons.forEach(p1 => {
            this.polygons.forEach(p2 => {
                if (p1 == p2) {
                    return;
                }
                const inter = p1.getIntersections(p2);
                let inside = false;
                if (inter.length == 0) {
                    if (p1.isInside(p2.bounds) || p2.isInside(p1.bounds)) {
                        inside = true;
                    }
                }
                if (inter.length > 1 || inside) {
                    this.intersections.map(p1, p2);
                    this.intersections.map(p2, p1);
                }
            })
        });
    }

    findIntersectingPolygons(path) {
        return this.polygons.filter(p => p.getIntersections(path, cand => cand != p).length > 0)
    }

    getIntersections(path) {
        return this.intersections.get(path);
    }
}