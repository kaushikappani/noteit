import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { Col, Form, Row, Button } from 'react-bootstrap';
import { useHistory } from 'react-router';
import Header from '../components/Header'
import Loading from '../components/Loading';
import Mainscreen from '../components/Mainscreen';
import "./profile.css"

const Profile = () => {
    const history = useHistory();
    const [user, setUser] = useState();
    const [update,setUpdate] = useState()
    const [error, setError] = useState();
    const [success, setSuccess] = useState();
    const [loading, setLoading] = useState(false);
    const authData = localStorage.getItem("userInfo");
    const fetchUser = async () => {
        console.log("fetch user")
        try {
            const config = {
                headers: {
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            const { data } = await axios.get("/api/users/info", config);
            setUser(data);
            setUpdate(data);
            setLoading(false)
        } catch (e) {
            setLoading(false)
            setError(e.response ? e.response.data.message : e.message)
            history.push("/")
        }
    }
    const submitHandler = async (e) => {
        e.preventDefault()
        try {
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            const { data } = await axios.put("/api/users/info", user, config);
            setSuccess(data.message)
            setLoading(false)
            setError(null)
        } catch (e) {
            setLoading(false)
            setSuccess(null);
            setError(e.response ? e.response.data.message : e.message)
        }
    }
    useEffect(() => {
        fetchUser();
        //eslint-disable-next-line
    }, [])
    return (
        <>
            <Header user={update} />
            <Mainscreen title="Profile">
                {user && <div >
                    <Row style={{ maxWidth: "500px", position: "relative", margin: "auto" }} className="profileContainer">
                        <Col md={12}>
                            {success && <p className="text-success">{success}</p>}
                            <Form onSubmit={submitHandler}>
                                {loading && <Loading />}
                                {error && <p className="text-danger">{error}</p>}
                                <Form.Group controlId="name">
                                    <Form.Label>Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="Enter Name"
                                        value={user.name}
                                        onChange={(e) => setUser(prev => {
                                            return { ...prev, name: e.target.value }
                                        })}
                                    ></Form.Control>
                                </Form.Group>
                                <Form.Group controlId="email">
                                    <Form.Label>Email Address</Form.Label>
                                    <Form.Control
                                        type="email"
                                        placeholder="Enter Email"
                                        value={user.email}
                                        onChange={(e) => setUser(prev => {
                                            return { ...prev, email: e.target.value }
                                        })}
                                    ></Form.Control>
                                </Form.Group>
                                <Form.Group controlId="password">
                                    <Form.Label>Password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        placeholder="Enter Password"
                                        value={user.password}
                                        onChange={(e) => setUser(prev => {
                                            return { ...prev, password: e.target.value }
                                        })}
                                    ></Form.Control>
                                </Form.Group>
                                <Form.Group controlId="confirmPassword">
                                    <Form.Label>Confirm Password</Form.Label>
                                    <Form.Control
                                        type="password"
                                        placeholder="Confirm Password"
                                        value={user.confirmPassword}
                                        onChange={(e) => setUser(prev => {
                                            return { ...prev, conformPassword: e.target.value }
                                        })}
                                    ></Form.Control>
                                </Form.Group>{" "}

                                <Button type="submit" varient="primary">
                                    Update
                                </Button>
                            </Form>
                        </Col>

                    </Row>
                </div>}
            </Mainscreen>

        </>
    )
}

export default Profile
