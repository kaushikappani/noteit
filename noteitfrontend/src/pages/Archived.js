import React, { useState, useEffect } from 'react';
import { useHistory } from "react-router-dom";

import axios from "axios";
import Header from '../components/Header';
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import Card from "../components/Card";
import { Container } from 'react-bootstrap';
import { Typography } from '@mui/material';

const Archived = () => {
  const history = useHistory();
   const [notes, setNotes] = useState({});
   const [user, setUser] = useState({});
  const [loading, setLoading] = useState(false);
  const archive = async (id) => {
    setLoading(true);
    try {
      setNotes((prev) => {
        return prev.filter((e) => e._id !== id);
      });
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.put(
        `/api/notes/${id}`,
        { archived: true },
        config
      );
    } catch (e) {}
    setLoading(false);
  };
  const fetchNotes = async () => {
    setLoading(true);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.get("/api/notes/archived", config);
      setNotes(data.notes);
      console.log(data.notes);
      setLoading(false);
      setUser(data.user);
    } catch (e) {
      console.log("failed124");
      localStorage.clear();
      history.push("/");
      setLoading(false);
    }
  };
  useEffect(() => {
    fetchNotes();
  },[])
  return (
    <div>
      <Header fetchNotes={fetchNotes} user={user} loading={loading} />
      <Container>
        <Typography
          sx={{ fontSize: 14 }}
          style={{ color: "#c7dee5" }}
          gutterBottom
        >
          ARCHIVED
        </Typography>
        <ResponsiveMasonry
          columnsCountBreakPoints={{ 350: 1, 750: 3, 1000: 4 }}
        >
          <Masonry gutter={"7px"}>
            {notes?.length >= 0 &&
              notes?.map((e) => {
                console.log(e);
                return (
                  <Card
                    key={e._id}
                    id={e._id}
                    title={e.title}
                    content={e.content}
                    category={e.category}
                    createdAt={e.createdAt}
                    color={e.color}
                    fetchNotes={fetchNotes}
                    archive={archive}
                  />
                );
              })}
          </Masonry>
        </ResponsiveMasonry>
      </Container>
    </div>
  );
};

export default Archived;
