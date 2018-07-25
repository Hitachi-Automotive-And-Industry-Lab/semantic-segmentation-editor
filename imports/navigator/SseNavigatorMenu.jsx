import React from 'react';
import IconButton from '@material-ui/core/IconButton';
import MuiMenu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import {Menu} from 'mdi-material-ui';

class SseNavigatorMenu extends React.Component {
    constructor(){
        super();
        this.labels = ["All images", "Annotated images"];
    }
    state = {
        anchorEl: null,
    };

    handleClick = event => {
        this.setState({ anchorEl: event.currentTarget });
    };

    handleClose = event => {
        switch (event.target.textContent){
            case this.labels[0]: this.props.history.push("/"); break;
            case this.labels[1]: this.props.history.push("/annotated"); break;
        }
        this.setState({ anchorEl: null });
    };

    render() {
        const { anchorEl } = this.state;

        return (
            <div>
                <IconButton color="inherit" aria-label="Menu"
                            onClick={this.handleClick}>
                    <Menu />
                </IconButton>
                <MuiMenu
                    anchorEl={anchorEl}
                    open={Boolean(anchorEl)}
                    onClose={this.handleClose}
                >
                    <MenuItem onClick={this.handleClose}>{this.labels[0]}</MenuItem>
                    <MenuItem onClick={this.handleClose}>{this.labels[1]}</MenuItem>
                </MuiMenu>
            </div>
        );
    }
}

export default SseNavigatorMenu;