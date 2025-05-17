import axios from 'axios';
import React, { useEffect, useRef, useState } from 'react'
import { Form } from 'react-bootstrap';
import SunEditor from 'suneditor-react';

const NotesV2Detailed = (props) => {
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
        fontSize: [12, 13, 14, 16, 18, 20],
        colorList: [
            [
                "#828282", "#FF5400", "#676464", "#F1F2F4",
                "#FF9B00", "#F00", "#fa6e30", "#000",
                "rgba(255, 153, 0, 0.1)", "#FF6600", "#0099FF",
                "#74CC6D", "#FF9900", "#CCCCCC"
            ]
        ]
    };

    const [selectedNote, setSelectedNote] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = async (noteHistory) => {
        if (!props.id) return;
        try {
            const config = {
                withCredentials: true,
            };
            setLoading(true);
            const { data } = await axios.get(
                `/api/notes/${props.id}/${noteHistory}`,
                config
            );
            setSelectedNote(data.note);
            setLoading(false);
        } catch (e) {
            console.log(e);
            console.log("failed");
            // history.push("/");
            setLoading(false);
        }
    };
    useEffect(() => {
        fetchData("h0");
    }, [props.id]);
  return (
      <Form style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <Form.Group controlId="noteTitle" className="mb-3">
              <Form.Control
                  type="text"
                  placeholder="Title"
                  value={selectedNote?.title}
                  onChange={(e) => {
                      setSelectedNote(prev => ({
                          ...prev,
                          title: e.target.value
                      }));
                      props.changeTitle(e.target.value);
                  }}
                  style={{
                      backgroundColor: "#202124",
                      color: "#e8eaed",
                      borderColor: "#c7dee5",
                  }}
              />

          </Form.Group>

          <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
              <SunEditor
                  disable={false}
                  hideToolbar={false}
                  height="100%"
                  ref={props.editorRef}
                  onChange={props.changeEditor}
                  setOptions={editorOptions}
                  setContents={selectedNote?.content || ""}
                  lang="en"
              />
          </div>
      </Form>
  )
}

export default NotesV2Detailed