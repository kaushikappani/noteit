import React, { useState, useEffect, useRef } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Card, Form } from "react-bootstrap";
import "../pages/form.css";
import Loading from "../components/Loading";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ReactTimeAgo from "react-time-ago";
import Toolbar from "../components/Toolbar";
import { ArrowLeft } from "react-bootstrap-icons";
import "react-toastify/dist/ReactToastify.css";
import Notification from "../components/Notification";
import SunEditorComponent from "./SunEditorComponent";
import SunEditor from "suneditor-react";
import "suneditor/dist/css/suneditor.min.css";
import { Chip, List, ListItem, ListSubheader } from "@mui/material";
import "./css/Aibutton.css"
import GeminiLogo from "./GeminiLogo";



export const Notemodel = ({ props }) => {
  const [open, setOpen] = useState(false);
  const history = useHistory();
  const [note, setNote] = useState({});
  const [user, setUser] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [isHovering, setIsHovering] = useState(false);
  const [color, setColor] = useState(props.color);
  const [userAccessEmail, setUserAccessEmail] = useState();
  const [accessUsers, setAccessUsers] = useState([]);

  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: "",
  });
  const editorRef = useRef();
  const contentRef = useRef();
  const handleMouseOver = () => {
    setIsHovering(true);
  };

  const handleMouseOut = () => {
    setIsHovering(false);
  };
  const updateNote = async () => {
    if (props.edit) {
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
        console.log("trigerreed");
        setAlert({
          open: true,
          type: "success",
          message: "Note - Updated",
        });
        setLoading(false);
      } catch (e) {
        console.log("failed");
        setError(e.response ? e.response.data.message : e.message);
        const message = e.response ? e.response.data.message : e.message;
        console.log(message)
        if (message) {
          setAlert({
            open: true,
            type: "warning",
            message: message,
          });
        }
        setLoading(false);
      }
    }
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
  const handleOpen = () => {
    fetchData("h0");
    props.edit && (fetchUserAccess());
    setOpen(true);
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
  };
  const fetchData = async (noteHistory) => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get(
        `/api/notes/${props.id}/${noteHistory}`,
        config
      );
      setNote(data.note);
      setUser(data.user);
      setLoading(false);
    } catch (e) {
      console.log("failed");
      history.push("/");
      setLoading(false);
    }
  };
  const fetchUserAccess = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      const { data } = await axios.get(
        `/api/users/${props.id}/access/users`,
        config
      );
      setAccessUsers(data)
      setLoading(false);
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  }
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
      setAlert({
        open: true,
        type: "warning",
        message: "Note - Deleted",
      });
      
    } catch (e) {
      console.log("failed");
      setError(e.response ? e.response.data.message : e.message);
      setLoading(false);
    }
  };

  const handleArchive = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.put(
        `/api/notes/${props.id}`,
        { archived: true },
        config
      );

      props.fetchNotes();
      handleClose();
      setLoading(false);
      setAlert({
        open: true,
        type: "warning",
        message: "Note - Archived",
      });
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

  const handhleHistoryChange = async (e, state) => {
    e.preventDefault();
    fetchData(state);
  };

  const handleAccess = async ()=>{
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.post(`/api/notes/share/${props.id}/${userAccessEmail}`, config);
      setLoading(false);
      
      setAlert({
        open: true,
        type: "success",
        message: data.message,
      });
      fetchUserAccess();
    } catch (e) {
      console.log("failed");
      setAlert({
        open: true,
        type: "warning",
        message: e.response ? e.response.data.message : e.message,
      });
      setLoading(false);
    }
  }

  const handleRevoke = async (e,email) => {
    e.preventDefault();
    try {
      const config = {
        withCredentials: true,
      };
      setLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.put(`/api/users/${props.id}/revoke/${email}`, config);
      setLoading(false);
      setAlert({
        open: true,
        type: "success",
        message: data.message,
      });
      fetchUserAccess();
    } catch (e) {
      console.log("failed");
      setAlert({
        open: true,
        type: "warning",
        message: e.response ? e.response.data.message : e.message,
      });
      setLoading(false);
    }
  }


  const generateAiSummary = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      setAiLoading(true);
      //eslint-disable-next-line
      const { data } = await axios.get(`api/notes/${props.id}/genai/summary`, config);
      setAiLoading(false);
      setAlert({
        open: true,
        type: "success",
        message: data.message,
      });
      fetchData("h0");
    } catch (e) {
      console.log("failed");
      setAlert({
        open: true,
        type: "warning",
        message: e.response ? e.response.data.message : e.message,
      });
      setAiLoading(false);
    }
  }

  useEffect(() => {
    if (!contentRef.current) return;
    contentRef.current.innerHTML = note.content;
  }, [note.content]);

  return (
    <>
      {/* <ToastContainer /> */}
      <Notification alert={alert} setAlert={setAlert} />

      <div
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        style={{ backgroundColor: color, cursor: "pointer" }}
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
              <SunEditor
                disable={true}
                autoFocus={false}
                height="100%"
                hideToolbar={true}
                setContents={modifyText(props.content)}
                lang="en"
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
      {loading && <Loading />}
      
      <Modal
        open={open}
        onClose={handleClose}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style}>
          <GeminiLogo aiLoading={aiLoading} />

          <div className="noteDiv">
           
            {user && (
              <Card>
                <Card.Body>
                  <Form onSubmit={submitHandler}>
                   
                    <Form.Group controlId="title">
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Form.Label>Title</Form.Label>
                        <ArrowLeft
                          style={{ cursor: "pointer" }}
                          onClick={handleClose}
                          size={25}
                        />
                      </div>
                      <Form.Control
                        type="title"
                        value={note.title}
                        disabled={!props.edit}
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
                     
                      {props.edit && <div >
                        <Button style={{ margin: "2px" }} onClick={(e) => handhleHistoryChange(e, "h0")}>
                          Latest Saved
                        </Button>
                        <Button style={{ margin: "2px" }} onClick={(e) => handhleHistoryChange(e, "h1")}>
                          history 1
                        </Button>
                        <Button style={{ margin: "2px" }} onClick={(e) => handhleHistoryChange(e, "h2")}>
                          history 2
                        </Button>
                        <Button style={{ margin: "2px" }} onClick={(e) => handhleHistoryChange(e, "h3")}>
                          history 3
                        </Button>
                        <Button
                          className="blinking-button"
                          onClick={(e) => generateAiSummary()}
                        >
                          <GeminiLogo />
                            Ai Summary
                        </Button>
                      </div> }
                      
                      {/* <ReactQuill
                        
                        style={{ height: "50vh" }} theme="snow" value={note.content} onChange={(value, viewUpdate) => changeEditor(value)} /> */}

                      {props.edit ? (<SunEditorComponent
                        disable={false}
                        data={note}
                        changeEditor={changeEditor}
                        editorRef={editorRef}
                      />) : (<SunEditor
                        disable={true}
                        autoFocus={false}
                        height="100%"
                        hideToolbar={true}
                        setContents={modifyText(props.content)}
                        lang="en"
                      />) }
                    
                    </Form.Group>

                    <Form.Group
                      style={{ paddingTop: "2px" }}
                      controlId="content"
                    >
                      <Form.Label>Category</Form.Label>
                      <Form.Control
                        type="content"
                        value={note.category}
                        disabled={!props.edit}
                        placeholder="Enter the Category"
                        onChange={(e) =>
                          setNote((prev) => {
                            return { ...prev, category: e.target.value };
                          })
                        }
                      />

                      
                    </Form.Group>
                    

                    {props.edit && <Button type="submit" variant="primary">
                      Update Note
                    </Button>}
                   
                    {(props.edit & props.from == "notes") ? <Button
                      style={{ float: "right" }}
                      onClick={handleArchive}
                      variant="warning"
                    >
                      Archive Note
                    </Button>:null}
                 
                    {(props.edit & props.from == "archive") ? 
                      <Button
                        style={{ float: "right" }}
                        onClick={handleDelete}
                        variant="danger"
                      >
                        Delete Note
                      </Button>:null}
                   
                     {error && <p className="text-danger">{error}</p>}
                  </Form>
                  {props.edit ? (<div style={{ display: "flex", marginTop: "10px" }}>
                    <Form.Control
                      type="email"
                      placeholder="Email Id"
                      style={{ justifyContent: "left" }}
                      onChange={(e) => {
                        setUserAccessEmail(e.target.value);
                      }}
                    />
                    <Button
                      style={{ justifyContent: "right" }}
                      onClick={handleAccess}
                      variant="success"
                    >
                      Grant View Access
                    </Button>
                  </div>) : null}
                  
                  {!props.edit ? <p>Shared By : - {user.name}</p> : null}

                
                  <List
                    subheader={accessUsers.length > 0 && <ListSubheader>View Accessed Users</ListSubheader>}>
                    {accessUsers && accessUsers.map((user, i) => {
                      return (<ListItem>{user.email} <Chip onClick={(e) => handleRevoke(e,user.email)} label="revoke" color="error" /></ListItem>)
                  })}
                  </List>
                </Card.Body>
                    
                
              

                <Card.Footer
                  style={{ display: "flex", justifyContent: "space-between" }}
                  className="text-muted"
                >
                  <div>Updating on - {new Date().toLocaleDateString()}</div>
                  <p>
                    Created At: -{" "}
                    {new Date(note.createdAt).toLocaleDateString()}
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
