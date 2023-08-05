import React from 'react'
import { Alert } from 'react-bootstrap'

const errorMessage = ({ varient = "info", children }) => {
    return (
        <div>
            <Alert variant={varient} style={{ fontSize: 20 }}>
                <strong>{children}</strong>
            </Alert>
        </div>
    )
}

export default errorMessage
