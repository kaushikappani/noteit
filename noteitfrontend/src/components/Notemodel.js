import React, { useState,useEffect } from 'react';
import { useHistory } from "react-router-dom";
import axios from "axios";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Card, Form } from "react-bootstrap";
import "../pages/form.css"
import Editor from "rich-markdown-editor";
import Loading from "../components/Loading";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ReactTimeAgo from "react-time-ago";
import Toolbar from "../components/Toolbar";
import { ArrowLeft } from 'react-bootstrap-icons';

export const Notemodel = ({ props }) => {
  console.log("props", props);
  const [open, setOpen] = useState(false);
  const history = useHistory();
  const [note, setNote] = useState({});
  const [user, setUser] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [color, setColor] = React.useState(props.color);
  const handleMouseOver = () => {
    setIsHovering(true);
  };

  const handleMouseOut = () => {
    setIsHovering(false);
  };
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
      const { data } = await axios.put(`/api/notes/${props.id}`, note, config);
      props.fetchNotes();
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
    maxHeight: "95vh",
    overflowY: "scroll",
    borderRadius:"2%",
    zIndex: 100,
    border:"0px"
  };
  const handleOpen = () => {
    fetchData();
    setOpen(true)
  };
  const handleClose = () => {
    const updatedNotes = props.notes.map((e) => {
      if (e._id === props.id) {
        const newNote = {
          ...note,
          pinned: e.pinned,
          color: e.color,
        };
        return newNote;
      } else {
        return e;
      }
    });
    props.setNotes(updatedNotes);
    updateNote();
    setOpen(false);
  }
  const fetchData = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get(`/api/notes/${props.id}`, config);
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
      const { data } = await axios.delete(`/api/notes/${props.id}`, config);
      
      props.fetchNotes();
      handleClose();
      setLoading(false);
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  };
  const modifyText = (text) => {
    if (text) {
      text = text
        .replaceAll("!done", "???")
        .replaceAll("!pending", "???")
        .replaceAll("!imp", "???")
        .replaceAll("!bell", "????");
    }
    return text;
  };
   const updateColor = (c) => {
     if (c === color) {
       setColor("#202124");
       props.colorSync(props.id, c);
     } else {
       setColor(c);
       props.colorSync(props.id, c);
     }
   };
   const pinNote = () => {
     props.pinNote(props.id);
   };
   const archive = () => {
     props.archive(props.id);
   };
  const changeEditor = (e) => {
    setNote((prev) => {
      return { ...prev, content: modifyText(e()) };
    });
  };
  useEffect(() => {
    
    //eslint-disable-next-line
  }, []);


  return (
    <>
      <div
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        style={{ backgroundColor: color,cursor:"pointer" }}
      >
        <CardContent>
          <div onClick={handleOpen}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <Typography
                sx={{ fontSize: 14 }}
                style={{ color: "#c7dee5" }}
                gutterBottom
              >
                {props.category}
              </Typography>
            </div>
            <Typography variant="h5" component="div">
              {props.title}
            </Typography>

            <Typography variant="body2" style={{ color: "#c7dee5" }}>
              <Editor
                dark
                style={{}}
                readOnly
                value={modifyText(props.content)}
              />
            </Typography>
            <Typography sx={{ fontSize: 14 }} gutterBottom>
              <ReactTimeAgo
                date={props.createdAt}
                locale="en-US"
                timeStyle="round-minute"
              />
            </Typography>
          </div>
          <div style={{ visibility: isHovering ? "visible" : "hidden" }}>
            <Toolbar
              id={props.id}
              fetchNotes={props.fetchNotes}
              updateColor={props.colorSync ? updateColor : null}
              pinNote={props.pinNote ? pinNote : null}
              archive={archive}
            />
          </div>
        </CardContent>
      </div>
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
                      <div style={{display:"flex",justifyContent:"space-between"}}>
                        <Form.Label>Title</Form.Label>
                        <ArrowLeft style={{cursor:"pointer"}} onClick = {handleClose} size={25} />
                      </div>
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
