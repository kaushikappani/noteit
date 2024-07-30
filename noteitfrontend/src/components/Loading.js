import React from 'react'
import { Spinner } from 'react-bootstrap';

const style = {
    position: 'fixed',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,

};


const Loading = () => {
    return (
        <div style={style}>
            <Spinner animation="grow" />
        </div>
    )
}

export default Loading
