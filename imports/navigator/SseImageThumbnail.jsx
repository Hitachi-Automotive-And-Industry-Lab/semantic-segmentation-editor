import React from 'react';
import {withStyles} from '@material-ui/core/styles';
import {Check} from "mdi-material-ui";
import SseGlobals from "../common/SseGlobals";

class SseImageThumbnail extends React.Component {
    constructor() {
        super();
    }

    render() {
        const image = this.props.image;
        let name = image.name;
        if (!name) {
            const durl = decodeURIComponent(image.url);
            name = durl.substring(1 + durl.lastIndexOf("/"));
        }
        
        return (
            <div className="sse-thumbnail vflex flex-align-items-center">
                <img
                    src={image.url.endsWith(".pcd") ? "/pcl_horz_large_neg.png" : SseGlobals.getFileUrl(image.url + "?size=small")}/>
                <div className="w100 text-align-center text-crop">{name}</div>
                <div>
                    {this.props.annotated
                        ? <Check/>
                        : null}
                </div>

            </div>
        );
    }
}

const styles = {
    card: {
        width: "345px",
    },
    media: {
        height: 0,
        paddingTop: '56.25%', // 16:9
    },
};

export default withStyles(styles)(SseImageThumbnail)