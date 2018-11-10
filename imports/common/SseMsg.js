import postal from "postal";

export default class SseMsg {
    static register(obj) {
        obj.actions = {};
        obj.subscription = postal.subscribe({
            channel: "ui",
            topic: "msg",
            callback: (function (data) {
                if (this.actions[data.name]) {
                    SseMsg.saveLastMsg(data.name, data.argument);
                    this.actions[data.name](data.argument);
                }
            }).bind(obj)
        });

        obj.sendMsg = (function (name, argument) {
            postal.publish({
                channel: "ui",
                topic: "msg",
                data: {
                    name: name,
                    argument: argument
                }
            });
        }).bind(obj);

        obj.onMsg = (function (name, callback) {
            if (typeof name == "string")
                this.actions[name] = callback;
            else {
                name.forEach(s => this.onMsg(s, callback));
            }
        }).bind(obj);

        obj.forgetMsg = (function (name) {
            delete this.actions[name];
        }).bind(obj);

        obj.retriggerMsg = (function (key) {
            if (!SseMsg.prototype.lastMessages) {
                SseMsg.prototype.lastMessages = new Map();
            }
            const last = SseMsg.prototype.lastMessages.get(key);
            if (last)
                (obj.actions[key])(last);
        }).bind(obj);
    }

    static unregister(obj) {
        if (obj.subscription)
            postal.unsubscribe(obj.subscription);
        delete obj.subscription;
        delete obj.actions;
        delete obj.sendMsg;
        delete obj.onMsg;
        delete obj.forgetMsg;
        delete obj.retriggerMsg;
    }



    static saveLastMsg(key, arg) {
        if (!this.prototype.lastMessages) {
            this.prototype.lastMessages = new Map();
        }
        this.prototype.lastMessages.set(key, arg);
    }
}




