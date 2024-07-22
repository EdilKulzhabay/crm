import { Snackbar } from "@mui/material";
import MuiAlert from "@mui/material/Alert";
import React from "react";

const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function MySnackBar(props) {
    const vertical = "bottom";
    const horizontal = "center";

    return (
        <Snackbar
            open={props.open}
            autoHideDuration={6000}
            onClose={props.close}
            anchorOrigin={{ vertical, horizontal }}
        >
            <Alert
                onClose={props.close}
                severity={props.status}
                sx={{ width: "100%" }}
            >
                {props.text}
            </Alert>
        </Snackbar>
    );
}
