import React from 'react';
import { Navbar, Container, Nav, NavDropdown } from "react-bootstrap"
import { Link, useHistory } from 'react-router-dom';
import { FileEarmarkPlus, List, CloudCheck } from "react-bootstrap-icons";
import { Spinner } from 'react-bootstrap';
import axios from "axios";
const Header = (props) => {

    const history = useHistory()
    
    const handleLogout = async() => {
        localStorage.removeItem("userInfo");
        const { data } = await axios.get("/api/users/logout", {
          withCredentials: true,
        });
        history.push("/")
    }
    return (
        <Navbar className="navbar  navbar-expand navbar-light bg-light" expand="sm">
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
                            {props.loading && <Nav.Link><Spinner animation="border"  size="sm" /></Nav.Link>}
                            {!props.loading && <Nav.Link>  <CloudCheck size={22} /></Nav.Link>}
                            <Nav.Link href="/createnote"><FileEarmarkPlus size={20} /></Nav.Link>
                            <Nav.Link href="/notes"> <List size={22} /> </Nav.Link>
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
