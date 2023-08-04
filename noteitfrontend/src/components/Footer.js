import React from 'react';
import { Container, Row, Col } from "react-bootstrap";
const style = {
    width: "100%",
    position: "absolute",
    bottom: "0",
    display: "flex",
    justifyContent: "center"
}
const Footer = () => {
    return (
        <footer style={style}>
            <Container>
                <Row>
                    <Col className="text-center py-3" >Copyright &copy; Note It</Col>
                </Row>
            </Container>
        </footer>
    )
}

export default Footer
