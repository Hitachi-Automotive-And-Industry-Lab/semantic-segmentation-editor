import SseMsg from "../../common/SseMsg";

export default class SseUndoRedo2d {
    constructor(cloningFunction) {
        SseMsg.register(this);
        this.byUrl = new Map();
        this.cloningFunction = cloningFunction;
        this.currentInfos = null;
        this.depth = 50;
    }

    init(url, initialState) {
        const infos = this.byUrl.get(url);
        if (infos)
            this.currentInfos = infos;
        else {
            this.currentInfos = {undoArray: [], redoArray: []};
            this.byUrl.set(url, this.currentInfos);
        }
        if (this.currentInfos.undoArray.length == 0) {
            this.pushState(initialState);
        }
        this.updateAvailability();
    }

    pushState(obj) {
        if (this.currentInfos.undoArray.length > this.depth)
            this.currentInfos.undoArray.shift();
        const cloned = this.cloningFunction(obj);
        this.currentInfos.undoArray.push(cloned);
        this.currentInfos.redoArray.length = 0;
        this.updateAvailability()
    }

    undo() {
        if (this.currentInfos.undoArray.length == 1)
            return undefined;
        this.currentInfos.redoArray.push(this.currentInfos.undoArray.pop());
        this.updateAvailability();
        return this.currentInfos.undoArray[this.currentInfos.undoArray.length - 1];

    }

    redo() {
        if (this.currentInfos.redoArray.length == 0)
            return undefined;
        this.currentInfos.undoArray.push(this.currentInfos.redoArray.pop());
        this.updateAvailability();
        return this.currentInfos.undoArray[this.currentInfos.undoArray.length - 1];
    }

    updateAvailability() {
        if (this.currentInfos.undoArray.length > 1)
            this.sendMsg("enableCommand", {name: "undoCommand"});
        else
            this.sendMsg("disableCommand", {name: "undoCommand"});
        if (this.currentInfos.redoArray.length > 0)
            this.sendMsg("enableCommand", {name: "redoCommand"});
        else
            this.sendMsg("disableCommand", {name: "redoCommand"});

    }

}