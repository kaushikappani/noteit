import React from 'react'
import ReactMarkdown from "react-markdown";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import ReactTimeAgo from "react-time-ago";
import en from "javascript-time-ago/locale/en.json";
import ru from "javascript-time-ago/locale/ru.json";
import TimeAgo from "javascript-time-ago";
import Toolbar from "../components/Toolbar";
import "./css/toolbar.css";
TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);
const CardComponent = (p) => {
  const [isHovering, setIsHovering] = React.useState(false);
  const [color,setColor] = React.useState(p.color)
  const handleMouseOver = () => {
    setIsHovering(true);
  };

  const handleMouseOut = () => {
    setIsHovering(false);
  };
  const updateColor = (c) => {
    if (c === color) {
      setColor("#202124");
    } else {
      setColor(c);
    }
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
          width: "100%",
        }}
      >
        <CardContent>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Typography
              sx={{ fontSize: 14 }}
              style={{ color: "#c7dee5" }}
              gutterBottom
            >
              {p.category}
            </Typography>
          </div>
          <Typography variant="h5" component="div">
            {p.title}
          </Typography>
          <Typography variant="body2" style={{ color: "#c7dee5" }}>
            <ReactMarkdown>{p.content}</ReactMarkdown>
          </Typography>
          <Typography sx={{ fontSize: 14 }} gutterBottom>
            <ReactTimeAgo
              date={p.createdAt}
              locale="en-US"
              timeStyle="round-minute"
            />
          </Typography>
          <div style={{ visibility: isHovering ? "visible" : "hidden" }}>
            <Toolbar
              id={p.id}
              fetchNotes={p.fetchNotes}
              updateColor={updateColor}
            />
          </div>
        </CardContent>
      </Card>
    );
}

export default CardComponent;
