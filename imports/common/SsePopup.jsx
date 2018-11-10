import React from 'react';
import PropTypes from 'prop-types';
import {withStyles} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Snackbar from '@material-ui/core/Snackbar';
import SseMsg from "./SseMsg";

const styles = theme => ({
    close: {
        width: theme.spacing.unit * 4,
        height: theme.spacing.unit * 4,
    },
});

class SsePopup extends React.Component {
    constructor() {
        super();
        SseMsg.register(this);
    }

    componentDidMount() {
        this.onMsg("alert", (arg) => {
            this.setState({
                open: true,
                message: arg.message,
                variant: arg.variant || "error",
                buttonText: arg.buttonText || "CLOSE",
                closeMessage: arg.closeMessage,
                autoHide: arg.autoHide || null
            });
            if (this.forceCloseMessage)
                this.forgetMsg(this.forceCloseMessage);
            this.forceCloseMessage = arg.forceCloseMessage;

            if (arg.forceCloseMessage) {
                this.onMsg(arg.forceCloseMessage, () => this.setState({open: false}));
            }
        })
    }

    componentWillUnmount(){
        SseMsg.unregister(this);
    }

    state = {
        open: false,
    };

    handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        this.setState({open: false});
        if (this.state.closeMessage) {
            this.sendMsg(this.state.closeMessage);
        }
    };

    render() {
        const {classes} = this.props;
        return (
            <div>
                <Snackbar
                    anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'left',
                    }}
                    open={this.state.open}
                    autoHideDuration={this.state.autoHide ? 6000 : null}
                    onClose={this.handleClose}
                    ContentProps={{
                        'aria-describedby': 'message-id',
                    }}
                    message={<span id="message-id">{this.state.message}</span>}
                    action={[
                        <Button key="actionButton" color="secondary" size="small"
                                onClick={this.handleClose}>
                            {this.state.buttonText}
                        </Button>

                    ]}
                />
            </div>
        );
    }
}

SsePopup.propTypes = {
    classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(SsePopup);