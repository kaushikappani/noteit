import React, { useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";
import Header from "../components/Header";
import Notification from "../components/Notification";
import axios from "axios";
import { Grid, Paper, useMediaQuery, useTheme } from "@mui/material";
import { Button, Form } from "react-bootstrap";
import NotesV2LeftCard from "../components/NotesV2LeftCard";
import NotesV2Detailed from "../components/NotesV2Detailed";

const NotesV2 = () => {

    const history = useHistory();
    const [notes, setNotes] = useState({});
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const [alert, setAlert] = useState({ open: false, type: "", message: "" });
    const [selectedNote, setSelectedNote] = useState({ _id: null, title: "", content: "" });
    const [originalNote, setOriginalNote] = useState(null);

    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
    const showEditorOnly = isMobile && selectedNote !== null;

    const editorRef = useRef();

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

    const handleNewNote = () => {
        setSelectedNote({ _id:null ,title:"",content:""});
        setOriginalNote({ _id: null, title: "", content: "" });
    };

    const handleNoteClick = (note) => {
        setSelectedNote(note);
        setOriginalNote(note);
    };

    const colorSync = async (id, color) => {
        setLoading(true);
        try {
            const config = { withCredentials: true };
            await axios.put(`/api/notes/${id}`, { color }, config);
            setAlert({
                open: true,
                type: "success",
                message: "Note - Color Updated",
            });
        } catch (e) {
            setAlert({
                open: true,
                type: "warning",
                message: e.response ? e.response.data.message : e.message,
            });
        }
        setLoading(false);
    };

    const handleSave = async (noteToSave) => {
        if (!noteToSave || !noteToSave.title || !noteToSave.content) return;
        if (!noteToSave._id && (noteToSave.title === "" || noteToSave.content === "")) return;

        setLoading(true);
        try {
            const config = { withCredentials: true };
            const payload = {
                title: noteToSave.title,
                content: noteToSave.content,
            };

            let updatedNote;
            if (noteToSave._id) {
                const { data } = await axios.put(`/api/notes/${noteToSave._id}`, payload, config);
                updatedNote = { ...noteToSave, ...payload };
            } else {
                const { data } = await axios.post(`/api/notes/create`, payload, config);
                updatedNote = data;
                await fetchNotes();
;            }

            setNotes((prevNotes) => ({
                ...prevNotes,
                [updatedNote._id]: updatedNote,
            }));

            console.log(notes);

            setSelectedNote(updatedNote);
            setOriginalNote(updatedNote);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    function debounce(fn, delay) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    const debouncedSave = useRef(debounce(handleSave, 1000)).current;

    const changeEditor = (text) => {
        setSelectedNote((prev) => {
            if (!prev || prev.content === text) return prev;
            const updated = { ...prev, content: text };
            if (text !== originalNote?.content) {
                debouncedSave(updated);
            }
            setNotes((prevNotes) => ({
                ...prevNotes,
                [updated._id]: updated,
            }));
            return updated;
        });
    };

    const changeTitle = (text) => {
        console.log(text);
        setSelectedNote((prev) => {
            console.log(prev);
            if (!prev || prev.title === text) return prev;
            const updated = { ...prev, title: text };
            if (updated._id && text !== originalNote?.title) {
                debouncedSave(updated);
            }
            setNotes((prevNotes) => ({
                ...prevNotes,
                [updated._id]: updated,
            }));
            return updated;
        });
    };
    useEffect(() => {
        fetchUser();
        fetchNotes();
    }, []);

    return (
        <div style={{ overflow: "hidden" }}>
            <Header page="notes" fetchNotes={fetchNotes} user={user} loading={loading} />
            <Notification alert={alert} setAlert={setAlert} />

            <Grid container spacing={2} style={{ padding: 10 }}>
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

                            <p>PINNED</p>
                            {Object.values(notes).filter((v) => v.pinned && v.view).map((note, index) => (
                                <NotesV2LeftCard
                                    key={note._id}
                                    note={note}
                                    selectedNote={selectedNote}
                                    handleNoteClick={handleNoteClick}
                                    fetchNotes={fetchNotes}
                                    setLoading={setLoading}
                                />
                            ))}

                            <p>OTHERS</p>
                            {Object.values(notes).filter((v) => !v.pinned && v.view).map((note, index) => (
                                <NotesV2LeftCard
                                    key={note._id}
                                    note={note}
                                    index={index}
                                    selectedNote={selectedNote}
                                    handleNoteClick={handleNoteClick}
                                    fetchNotes={fetchNotes}
                                    setLoading={setLoading}
                                />
                            ))}
                        </Paper>
                    </Grid>
                )}

                {(!isMobile || showEditorOnly) && (
                    <Grid item xs={12} md={8}>
                        <Paper
                            style={{
                                padding: 16,
                                height: isMobile ? "auto" : "80vh",
                                backgroundColor: "#1e1e1e",
                                color: "#e8eaed",
                                display: "flex",
                                flexDirection: "column",
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
                            {selectedNote && selectedNote._id && (<NotesV2Detailed id={selectedNote._id} changeEditor={changeEditor} changeTitle={changeTitle} editorRef={editorRef} />

                            )}
                            {selectedNote && !selectedNote._id && (<NotesV2Detailed id={null} changeEditor={changeEditor} changeTitle={changeTitle} editorRef={editorRef} />

                            )}
                        </Paper>
                    </Grid>
                )}
            </Grid>
        </div>
    );
};

export default NotesV2;
