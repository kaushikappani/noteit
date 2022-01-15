import React from 'react';
import { CircleFill } from "react-bootstrap-icons";
import axios from "axios";

const Toolbar = ({ id, fetchNotes }) => {
  const authData = localStorage.getItem("userInfo");
    const changeColor = async (color) => {
    try {
      const config = {
        headers: {
          Authorization: "Bearer " + JSON.parse(authData).token,
        },
      };
        const { data } = await axios.put(`/api/notes/${id}`, { color }, config);
        fetchNotes();
    } catch (e) {}
  };

  return (
    <div style={{ display: "flex", justifyContent: "flex-start" }}>
      <CircleFill
        style={{
          borderRadius: "100%",
          margin: "5px",
          color: "#5c2b29",
          border: "1px solid white",
        }}
        onClick={(e) => changeColor("#5c2b29")}
      />
      <CircleFill
        style={{
          borderRadius: "100%",
          margin: "5px",
          color: "#345920",
          border: "1px solid white",
        }}
        onClick={() => changeColor("#345920")}
      />
      <CircleFill
        style={{
          borderRadius: "100%",
          margin: "5px",
          color: "#614a19",
          border: "1px solid white",
        }}
        onClick={() => changeColor("#614a19")}
      />
    </div>
  );
};

export default Toolbar
