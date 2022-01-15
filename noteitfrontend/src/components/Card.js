import React from 'react'
import { PencilSquare } from 'react-bootstrap-icons';
import ReactMarkdown from "react-markdown";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import { Link } from 'react-router-dom';
import ReactTimeAgo from "react-time-ago";
import en from "javascript-time-ago/locale/en.json";
import ru from "javascript-time-ago/locale/ru.json";
import TimeAgo from "javascript-time-ago";
import Toolbar from "../components/Toolbar";
TimeAgo.addDefaultLocale(en);
TimeAgo.addLocale(ru);
const CardComponent = (p) => {
    return (
      <Card
        variant="outlined"
        style={{
          backgroundColor: p.color,
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
            <Link to={`/note/${p.id}`}>
              <Typography sx={{ fontSize: 14 }} gutterBottom>
                <PencilSquare />
              </Typography>
            </Link>
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
          <Toolbar id={p.id} fetchNotes={p.fetchNotes} />
        </CardContent>
      </Card>
    );
}

export default CardComponent;
