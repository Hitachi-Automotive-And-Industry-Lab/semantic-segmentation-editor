import React from 'react';

export default class SseGlobals {

    static hex2rgb(hex) {
        hex = hex.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 256;
        const g = parseInt(hex.substring(2, 4), 16) / 256;
        const b = parseInt(hex.substring(4, 6), 16) / 256;
        return [r, g, b];
    }

    static computeTextColor(hexcolor) {
        const r = parseInt(hexcolor.substr(1, 2), 16);
        const g = parseInt(hexcolor.substr(3, 2), 16);
        const b = parseInt(hexcolor.substr(5, 2), 16);
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return (yiq >= 128) ? 'black' : 'white';
    }

    static getFileUrl(arg) {
        return "/file" + arg;
    }

    static setCursor(cls) {
        if (this.prototype.cursor == cls)
            return;
        this.prototype.cursor = cls;
        const cursors = ["default", "crosshair", "pointer"];
        const body = $('body');
        cursors.forEach((c) => {
            cls == c ? body.addClass("cursor-" + cls) : body.removeClass("cursor-" + c);
        });
    }
}
