import { Alert, Snackbar } from '@mui/material'
import React from 'react'

const Notification = ({ alert, setAlert }) => {
    const handleClose = (event, reason) => {
        if (reason === 'clickaway') {
            return;
        }
        setAlert({ open: false })
    };
    return (
        <Snackbar open={alert.open} autoHideDuration={3000} onClose={handleClose} >
            <Alert onClose={handleClose} severity={alert.type} sx={{ width: '100%' }}>
                {alert.message}
            </Alert>
        </Snackbar>
    )
}

export default Notification