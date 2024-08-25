import React from 'react';
import { Navbar, Container, Nav, NavDropdown } from "react-bootstrap";
import { Link, useHistory } from 'react-router-dom';
import { Archive, CloudCheck, CurrencyRupee, Grid } from "react-bootstrap-icons";
import { Spinner } from 'react-bootstrap';
import Icon from "./noteIcon.jpg";
import axios from "axios";
import { Button } from '@mui/material';

const Header = (props) => {
    const history = useHistory();

    const handleLogout = async () => {
        localStorage.removeItem("userInfo");
        await axios.get("/api/users/logout", { withCredentials: true });
        history.push("/");
    };

    return (
        <div style={{ margin: "90px" }}>
            <Navbar className="navbar fixed-top navbar-expand navbar-dark bg-dark" expand="sm">
                <Container className="m-auto">
                    <Navbar.Brand>
                        <Link to="/notes">
                            <img src={Icon} style={{ width: "20px", paddingBottom: "2px" }} alt="NoteIt Logo" /> NoteIt
                        </Link>
                    </Navbar.Brand>
                    {props.user && <>
                        <Navbar.Toggle aria-controls="navbarScroll" />
                        <Navbar.Collapse id="navbarScroll" className="justify-content-end">
                            <Nav className="mr-auto">
                                {props.loading && <Nav.Link><Spinner animation="border" size="sm" /></Nav.Link>}
                                {!props.loading && <Nav.Link onClick={props.fetchNotes}><CloudCheck size={23} /></Nav.Link>}
                                {props.page === "notes" ?
                                    <Nav.Link as={Link} to="/archived"><Archive size={23} /></Nav.Link> :
                                    <Nav.Link as={Link} to="/notes"><Grid size={23} /></Nav.Link>
                                }
                                <Nav.Link as={Link} to="/expensetracker"><CurrencyRupee size={23} /></Nav.Link>
                                {/* <Nav.link as={Link} to="/expensetracker"> <CurrencyRupee size={23} /> </Nav.link> */}
                                <NavDropdown title={props.user.name} id="basic-nav-dropdown">
                                    <NavDropdown.Item as={Link} to="/profile">Profile</NavDropdown.Item>
                                    <NavDropdown.Divider />
                                    <NavDropdown.Item onClick={handleLogout}>Logout</NavDropdown.Item>
                                </NavDropdown>
                            </Nav>
                        </Navbar.Collapse>
                    </>}

                    <Nav className="mr-auto">
                        {props.page === "stocks" && <>
                            {props.loading && <Nav.Link><Spinner animation="border" size="sm" /></Nav.Link>}
                            {!props.loading && <Nav.Link onClick={props.fetchSummary}><CloudCheck size={23} /></Nav.Link>}
                            <Button variant="contained" color="primary" onClick={props.handleAutoReloadToggle}>
                                {props.autoReload ? 'Stop Auto-Reload' : 'Start Auto-Reload'}
                            </Button>
                        </>}
                    </Nav>
                </Container>
            </Navbar>
        </div>
    );
};

export default Header;
