import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { useParams, useHistory } from "react-router-dom";
import Header from '../components/Header';
import { Button, Card, Form } from "react-bootstrap";
import Loading from "../components/Loading"

import Mainscreen from '../components/Mainscreen';
import "./form.css"
import Editor from "rich-markdown-editor";


const SingleNote = () => {
    const history = useHistory();
    const [note, setNote] = useState({});
    const [user, setUser] = useState();
    const [error, setError] = useState();
    const [loading, setLoading] = useState(false);
    const { id } = useParams();
    const fetchData = async () => {
        try {
            const config = {
              withCredentials: true,
            };
            setLoading(true);
            const { data } = await axios.get(`/api/notes/${id}`, config)
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
              withCredentials: true,
              headers: {
                "Content-Type": "application/json",
              },
            };
            setLoading(true);
            //eslint-disable-next-line
            const { data } = await axios.put(`/api/notes/${id}`, note, config)
            
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
              withCredentials: true,
            };
            setLoading(true);
            //eslint-disable-next-line
            const { data } = await axios.delete(`/api/notes/${id}`, config)
            setLoading(false)
            history.push("/notes")
        } catch (e) {
            console.log("failed")
            setError(e.response ? e.response.data.message : e.message)
            setLoading(false);
        }
    }
    const modifyText = (text) => {
        text = text
          .replaceAll("!done", "✅")
          .replaceAll("!pending", "⏳")
          .replaceAll("!imp", "❗");
        return text;
  }
  const changeEditor = (e) => {
    setNote(prev => {
      return { ...prev, content: modifyText(e()) };
    })
  }
    useEffect(() => {
        fetchData();
        //eslint-disable-next-line
    }, [])

    return (
      <div className="noteDiv">
        <Header page = "singlenote" fetchNotes={fetchData} user={user} loading={loading} />
        <Mainscreen title="Edit Note">
          {loading && <Loading />}
          {user && (
            <Card>
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
                      onChange={(e) =>
                        setNote((prev) => {
                          return { ...prev, title: e.target.value };
                        })
                      }
                    />
                  </Form.Group>

                  <Form.Group controlId="content">
                    <Form.Label>Content</Form.Label>
                    <Editor defaultValue = {note.content} className = "big"  dark  onChange={(e)=>changeEditor(e)} />
                  </Form.Group>
                  

                  <Form.Group controlId="content">
                    <Form.Label>Category</Form.Label>
                    <Form.Control
                      type="content"
                      value={note.category}
                      placeholder="Enter the Category"
                      onChange={(e) =>
                        setNote((prev) => {
                          return { ...prev, category: e.target.value };
                        })
                      }
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary">
                    Update Note
                  </Button>
                  <Button
                    style={{ float: "right" }}
                    onClick={handleDelete}
                    variant="danger"
                  >
                    Delete Note
                  </Button>
                </Form>
              </Card.Body>

              <Card.Footer className="text-muted">
                Updating on - {new Date().toLocaleDateString()}
              </Card.Footer>
            </Card>
          )}
        </Mainscreen>
      </div>
    );
}

export default SingleNote
