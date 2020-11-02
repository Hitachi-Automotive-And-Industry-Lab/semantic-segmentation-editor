import React from 'react';
import Select from 'react-select';
import { withTracker } from 'meteor/react-meteor-data';
import SseMsg from "./SseMsg";


const groupStyles = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
};

const customStyles = {
    menuList: base => ({
        ...base,
        maxHeight: '300px',
    }),
};

const groupBadgeStyles = {
    backgroundColor: '#EBECF0',
    borderRadius: '2em',
    color: '#172B4D',
    display: 'inline-block',
    fontSize: 12,
    fontWeight: 'normal',
    lineHeight: '1',
    minWidth: 1,
    padding: '0.16666666666667em 0.5em',
    textAlign: 'center',
};


class SseSearchList extends React.Component {
    constructor(url) {
        super();
        this.url = decodeURIComponent(url.imageUrl);
        this.folder = this.url.substring(1, this.url.lastIndexOf("/")).slice(0);
	    this.db = {}
        SseMsg.register(this);
    }

    componentDidMount() {
        this.onMsg("pagedown", () => {
            let db = this.db;
            for (let i = 0; i < db.length; i++) {
                if ("/" + decodeURIComponent(db[i].url) == this.url) 
                {
                    var j = i;
                    for (j = i+1; j < db.length; j++) {
                        if (db[j].file.slice(-4)==".pcd") {
                            window.location.pathname = ("/edit/" + db[j].url); 
                            break;
                        }
                    }
                    if (j == db.length)
                        alert("aleady reach the end");
                }
            }
        });

        this.onMsg("pageup", () => {
            let db = this.db; 
            for (let i = 0;i < db.length; i++) {
                if ("/" + decodeURIComponent(db[i].url) == this.url) 
                { 
                    var j = i;
                    for (j = i-1; j >= 0; j--) {
                        if (db[j].file.slice(-4)==".pcd") {
                            window.location.pathname = ("/edit/" + db[j].url); 
                            break;
                        }
                    }
                    if (j == -1) 
                        alert("aleady reach the start");
                }
            }
        });
    }

    myinit(){
        let db = SseSamples.find({folder: this.folder}).fetch();
        this.db = db;
        var tempPcd=[];
        var tempPng=[];

        var curr;
        var currentUrl;
        for (let i = 0;i < db.length; i++) {
            if (db[i].file.slice(-4)==".pcd")
            {
                curr = {"label":db[i].file, "value":db[i].file};
                tempPcd.push(curr);
            }

            if (db[i].file.slice(-4)==".png")
            {
                curr = {"label":db[i].file, "value": db[i].file}
                tempPng.push(curr);
            }

            if ("/" +  decodeURIComponent(db[i].url) == this.url) 
            {
                currentUrl = curr;
            }
        }
        
        var groupedOptions=[
            {
                label: 'PCD',
                options: tempPcd,
            },
            {
                label: 'PNG',
                options: tempPng,
            }
        ]
        return {  array: groupedOptions, curr: currentUrl };
    }

    formatGroupLabel = data => (
        <div style={groupStyles}>
          <span>{data.label}</span>
          <span style={groupBadgeStyles}>{data.options.length}</span>
        </div>
    );

    logChange(val, list) {
	    var target = SseSamples.find({folder: list.folder, file: val.value}).fetch();
        window.location.pathname = ("/edit/" + target[0].url); 
    };

    render() {
        var array = this.myinit();
        var list = this;
	    return (
            <Select
              menuIsOpen = 'true'
              options = {array.array}
              onChange={(e) => this.logChange(e, list)}
              defaultValue={array.curr}
              value={array.curr}
              styles={customStyles}
            />
        );
    }
}

export default withTracker((props) => {
    Meteor.subscribe("sse-all-images");
    return SseSamples.find({} ,{ fields: { url: 1, file: 1, folder:1 }}).fetch();
})(SseSearchList);
