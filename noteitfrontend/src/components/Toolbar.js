import React from 'react';
import { CircleFill } from "react-bootstrap-icons";
import axios from "axios";
import { Link } from 'react-router-dom';
import { Typography } from '@mui/material';
import { PencilSquare,PinFill } from "react-bootstrap-icons";
import "./css/toolbar.css";

const Toolbar = ({ id, fetchNotes, updateColor }) => {
  const changeColor = async (color) => {
    updateColor(color);
  };

  return (
    <div className="toolbar">
      <CircleFill
        size={17}
        style={{
          borderRadius: "100%",
          margin: "7px",
          color: "#5c2b29",
          border: "1px solid white",
          cursor: "pointer",
        }}
        onClick={(e) => changeColor("#5c2b29")}
      />
      <CircleFill
        size={17}
        style={{
          borderRadius: "100%",
          margin: "7px",
          color: "#345920",
          border: "1px solid white",
          cursor: "pointer",
        }}
        onClick={() => changeColor("#345920")}
      />
      <CircleFill
        size={17}
        style={{
          borderRadius: "100%",
          margin: "7px",
          color: "#614a19",
          border: "1px solid white",
          cursor: "pointer",
        }}
        onClick={() => changeColor("#614a19")}
      />
      <Link to={`/note/${id}`}>
        <Typography sx={{ fontSize: 18 }} gutterBottom>
          <PencilSquare size={17} />
        </Typography>
      </Link>
      
    </div>
  );
};

export default Toolbar
