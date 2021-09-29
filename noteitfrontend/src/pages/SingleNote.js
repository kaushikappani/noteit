import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from "react-router-dom";
import Header from '../components/Header';
import { Button, Card, Form } from "react-bootstrap";
import Loading from "../components/Loading"
import ReactMarkdown from "react-markdown";
import Mainscreen from '../components/Mainscreen';

const SingleNote = () => {
    const history = useHistory();
    const [note, setNote] = useState({});
    const [user, setUser] = useState();
    const [error, setError] = useState();
    const [loading, setLoading] = useState(false);
    const authData = localStorage.getItem("userInfo")
    const { id } = useParams();
    const fetchData = async () => {
        try {
            const config = {
                headers: {
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            const { data } = await axios.get(`http://192.168.29.200:5000/api/notes/${id}`, config)
            setNote(data.note)
            setUser(data.user);
            setLoading(false)
        } catch (e) {
            console.log("failed")
            history.push('/')
            setLoading(false);
        }
    }
    const submitHandler = async (e) => {
        e.preventDefault();
        try {
            const config = {
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            //eslint-disable-next-line
            const { data } = await axios.put(`http://192.168.29.200:5000/api/notes/${id}`, note, config)

            setLoading(false)
            history.push("/notes")
        } catch (e) {
            console.log("failed")
            setError(e.response ? e.response.data.message : e.message)
            setLoading(false);
        }
    }
    const handleDelete = async () => {
        try {
            const config = {
                headers: {
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            //eslint-disable-next-line
            const { data } = await axios.delete(`http://192.168.29.200:5000/api/notes/${id}`, config)
            setLoading(false)
            history.push("/notes")
        } catch (e) {
            console.log("failed")
            setError(e.response ? e.response.data.message : e.message)
            setLoading(false);
        }
    }
    useEffect(() => {
        fetchData();
        //eslint-disable-next-line
    }, [])

    return (
        <>
            <Header user={user} />
            <Mainscreen title="Edit Note">
                {loading && <Loading />}
                {user && <Card>
                    <Card.Header>Create a new Note</Card.Header>
                    <Card.Body>
                        <Form onSubmit={submitHandler}>
                            {error && <p className="text-danger">{error}</p>}
                            <Form.Group controlId="title">
                                <Form.Label>Title</Form.Label>
                                <Form.Control
                                    type="title"
                                    value={note.title}
                                    placeholder="Enter the title"
                                    onChange={(e) => setNote(prev => {
                                        return { ...prev, title: e.target.value }
                                    })}
                                />
                            </Form.Group>

                            <Form.Group controlId="content">
                                <Form.Label>Content</Form.Label>
                                <Form.Control
                                    as="textarea"
                                    value={note.content}
                                    placeholder="Enter the content"
                                    rows={4}
                                    onChange={(e) => setNote(prev => {
                                        return { ...prev, content: e.target.value }
                                    })}
                                />
                            </Form.Group>
                            {note.content && (
                                <Card>
                                    <Card.Header>Note Preview</Card.Header>
                                    <Card.Body>
                                        <ReactMarkdown>{note.content}</ReactMarkdown>
                                    </Card.Body>
                                </Card>
                            )}

                            <Form.Group controlId="content">
                                <Form.Label>Category</Form.Label>
                                <Form.Control
                                    type="content"
                                    value={note.category}
                                    placeholder="Enter the Category"
                                    onChange={(e) => setNote(prev => {
                                        return { ...prev, category: e.target.value }
                                    })}
                                />
                            </Form.Group>

                            <Button type="submit" variant="primary">
                                Update Note
                            </Button>
                            <Button style={{ float: "right" }} onClick={handleDelete} variant="danger">
                                Delete Note
                            </Button>
                        </Form>
                    </Card.Body>

                    <Card.Footer className="text-muted">
                        Updating on - {new Date().toLocaleDateString()}
                    </Card.Footer>
                </Card>}
            </Mainscreen>
        </>
    )
}

export default SingleNote
