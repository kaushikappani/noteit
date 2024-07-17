import axios from 'axios';
import React, { useState } from 'react';
import { Container, Form, Row } from 'react-bootstrap';
import { useHistory } from 'react-router';
import Header from '../components/Header';
import Loading from '../components/Loading';
import "./page.css"
import { isMobile } from 'react-device-detect';


const Register = () => {
    const history = useHistory();
    const [authData, setAuthData] = useState({
        name: "",
        email: "",
        password: "",
        conformPassword: "",
        pic: "",
    })
    const [message, setMessage] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (authData.password === authData.conformPassword) {
            try {
                const config = {
                    headers: {
                        "Content-Type": "application/json",
                    }
                }
                
                setLoading(true);
                authData.platform = isMobile ? "mobile" : "web"; 
                const { data } = await axios.post("/api/users", { ...authData }, config)

                localStorage.setItem('userInfo', JSON.stringify(data))
                setLoading(false)
                setMessage(null)
                history.push("/notes")
            } catch (e) {
                console.log(e)
                setMessage(e.response.data.message)
                setLoading(false)
            }
        } else {
            setMessage("Passwords do not match")
        }
    }

    return (
        <>
            <Header page = "register" />
            <Container className="pagecontainer">
                <Row>
                    <div className="col-lg-6" style={{}}>
                        <h1 style={{ fontSize: "8vh", fontFamily: "Poppins, sans-serif" }} className="text-primary">NoteIt</h1>
                        <p style={{ fontSize: "3vh", fontFamily: "Poppins, sans-serif", fontWeight: "lighter" }}>Note It helps to save and sync all your notes at one place</p>
                    </div>
                    <div className="col-lg-6" style={{ fontFamily: "Poppins, sans-serif", justifyContent: "center" }} >
                        <Form onSubmit={handleSubmit}>
                            <div className="form-group">

                                <div className="form-floating mb-3">
                                    <input type="text" className="form-control" value={authData.name} onChange={(e) => setAuthData((prev) => {
                                        return { ...prev, name: e.target.value }
                                    })} id="floatingInput1" placeholder="Name" />
                                    <label htmlFor="floatingInput1">Name</label>
                                </div>

                                <div className="form-floating mb-3">
                                    <input type="email" className="form-control" value={authData.email} onChange={(e) => setAuthData((prev) => {
                                        return { ...prev, email: e.target.value }
                                    })} id="floatingInput" placeholder="name@example.com" />
                                    <label htmlFor="floatingInput">Email address</label>
                                </div>

                                <div className="form-floating mb-3">
                                    <input type="password" className="form-control" value={authData.password} onChange={(e) => setAuthData((prev) => {
                                        return { ...prev, password: e.target.value }
                                    })} id="floatingPassword" placeholder="Password" />
                                    <label htmlFor="floatingPassword">Password</label>
                                </div>

                                <div className="form-floating mb-3">
                                    <input type="password" className="form-control" value={authData.conformPassword} onChange={(e) => setAuthData((prev) => {
                                        return { ...prev, conformPassword: e.target.value }
                                    })} id="floatingConformPassword" placeholder="Password" />
                                    <label htmlFor="floatingPassword">Confirm Password</label>
                                </div>
                                {message &&
                                    <p className="text-danger" style={{ justifyContent: "right", textAlign: "center" }}>{message}</p>
                                }

                                <div className="d-grid mb-5">
                                    <button className="btn btn-lg btn-primary" type="submit">{loading ? <Loading /> : "Sign Up"}</button>
                                </div>
                            </div>
                        </Form>
                    </div>
                </Row>
            </Container>
        </>
    )
}

export default Register
