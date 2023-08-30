import React from 'react'
import Card from "@mui/material/Card";
import en from "javascript-time-ago/locale/en.json";
import ru from "javascript-time-ago/locale/ru.json";
import TimeAgo from "javascript-time-ago";
import "./css/toolbar.css";
// import Editor from "rich-markdown-editor";
import {Notemodel} from "./Notemodel";

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);
const CardComponent = (p) => {
  const [isHovering, setIsHovering] = React.useState(false);
  const [color, setColor] = React.useState(p.color);
  const handleMouseOver = () => {
    setIsHovering(true);
  };

  const handleMouseOut = () => {
    setIsHovering(false);
  };

    return (
  
        <Card
          onMouseOver={handleMouseOver}
          onMouseOut={handleMouseOut}
          variant="outlined"
          style={{
            backgroundColor: color,
            color: "#e8eaed",
            borderColor: "#c7dee5",
            borderWidth: "0.2px",
            width: "100%",
          }}
        >

          <Notemodel props={p}>

          </Notemodel>

        </Card>
      
    );
}

export default CardComponent;
