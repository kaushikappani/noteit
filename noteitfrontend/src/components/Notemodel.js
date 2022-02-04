import React, { useState,useEffect } from 'react';
import { useHistory } from "react-router-dom";
import axios from "axios";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Card, Form } from "react-bootstrap";
import "../pages/form.css"
import Editor from "rich-markdown-editor";
import Loading from "../components/Loading";
export const Notemodel = ({ id, notes, children, fetchNotes,setNotes }) => {
  const [open, setOpen] = useState(false);
  const history = useHistory();
  const [note, setNote] = useState({});
  const [user, setUser] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const updateNote = async() => {
    try {
      const config = {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      };
      setLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.put(`/api/notes/${id}`, note, config);
      fetchNotes();
      setLoading(false);
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  }
  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "100%",
    maxWidth: "750px",
    maxHeight: "90vh",
    overflowY: "scroll",
    borderRadius:"2%",
    zIndex:100
  };
  const handleOpen = () => setOpen(true);
  const handleClose = () => {
    const updatedNotes = notes.map(e => {
      if (e._id === id) {
        const newNote = {
          ...note,
          pinned: e.pinned,
          color:e.color
        }
        return newNote;
      } else {
        return e;
      }
    })
    setNotes(updatedNotes);
    updateNote();
    setOpen(false);
  }
  const fetchData = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get(`/api/notes/${id}`, config);
      setNote(data.note);
      setUser(data.user);
      setLoading(false);
    } catch (e) {
      console.log("failed");
      history.push("/");
      setLoading(false);
    }
  };
  const submitHandler = async (e) => {
    e.preventDefault();
    await updateNote();
    handleClose();
  };
  const handleDelete = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.delete(`/api/notes/${id}`, config);
      
      fetchNotes();
      handleClose();
      setLoading(false);
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  };
  const modifyText = (text) => {
    text = text
      .replaceAll("!done", "✅")
      .replaceAll("!pending", "⏳")
      .replaceAll("!imp", "❗");
    return text;
  };
  const changeEditor = (e) => {
    setNote((prev) => {
      return { ...prev, content: modifyText(e()) };
    });
  };
  useEffect(() => {
    fetchData();
    //eslint-disable-next-line
  }, []);


  return (
    <>
      <div onClick={handleOpen}>{children}</div>
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <div className="noteDiv">
          
            {loading && <Loading />}
            {user && (
              <Card>
                
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
                      <Editor
                        defaultValue={note.content}
                        className="big"
                        dark
                        onChange={(e) => changeEditor(e)}
                      />
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
          </div>
        </Box>
      </Modal>
    </>
  );
};
