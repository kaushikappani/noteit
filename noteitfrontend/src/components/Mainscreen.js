import React from 'react'
import { Container, Row } from 'react-bootstrap';
import "./css/mainscreen.css"

const Mainscreen = ({ title, children }) => {
    return (
        <div>
            <Container>
                <Row>
                    <div className="page">
                        {
                            title && (<>
                                <h1 className="heading">{title}</h1>
                                <hr />
                            </>)
                        }
                        {children}
                    </div>
                </Row>
            </Container>
        </div>
    )
}

export default Mainscreen
