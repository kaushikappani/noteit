import { Button } from '@mui/material';
import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react'
import { Form } from 'react-bootstrap';
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';
import Notification from './Notification';
import GeminiLogo from './GeminiLogo';

const NotesV2Detailed = (props) => {
    const editorOptions = {
        height: 200,
        buttonList: [
            ["bold", "underline", "italic", "fontSize"],
            ["fontColor", "hiliteColor"],
            ["align", "horizontalRule", "list"],
            ["table", "link"],
        ],
        fontSize: [12, 13, 14, 16, 18, 20],
        colorList: [
            [
                "#828282", "#FF5400", "#676464", "#F1F2F4",
                "#FF9B00", "#F00", "#fa6e30", "#000",
                "rgba(255, 153, 0, 0.1)", "#FF6600", "#0099FF",
                "#74CC6D", "#FF9900", "#CCCCCC"
            ]
        ],
        defaultStyle: "font-size: 18px;"
    };

    const [selectedNote, setSelectedNote] = useState(null);
    const [aiLoading, setAiLoading] = useState(false);

    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: "",
    });

    const fetchData = async (noteHistory) => {
        if (!props.id) return;
        try {
            const config = { withCredentials: true };
            props.setLoading(true);
            const { data } = await axios.get(`/api/notes/${props.id}/${noteHistory}`, config);
            setSelectedNote(data.note);
        } catch (e) {
            console.error("Failed to fetch note:", e);
        } finally {
            props.setLoading(false);
        }
    };
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
        fetchData("h0");
    }, [props.id]);

    return (
        <>

 
        

            <Form style={{ flex: 1, display: "flex", flexDirection: "column" }}>
                
                <Notification alert={alert} setAlert={setAlert} />

                <Form.Group controlId="noteTitle" className="mb-3">
                    <div className="d-flex align-items-center gap-2">
                        <Form.Control
                            type="text"
                            placeholder="Title"
                            value={selectedNote?.title || ""}
                            onChange={(e) => {
                                setSelectedNote(prev => ({ ...prev, title: e.target.value }));
                                props.changeTitle(e.target.value);
                            }}
                            style={{
                                backgroundColor: "#202124",
                                color: "#e8eaed",
                                borderColor: "#c7dee5",
                                flex: 1,
                            }}
                        />
                        <Button
                            variant="contained"
                            size="small"
                            onClick={() => generateAiSummary()}
                            sx={{
                                borderRadius: '999px',
                                background: 'linear-gradient(90deg, #00c6ff 0%, #0072ff 100%)',
                                color: '#fff',
                                fontWeight: 'bold',
                                textTransform: 'none',
                                fontSize: '0.8rem',
                                padding: '6px 16px',
                                boxShadow: '0 0 8px rgba(0, 114, 255, 0.6)',
                                transition: 'all 0.3s ease-in-out',
                                '&:hover': {
                                    background: 'linear-gradient(90deg, #0072ff 0%, #00c6ff 100%)',
                                    boxShadow: '0 0 12px rgba(0, 114, 255, 0.9)',
                                },
                            }}
                        >
                            AI Summary
                        </Button>
                    </div>
                </Form.Group>

                <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column' }}>
                    <GeminiLogo aiLoading={aiLoading} />
                    {/* other content */}
                <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
                    <SunEditor
                        disable={false}
                        hideToolbar={false}
                        height="100%"
                        setContents={selectedNote?.content || ""}
                        ref={props.editorRef}
                        onChange={(content) => {
                            setSelectedNote(prev => ({ ...prev, content }));
                            props.changeEditor(content);
                        }}
                        setOptions={editorOptions}
                    />
                    </div>
                    
            </div>
                </Form>
            </>
    );
};

export default NotesV2Detailed;
