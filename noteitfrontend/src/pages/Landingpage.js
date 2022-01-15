import axios from 'axios';
import React, { useEffect, useState } from 'react';
import { Container, Form, Row } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import Loading from '../components/Loading';
import "./page.css";
import jwt from "jsonwebtoken";
import Header from '../components/Header';

const Landingpage = ({ history }) => {
    const userInfo = localStorage.getItem("userInfo")
    const [authData, setAuthData] = useState({
        email: "",
        password: ""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = {
                withCredentials:true,
                headers: {
                    "Content-Type": "application/json",
                }
            }
            setLoading(true);
            const { data } = await axios.post("/api/users/login", authData, config)
            localStorage.setItem('userInfo', JSON.stringify(data))
            history.push("/notes")
            setLoading(false);
        } catch (e) {
            setError(e.response ? e.response.data.message : "Error occured please try again");
            setLoading(false);
        }

    }

    useEffect(() => {
        if (userInfo) {
            jwt.verify(JSON.parse(userInfo).token, 'kakaka', (err, decoded) => {
                if (!err) {
                    history.push("/notes");
                } else {
                    localStorage.removeItem("userInfo");
                    console.log("removed")
                }
            })
        }
    }, [])
    return (
        <>
            <Header />
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
                                    <input value={authData.email} onChange={(e) => setAuthData((prev) => {
                                        return { ...prev, email: e.target.value }
                                    })} type="email" className="form-control" id="floatingInput" placeholder="name@example.com" required />
                                    <label htmlFor="floatingInput">Email address</label>
                                </div>
                                <div className="form-floating mb-3">
                                    <input value={authData.password} onChange={(e) => {
                                        setAuthData((prev) => {
                                            return { ...prev, password: e.target.value }
                                        })
                                    }} type="password" className="form-control" id="floatingPassword" placeholder="Password" required />
                                    <label htmlFor="floatingPassword">Password</label>
                                </div>
                                {error &&
                                    <p className="text-danger" style={{ justifyContent: "right", textAlign: "center" }}>{error}</p>
                                }
                                <div className="d-grid mb-5">
                                    <button className="btn btn-lg btn-primary" type="submit"> {loading ? <Loading /> : "Log In"}</button>
                                </div>
                                <Link to="/register">
                                    <div className="d-grid">
                                        <button className="btn btn-lg btn-success" type="button">Create New Account</button>
                                    </div>
                                </Link>
                            </div>
                        </Form>
                    </div>
                </Row>
            </Container>
        </>
    )
}

export default Landingpage
