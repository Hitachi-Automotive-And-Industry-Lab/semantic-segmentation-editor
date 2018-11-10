import {Meteor} from 'meteor/meteor';
import {createWriteStream, lstatSync, readdirSync, readFile, readFileSync, existsSync} from "fs";
import {basename, extname, join} from "path";
import url from "url";
import ColorScheme from "color-scheme";
import config from "./config";

let {classes} = config;

Meteor.methods({
    'getClassesSets'() {
        const data = config.setsOfClasses;
        const scheme = new ColorScheme;
        scheme.from_hue(0)         // Start the scheme
            .scheme('tetrade')     // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('soft');   // Use the 'soft' color variation
        let colors = scheme.colors();
        scheme.from_hue(10)         // Start the scheme
            .scheme('tetrade')     // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('pastel');   // Use the 'soft' color variation
        colors = colors.concat(scheme.colors());
        scheme.from_hue(20)         // Start the scheme
            .scheme('tetrade')     // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard');   // Use the 'soft' color variation
        colors = colors.concat(scheme.colors());
        scheme.from_hue(30)         // Start the scheme
            .scheme('tetrade')     // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard');   // Use the 'soft' color variation
        colors = colors.concat(scheme.colors());
        scheme.from_hue(40)         // Start the scheme
            .scheme('tetrade')     // Use the 'triade' scheme, that is, colors
            // selected from 3 points equidistant around
            // the color wheel.
            .variation('hard');   // Use the 'soft' color variation
        colors = colors.concat(scheme.colors());
        colors = colors.map(c => "#" + c);
        data.forEach(soc => {
            soc.objects.forEach((oc, i) => {
                if (!oc.color) {
                    oc.color = colors[i];
                }
            })
        });
        return data;
    },
    /*
        'rebuildTagList'() {
            const all = SseSamples.find().fetch();
            const tags = new Set();
            all.forEach(s => {
                if (s.tags) {
                    s.tags.forEach(t => {
                        tags.add(t)
                    })
                }
            });
            SseProps.remove({});
            SseProps.upsert({key: "tags"}, {key: "tags", value: Array.from(tags)});
        },
    */
    'images'(folder, pageIndex, pageLength) {
        const isDirectory = source => lstatSync(source).isDirectory();
        const isImage = source => {
            const stat = lstatSync(source);
            return (stat.isFile() || stat.isSymbolicLink()) &&
                (
                    extname(source).toLowerCase() == ".bmp" ||
                    extname(source).toLowerCase() == ".jpeg" ||
                    extname(source).toLowerCase() == ".jpg" ||
                    extname(source).toLowerCase() == ".pcd" ||
                    extname(source).toLowerCase() == ".png"
                )
        };
        const getDirectories = source =>
            readdirSync(source).map(name => join(source, name)).filter(isDirectory).map(a => basename(a));

        const getImages = source =>
            readdirSync(source).map(name => join(source, name)).filter(isImage);

        const getImageDesc = path => {
            return {
                name: basename(path),
                editUrl: "/edit/" + encodeURIComponent(folderSlash + basename(path)),
                url: (folderSlash ? "/" + folderSlash : "") + "" + basename(path)
            };
        };

        const getFolderDesc = (path) => {
            return {
                name: basename(path),
                url: `/browse/${pageIndex}/${pageLength}/` + encodeURIComponent(folderSlash + path)
            }
        };

        pageIndex = parseInt(pageIndex);
        pageLength = parseInt(pageLength);
        const folderSlash = folder ? decodeURIComponent(folder) + "/" : "/";
        const leaf = join(config.imagesFolder, (folderSlash ? folderSlash : ""));

        const existing = existsSync(leaf);

        if (existing && !isDirectory(leaf)) {
            return {error: leaf + " is a file but should be a folder. Check the documentation and your settings.json"};
        }
        if (!existing) {
            return {error: leaf + " does not exists. Check the documentation and your settings.json"};
        }

        const dirs = getDirectories(leaf);
        const images = getImages(leaf);
        const res = {
            folders: dirs.map(getFolderDesc),
            images: images.map(getImageDesc).slice(pageIndex * pageLength, pageIndex * pageLength + pageLength),
            imagesCount: images.length
        };

        if (pageIndex * pageLength + pageLength < images.length) {
            res.nextPage = `/browse/${pageIndex + 1}/${pageLength}/` + encodeURIComponent(folder);
        }
        if (pageIndex > 0) {
            res.previousPage = `/browse/${pageIndex - 1}/${pageLength}/` + encodeURIComponent(folder);
        }

        return res;
    },

    'saveData'(sample) {
        const attrs = url.parse(sample.url);
        let path = decodeURIComponent(attrs.pathname);
        sample.folder = path.substring(1, path.lastIndexOf("/"));
        sample.file = path.substring(path.lastIndexOf("/") + 1);
        sample.lastEditDate = new Date();
        if (!sample.firstEditDate)
            sample.firstEditDate = new Date();
        if (sample.tags) {
            SseProps.upsert({key: "tags"}, {$addToSet: {value: {$each: sample.tags}}});
        }
        SseSamples.upsert({url: sample.url}, sample);
    }
});
