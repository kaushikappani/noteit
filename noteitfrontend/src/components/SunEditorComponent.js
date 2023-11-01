import React from 'react'
import SunEditor from 'suneditor-react';
import 'suneditor/dist/css/suneditor.min.css';


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
    fontSize: [12, 14, 16, 18, 20],
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


const SunEditorComponent = ({ data, changeEditor,editorRef,disable }) => {
    return (
        <SunEditor
            style={{color:"red"}}
            disable={disable}
            hideToolbar={disable}
            height="60vh"
            ref={editorRef}
            setOptions={editorOptions}
            onChange={changeEditor}
            setContents={data.content}
            lang="en"
        />
    )
}

export default SunEditorComponent;



