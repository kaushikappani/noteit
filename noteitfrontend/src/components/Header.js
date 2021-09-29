import React from 'react';
import { Navbar, Container, Nav, NavDropdown } from "react-bootstrap"
import { Link, useHistory } from 'react-router-dom';
const Header = (props) => {

    const history = useHistory()

    const handleLogout = () => {
        localStorage.removeItem("userInfo");
        history.push("/")
    }
    return (
        <Navbar className="navbar navbar-expand-lg navbar-light bg-light" expand="sm">
            <Container className="m-auto">
                <Navbar.Brand>
                    <Link to="/">
                        NoteIt
                    </Link>
                </Navbar.Brand>
                {props.user && <>
                    <Navbar.Toggle aria-controls="navbarScroll" />
                    <Navbar.Collapse id="navbarScroll" className="justify-content-end">
                        <Nav className="mr-auto">
                            <Nav.Link href="/notes">My Notes</Nav.Link>
                            <Nav.Link href="/createnote">New Note</Nav.Link>
                            <NavDropdown title={props.user.name} id="basic-nav-dropdown">
                                <NavDropdown.Item href="/profile">Profile</NavDropdown.Item>
                                <NavDropdown.Divider />
                                <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
                            </NavDropdown>
                        </Nav>
                    </Navbar.Collapse>
                </>}
            </Container>
        </Navbar>
    )
}

export default Header
