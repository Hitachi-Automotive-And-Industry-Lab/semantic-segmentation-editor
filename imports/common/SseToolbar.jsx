import React from 'react';

import {Button, Checkbox, FormControlLabel, FormGroup, IconButton} from '@material-ui/core';
import Mousetrap from "mousetrap";
import SseMsg from "./SseMsg";

const disabled = "disabled";
const enabled = "enabled";
const highlighted = "highlighted";
import $ from "jquery";

export default class SseToolbar extends React.Component {

    constructor() {
        super();
        SseMsg.register(this);
        this.state = {};
        this.toggleSet = new Set();
        this.commands = new Map();
        this.toggleCommand = new Map();
        this.checkboxes = new Map();
        this.pendingState = {};
    }

    renderCommand(name) {
        const commandDesc = this.commands.get(name);
        const tippyKey = "#" + name + "Help";
        if (!commandDesc)
            return null;
        else {
            let Icon = commandDesc.icon;
            if (commandDesc.isToggle && (typeof commandDesc.isToggle != "number")) {
                if (this.state[commandDesc.name] == highlighted)
                    Icon = commandDesc.isToggle;
            }

            return (<div
                className={"sse-command vflex flex-align-items-center " + (this.state[name])} title={commandDesc.title}
                data-tippy-html={$(tippyKey).length ? tippyKey : ""}>
                <IconButton onClick={e => this.sendMsg(commandDesc.actionMessage, {value: this.state[name]})}>
                    <Icon/>
                </IconButton>
                <span className="title">{commandDesc.legend || commandDesc.shortcut}</span>
            </div>);
        }
    }

    renderMiniCommand(name, cssClasses = "") {
        const commandDesc = this.commands.get(name);
        const tippyKey = "#" + name + "Help";
        if (!commandDesc) {
            return null;
        } else {
            let Icon = commandDesc.icon;

            return (<div
                className={"sse-command mini vflex flex-align-items-center " + (this.state[name]) + " " + cssClasses}
                title={commandDesc.title}
                data-tippy-html={$(tippyKey).length ? tippyKey : ""}>
                <div className="hflex flex-align-items-center">
                    {commandDesc.legend ?
                        <Button onClick={e => this.sendMsg(commandDesc.actionMessage)}>
                            <Icon/>
                            <span>{commandDesc.legend}</span>
                        </Button>
                        :
                        <IconButton onClick={e => this.sendMsg(commandDesc.actionMessage)}>
                            <Icon/>
                            <span>{commandDesc.legend}</span>
                        </IconButton>
                    }

                </div>
                <span className="title">{commandDesc.legend || commandDesc.shortcut}</span>
            </div>);
        }
    }

    renderCheckbox(name, init) {
        if (this.state[name + "Check"] == undefined) {
            const o = {};
            this.state[name + "Check"] = init;
        }
        const commandDesc = this.commands.get(name);
        const tippyKey = "#" + name + "Help";
        if (!commandDesc)
            return null;
        return <FormGroup
            title={commandDesc.title}
            data-tippy-html={$(tippyKey).length ? tippyKey : ""}>
            <FormControlLabel control={<Checkbox
                checked={this.state[name + "Check"]}
                id={commandDesc.name}
                style={{height: "24px"}}
                onChange={(ev) => this.handleCheckbox(commandDesc.name)}/>}
                              label={commandDesc.title + (commandDesc.shortcut ? ' (' + commandDesc.shortcut + ")" : "")}
            /></FormGroup>;
    }

    handleCheckbox(commandName) {
        const commandDesc = this.commands.get(commandName);
        const cb = $("#" + commandName).get(0);
        this.sendMsg(commandDesc.actionMessage.replace("-checkbox", ""), {value: cb.checked});

        const key = commandName + "Check";
        this.state[key] = !this.state[key];
        this.setState(this.state);
        cb.blur();
    }

    invalidate() {
        if (!this.dirty) {
            this.dirty = true;
            setTimeout(() => {
                this.dirty = false;
                this.setState(this.pendingState);
            }, 10);
        }
    }

    addCommand(name, title, isToggle, shortcut, actionMessage, icon, initialState, legend) {
        const command = {name, title, isToggle, shortcut, actionMessage, icon, legend};
        this.commands.set(name, command);
        if (isToggle) {
            if (typeof isToggle == "boolean")
                this.toggleSet.add(command);
        }
        this.state[name] = initialState || enabled;

        this.onMsg(actionMessage, (arg) => {
            if (!this.pendingState)
                this.pendingState = {};
            if (isToggle) {
                if (typeof isToggle == "number") {
                    const tc = this.toggleCommand.get(isToggle);
                    if (tc) {
                        this.pendingState[tc] = enabled;
                    }
                    this.toggleCommand.set(isToggle, name);
                    this.pendingState[name] = highlighted;

                } else {
                    this.pendingState[name] = (this.state[name] == enabled) ? highlighted : enabled;
                }
                this.invalidate();
            }
        });

        if (shortcut) {
            if (!actionMessage.endsWith("-checkbox"))
                Mousetrap.bind(shortcut.toLowerCase(), () => this.sendMsg(actionMessage));
            else
                Mousetrap.bind(shortcut.toLowerCase(), () => $("#" + name).click());
        }
    }


    componentDidMount() {
        this.onMsg("enableCommand", c => {
            this.pendingState[c.name] = enabled;
            this.invalidate();
        });
        this.onMsg("disableCommand", c => {
            this.pendingState[c.name] = disabled;
            this.invalidate();
        });
        if (this.messages)
            this.messages();
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

}