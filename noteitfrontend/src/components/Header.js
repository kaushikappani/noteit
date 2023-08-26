import React from 'react';
import { Navbar, Container, Nav, NavDropdown } from "react-bootstrap"
import { Link, useHistory } from 'react-router-dom';
import {  Archive, CloudCheck,Grid } from "react-bootstrap-icons";
import { Spinner } from 'react-bootstrap';
import Icon from "./noteIcon.jpg";
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
                       <img src = {Icon} style={{width:"20px",paddingBottom:"2px"}} alt="NoteIt Logo" /> NoteIt
                    </Link>
                </Navbar.Brand>
                {props.user && <>
                    <Navbar.Toggle aria-controls="navbarScroll" />
                    <Navbar.Collapse id="navbarScroll" className="justify-content-end">
                        <Nav className="mr-auto">
                            {props.loading && <Nav.Link><Spinner animation="border"  size="sm" /></Nav.Link>}
                            {!props.loading && <Nav.Link onClick = {props.fetchNotes}>  <CloudCheck size={23} /></Nav.Link>}
                            {props.page === "notes" ? <Nav.Link href="/archived"> <Archive size={23} /> </Nav.Link> :<Nav.Link href="/notes"> <Grid size={23} /> </Nav.Link> }
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
