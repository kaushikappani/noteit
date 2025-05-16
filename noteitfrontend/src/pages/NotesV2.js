import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import Header from "../components/Header";
import Notification from "../components/Notification";
import axios from "axios";
import { Grid, Paper, Toolbar, Typography } from "@mui/material";
import { Button, Form } from "react-bootstrap";
import SunEditorComponent from "../components/SunEditorComponent";
import SunEditor from "suneditor-react";
import { useMediaQuery, useTheme } from "@mui/material";

const NotesV2 = () => {

    const editorOptions = {
        height: 200,
        buttonList: [
            ["undo", "redo"],
            ["removeFormat"],
            ["bold", "underline", "italic", "fontSize"],
            ["fontColor", "hiliteColor"],
            ["align", "horizontalRule", "list"],
            ["table", "link"],
            ["showBlocks", "codeView"]

        ],
        imageRotation: false,
        fontSize: [12, 13, 14, 16, 18, 20],
        colorList: [
            [
                "#828282",
                "#FF5400",
                "#676464",
                "#F1F2F4",
                "#FF9B00",
                "#F00",
                "#fa6e30",
                "#000",
                "rgba(255, 153, 0, 0.1)",
                "#FF6600",
                "#0099FF",
                "#74CC6D",
                "#FF9900",
                "#CCCCCC"
            ]
        ]
    };

    const history = useHistory();
    const [notes, setNotes] = useState({});
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: "", message: "" });
    const [selectedNote, setSelectedNote] = useState(null);
    const editorRef = useRef();

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const showEditorOnly = isMobile && selectedNote !== null;

    const fetchUser = async () => {
        try {
            const config = { withCredentials: true };
            const { data } = await axios.get("/api/users/info", config);
            setUser(data);
        } catch (e) {
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
            history.push("/");
        }
    };

    const fetchNotes = async () => {
        setLoading(true);
        try {
            const config = { withCredentials: true };
            const { data } = await axios.get("/api/notes", config);
            setNotes(data.modifiedNotes || {});
        } catch (e) {
            localStorage.clear();
            history.push("/");
        } finally {
            setLoading(false);
        }
    };

    const changeEditor = (text) => {
        setSelectedNote((prev) => ({ ...prev, content: text }));
    };

    const handleNewNote = () => {
        setSelectedNote({ title: "", content: "" });
    };

    const handleNoteClick = (note) => {
        setSelectedNote(note);
    };

    const colorSync = async (id, color) => {
        setLoading(true);
        try {
            const config = {
                withCredentials: true,
            };
            await axios.put(`/api/notes/${id}`, { color }, config);
            // notify("Updated", {
            //     position: "top-right",
            //     autoClose: 2000,
            //     hideProgressBar: false,
            //     closeOnClick: true,
            //     pauseOnHover: true,
            //     draggable: true,
            //     progress: undefined,
            //     theme: "dark",
            // });
            setAlert({
                open: true,
                type: "success",
                message: "Note - Color Updated",
            });
        } catch (e) {
            console.log(e.response ? e.response.data.message : e.message)
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
        }
        setLoading(false);
    };

    const handleSave = async () => {
        if (!selectedNote) return;
        try {
            const config = { withCredentials: true };
            const payload = {
                title: selectedNote.title,
                content: selectedNote.content,
            };

            if (selectedNote._id) {
                await axios.put(`/api/notes/${selectedNote._id}`, payload, config);
            } else {
                await axios.post(`/api/notes`, payload, config);
            }

            setAlert({ open: true, type: "success", message: "Note saved!" });
            fetchNotes();
        } catch (err) {
            setAlert({
                open: true,
                type: "danger",
                message: err.response?.data?.message || "Error saving note",
            });
        }
    };


    

    useEffect(() => {
        fetchUser();
        fetchNotes();
    }, []);

    return (
        <div style={{ height: "100vh", overflow: "hidden" }}>
            <Header page="notes" fetchNotes={fetchNotes} user={user} loading={loading} />
            <Notification alert={alert} setAlert={setAlert} />

            <Grid container spacing={2} style={{ padding: 20 }}>
                {/* Left panel: Notes List */}
                {!showEditorOnly && (
                    <Grid item xs={12} md={4}>
                        <Paper
                            style={{
                                padding: 1,
                                height: isMobile ? "auto" : "80vh",
                                overflowY: "auto",
                                backgroundColor: "#1e1e1e",
                                color: "#e8eaed"
                            }}
                        >
                            <div className="d-flex justify-content-between align-items-center mb-3">
                                <h5>Your Notes</h5>
                                <Button variant="primary" size="sm" onClick={handleNewNote}>
                                    + New
                                </Button>
                            </div>
                            {Object.values(notes).length > 0 ? (
                                Object.values(notes).map((note, index) => (
                                    <Paper
                                        key={index}
                                        onClick={() => handleNoteClick(note)}
                                        style={{
                                            padding: "10px",
                                            marginBottom: "10px",
                                            cursor: "pointer",
                                            backgroundColor:
                                                selectedNote && selectedNote._id === note._id
                                                    ? "#333"
                                                    : "#2a2a2a",
                                            color: "#e8eaed",
                                        }}
                                    >
                                        <Typography variant="subtitle1">
                                            {note.title || "Untitled"}
                                        </Typography>

                                        <Toolbar
                                            id={note.id}
                                            fetchNotes={note.fetchNotes}
                                            //updateColor={colorSync ? updateColor : null}
                                            //={note.pinNote ? pinNote : null}
                                            //archive={archive}
                                        />
                                    </Paper>
                                ))
                            ) : (
                                <p>No notes found.</p>
                            )}
                        </Paper>
                    </Grid>
                )}

                {/* Right panel: Note Editor */}
                {(!isMobile || showEditorOnly) && (
                    <Grid item xs={12} md={8}>
                        <Paper
                            style={{
                                padding: 16,
                                height: isMobile ? "auto" : "80vh",
                                overflowY: "auto",
                                backgroundColor: "#1e1e1e",
                                color: "#e8eaed"
                            }}
                        >
                            {isMobile && (
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    className="mb-3"
                                    onClick={() => setSelectedNote(null)}
                                >
                                    ← Back to Notes
                                </Button>
                            )}
                            <Typography variant="h6" className="mb-3">
                                {selectedNote?._id ? "Edit Note" : "New Note"}
                            </Typography>
                            <Form>
                                <Form.Group controlId="noteTitle" className="mb-3">
                                    <Form.Label style={{ color: "#e8eaed" }}>Title</Form.Label>
                                    <Form.Control
                                        type="text"
                                        placeholder="Note title"
                                        value={selectedNote?.title || ""}
                                        onChange={(e) => {
                                            if (selectedNote) {
                                                setSelectedNote({
                                                    ...selectedNote,
                                                    title: e.target.value,
                                                });
                                            }
                                        }}
                                        style={{
                                            backgroundColor: "#202124",
                                            color: "#e8eaed",
                                            borderColor: "#c7dee5"
                                        }}
                                    />
                                </Form.Group>

                                <Form.Group controlId="noteContent" className="mb-3">
                                    <Form.Label style={{ color: "#e8eaed" }}>Content</Form.Label>
                                    <SunEditor
                                        disable={false}
                                        hideToolbar={false}
                                        height="75vh"
                                        ref={editorRef}
                                        onChange={changeEditor}
                                        setOptions={editorOptions}
                                        setContents={selectedNote?.content}
                                        lang="en"
                                    />
                                </Form.Group>

                                <Button variant="success" onClick={handleSave}>
                                    Save
                                </Button>
                            </Form>
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </div>
    );
};

export default NotesV2;
