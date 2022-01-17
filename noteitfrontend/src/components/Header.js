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
        <div style={{margin:"90px"}}>
            <Navbar className="navbar fixed-top navbar-expand navbar-dark bg-dark" expand="sm">
            <Container className="m-auto">
                <Navbar.Brand>
                    <Link to="/notes">
                        NoteIt
                    </Link>
                </Navbar.Brand>
                {props.user && <>
                    <Navbar.Toggle aria-controls="navbarScroll" />
                    <Navbar.Collapse id="navbarScroll" className="justify-content-end">
                        <Nav className="mr-auto">
                            {props.loading && <Nav.Link><Spinner animation="border"  size="sm" /></Nav.Link>}
                            {!props.loading && <Nav.Link>  <CloudCheck size={22} /></Nav.Link>}
                            <Nav.Link href="/createnote"><FileEarmarkPlus size={22} /></Nav.Link>
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
        </div>
    )
}

export default Header
