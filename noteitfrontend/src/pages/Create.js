import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { Button, Card, Form } from "react-bootstrap";
import Loading from "../components/Loading"
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { useHistory } from 'react-router';
// import Editor from "rich-markdown-editor";
import "./form.css"
import { ArrowLeft } from 'react-bootstrap-icons';

import 'react-toastify/dist/ReactToastify.css';

import Notification from "../components/Notification"

import SunEditorComponent from '../components/SunEditorComponent';

const Create = ({ children, setNotes ,fetchNotes}) => {
  const history = useHistory();
  const editorRef = React.useRef();


  const [note, setNote] = useState(JSON.parse(localStorage.getItem("newNote")) || {
    title: "",
    content: "",
    category:""
  });
  const [open, setOpen] = useState(false);
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const handleOpen = () => setOpen(true);
  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: ""
  })
  const handleClose = async () => {
    localStorage.setItem("newNote", JSON.stringify(note));
    setOpen(false);
  };
  const style = {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: "100%",  // Increase width
    maxWidth: "1200px",  // Increase max width
    maxHeight: "100vh",  // Increase max height
    overflowY: "scroll",
    borderRadius: "0%",
    zIndex: 100,
    border: "0px",
  };
  
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
      setNotes(prev => {
        return [data,...prev];
      })
     
      fetchNotes();
      setNote({
        title: "",
        content: "",
        category: "",
      });
      localStorage.removeItem("newNote")
      setLoading(false);
      setOpen(false);
      setAlert({
        open: true,
        type: "success",
        message: "Note - Created"
      })
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
      setAlert({
        open: true,
        type: "warning",
        message: "Error Creating Note"
      })
    }
  };
  const modifyText = (text) => {
    text = text
      .replaceAll("!done", "✅")
      .replaceAll("!pending", "⏳")
      .replaceAll("!imp", "❗")
      .replaceAll("!bell", "🔔");
    return text;
  };
  useEffect(() => {
    //eslint-disable-next-line
  }, []);
  const changeEditor = (e) => {
    localStorage.setItem("newNote", JSON.stringify(note));
    setNote((prev) => {
      return { ...prev, content: modifyText(e) };
    });
  };
  return (
    <>
      {/* <ToastContainer /> */}
      <Notification alert={alert} setAlert={setAlert} />

      <div onClick={handleOpen}>{children}</div>
      <Modal
        className = "model"
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <div className="noteDiv">
            <Card>
              <Card.Header style={{ display:"flex",justifyContent:"space-between"}}>
                Create a new Note{" "}
                <ArrowLeft
                  style={{ cursor: "pointer" }}
                  onClick={handleClose}
                  size={25}
                />
              </Card.Header>

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
                  
                  <SunEditorComponent data={note.content} changeEditor={changeEditor} editorRef={editorRef} />
             
                  <Form.Group style={{paddingTop:"50px"}} controlId="content">
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
          </div>
        </Box>
      </Modal>
    </>
  );
};

export default Create
