import React from 'react'
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ReactTimeAgo from "react-time-ago";
import en from "javascript-time-ago/locale/en.json";
import ru from "javascript-time-ago/locale/ru.json";
import TimeAgo from "javascript-time-ago";
import Toolbar from "../components/Toolbar";
import "./css/toolbar.css";
import { Link } from 'react-router-dom';
import { PencilSquare } from 'react-bootstrap-icons';
import Editor from "rich-markdown-editor";
import {Notemodel} from "./Notemodel";

TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);
const CardComponent = (p) => {
  const [isHovering, setIsHovering] = React.useState(false);
  const [color, setColor] = React.useState(p.color);
  const modifyText = (text) => {
    text = text
      .replaceAll("!done", "✅")
      .replaceAll("!pending", "⏳")
      .replaceAll("!imp", "❗")
      .replaceAll("!bell", "🔔");
    return text;
  };
  const handleMouseOver = () => {
    setIsHovering(true);
  };

  const handleMouseOut = () => {
    setIsHovering(false);
  };
  const updateColor = (c) => {
    if (c === color) {
      setColor("#202124");
      p.colorSync(p.id, c);
    } else {
      setColor(c);
      p.colorSync(p.id, c);
    }
  };
  const pinNote = () => {
    p.pinNote(p.id);
  }
  const archive = () => {
    p.archive(p.id);
  }
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
        <Notemodel props = {p}>
          
        </Notemodel>
      </Card>
    );
}

export default CardComponent;
