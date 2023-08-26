import React, { useState,useEffect } from 'react';
import { useHistory } from "react-router-dom";
import axios from "axios";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Card, Form } from "react-bootstrap";
import "../pages/form.css"
import Loading from "../components/Loading";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ReactTimeAgo from "react-time-ago";
import Toolbar from "../components/Toolbar";
import { ArrowLeft } from 'react-bootstrap-icons';

import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import 'react-quill/dist/quill.bubble.css';

import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Notification from "../components/Notification"


export const Notemodel = ({ props }) => {
  const [open, setOpen] = useState(false);
  const history = useHistory();
  const [note, setNote] = useState({});
  const [user, setUser] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const [isHovering, setIsHovering] = React.useState(false);
  const [color, setColor] = React.useState(props.color);
  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: ""
  })
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
      console.log("trigerreed")
      toast.success("Note Updated", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setAlert({
        open: true,
        type: "success",
        message: "Note - Updated"
      })
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
      toast.warn("Note Deleted", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setAlert({
        open: true,
        type: "warning",
        message: "Note - Deleted"
      })
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  };
  const modifyText = (text) => {
    if (text) {
      text = text
        .replaceAll("!done", "✅")
        .replaceAll("!pending", "⏳")
        .replaceAll("!imp", "❗")
        .replaceAll("!bell", "🔔");
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
  const changeEditor = (text) => {
    setNote((prev) => {
      return { ...prev, content: modifyText(text) };
    });
  };
  useEffect(() => {
   
    //eslint-disable-next-line
  }, []);


  return (
    <>
      {/* <ToastContainer /> */}
      <Notification alert={alert} setAlert={setAlert} />

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
          
              <ReactQuill readOnly={true}  theme="bubble" value={modifyText(props.content)} />

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
                 
                      <ReactQuill
                        
                        style={{ height: "50vh" }} theme="snow" value={note.content} onChange={(value, viewUpdate) => changeEditor(value)} />
                    </Form.Group>

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

                <Card.Footer style={{ display: "flex", justifyContent: "space-between" }} className="text-muted">
                  <div>
                    Updating on - {new Date().toLocaleDateString()}
                  </div>
                  <p>
                    Created At: - {new Date(note.createdAt).toLocaleDateString()}
                  </p>
                </Card.Footer>
              </Card>
            )}
          </div>
        </Box>
      </Modal>
    </>
  );
};
