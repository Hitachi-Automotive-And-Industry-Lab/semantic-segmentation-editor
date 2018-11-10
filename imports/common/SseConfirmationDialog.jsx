import React from 'react';
import {Button, Dialog} from '@material-ui/core';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import SseMsg from "./SseMsg";

export default class SseConfirmationDialog extends React.Component {
    constructor() {
        super();
        SseMsg.register(this);
    }

    state = {
        open: false,
    };

    handleCancel = () => {
        this.setState({open: false});
    };

    handleSubmit = () => {
        this.sendMsg(this.props.endMessage);
        this.setState({open: false});
    };

    componentDidMount() {
        this.onMsg(this.props.startMessage, () => this.setState({open: true}))
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    render() {
        return (
            <Dialog open={this.state.open}>
                <DialogTitle>{this.props.title}</DialogTitle>
                <DialogContent>
                    <DialogContentText>{this.props.text}</DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.handleCancel} color="secondary" autoFocus>
                        Cancel
                    </Button>
                    <Button onClick={this.handleSubmit} color="primary">
                        OK
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}