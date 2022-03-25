import React from 'react'
import { Spinner } from 'react-bootstrap';

const style = {
}

const Loading = () => {
    return (
        <div style={style}>
            <Spinner animation="grow" />
        </div>
    )
}

export default Loading
