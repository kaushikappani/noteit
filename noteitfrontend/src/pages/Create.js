import axios from 'axios';
import React, { useEffect, useState } from 'react'
import Header from '../components/Header';
import { Button, Card, Form } from "react-bootstrap";
import Loading from "../components/Loading"
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Mainscreen from '../components/Mainscreen';
import { useHistory } from 'react-router';
import Editor from "rich-markdown-editor";
import "./form.css"

const Create = () => {
  const history = useHistory();
    const [note, setNote] = useState({
        title: "",
        category: "",
        content: ""
    })
    const [user, setUser] = useState({});
    const [error, setError] = useState();
    const [loading, setLoading] = useState(false);
    const fetchUser = async () => {
        console.log("fetch user")
        try {
            const config = {
              withCredentials: true,
            };
            setLoading(true);
            const { data } = await axios.get("/api/users/info", config);
            setUser(data);
            setLoading(false)
        } catch (e) {
            setLoading(false)
            setError(e.response ? e.response.data.message : e.message)
            history.push("/")
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
            const { data } = await axios.post("/api/notes/create", note, config);
            setLoading(false)
            history.push("/notes");

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
        .replaceAll("!imp", "❗")
        .replaceAll("!bell", "🔔");
      return text;
    };
    useEffect(() => {
        fetchUser();
        //eslint-disable-next-line
    }, [])
  const changeEditor = (e) => {
    setNote(prev => {
      return { ...prev, content: modifyText(e()) };
    })
  }
    return (
      <div className="noteDiv">
        <Header page="create" user={user} loading={loading} />

        <Mainscreen title="Create note">
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
                Content
                <Editor autoFocus dark className = "big" onChange={(e)=>changeEditor(e)} />

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
                {loading && <Loading />}
                <Button type="submit" variant="primary">
                  Create Note
                </Button>
              </Form>
            </Card.Body>

            <Card.Footer className="text-muted">
              Creating on - {new Date().toLocaleDateString()}
            </Card.Footer>
          </Card>
        </Mainscreen>
      </div>
    );
}

export default Create
