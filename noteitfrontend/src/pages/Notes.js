import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import Card from "../components/Card";
import axios from "axios";
import Header from "../components/Header";
import { PencilSquare, Search } from "react-bootstrap-icons";
import { Input, Typography } from "@mui/material";
import { Container } from "react-bootstrap";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import Notification from "../components/Notification";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Create from "./Create";
import InputAdornment from "@mui/material/InputAdornment";

const ariaLabel = { "aria-label": "Search" };

const buttonStyle = {
  borderRadius: "100%",
  height: "60px",
  width: "60px",
  float: "right",
  position: "sticky",
  bottom: "5px",
  zIndex: "1000000"
};

const Notes = () => {
  const history = useHistory();
  const [notes, setNotes] = useState({});
  const [sharedNotes, setSharedNotes] = useState({});
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState();
  const notify = (message, type) => toast(message, type);
  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: "",
  });

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
      console.log("triggered");

      notify("Archived", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setAlert({
        open: true,
        type: "success",
        message: "Archived",
      });
    } catch (e) {}
    setLoading(false);
  };
  const pinNote = async (id) => {
    const updatedNotes = notes.map((e) => {
      if (e._id === id) {
        const newItem = {
          ...e,
          pinned: !e.pinned,
        };
        return newItem;
      }
      return e;
    });
    setNotes(updatedNotes);
    setLoading(true);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.put(
        `/api/notes/${id}`,
        { pinned: true },
        config
      );
      notify("Updated", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setAlert({
        open: true,
        type: "success",
        message: "Note - Updated",
      });
    } catch (e) {}
    setLoading(false);
  };

  const colorSync = async (id, color) => {
    setLoading(true);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.put(`/api/notes/${id}`, { color }, config);
      notify("Updated", {
        position: "top-right",
        autoClose: 2000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
        theme: "dark",
      });
      setAlert({
        open: true,
        type: "success",
        message: "Note - Color Updated",
      });
    } catch (e) {
      console.log(e.response ? e.response.data.message : e.message)
      setAlert({
        open: true,
        type: "warning",
        message: e.response ? e.response.data.message : e.message,
      });
    }
    setLoading(false);
  };
  const fetchNotes = async () => {
    setLoading(true);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.get("/api/notes", config);
      console.log(data)
      setNotes(data.modifiedNotes);

      setLoading(false);
      setUser(data.user);
      console.log(searchText)
      if (searchText) {
        handleSearch(searchText)
     }
    } catch (e) {
      console.log(e);
      localStorage.clear();
      history.push("/");
      setLoading(false);
    }
    
  };

  const fetchSharedNotes = async () => {
    setLoading(true);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.get("/api/notes/shared", config);
      console.log(data)
      setSharedNotes(data.notes);

      setLoading(false);
    } catch (e) {
      console.log(e);
      localStorage.clear();
      history.push("/");
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    
    setSearchText(e.target.value);
    console.log("handle search");
    const updatedNotes = notes.map((note) => ({
      ...note,
      view:
        note.content.toLowerCase().includes(e.target.value) ||
        note.title.toLowerCase().includes(e.target.value) ||
        note.category.toLowerCase().includes(e.target.value),
    }));
    setNotes(updatedNotes);


  };

  const reload = () => {
    fetchNotes();
    fetchSharedNotes();
  }

  useEffect(() => {
    fetchNotes();
    fetchSharedNotes();
  }, []);

  return (
    <div>
      {/* <ToastContainer /> */}

      <Header
        page="notes"
        fetchNotes={reload}
        user={user}
        loading={loading}
      />
      <Notification alert={alert} setAlert={setAlert} />

      {
        <div>
          <Container>
            <Input
              startAdornment={
                <InputAdornment position="start">
                  <Search color="white" />
                </InputAdornment>
              }
              
              onChange={(e) => handleSearch(e)}
              fullWidth="true"
              style={{ color: "white" }}
              variant="standard"
              defaultValue=""
              inputProps={ariaLabel}
            />
            {notes?.length > 0 && (
              <Typography
                sx={{ fontSize: 14 }}
                style={{ color: "#c7dee5" }}
                gutterBottom
              >
                PINNED
              </Typography>
            )}
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 750: 2, 1000: 3 }}
            >
              <Masonry gutter={"15px"}>
                {notes?.length >= 1 &&
                  notes
                    ?.filter((v) => v.pinned === true && v.view)
                    .map((e,i) => {
                      return (
                        e.pinned && (
                          <>
                            <Card
                              key={'input' + i}
                              id={e._id}
                              title={e.title}
                              content={e.content}
                              category={e.category}
                              createdAt={e.createdAt}
                              color={e.color}
                              fetchNotes={fetchNotes}
                              colorSync={colorSync}
                              pinNote={pinNote}
                              archive={archive}
                              setNotes={setNotes}
                              notes={notes}
                              view={e.view}
                              from="notes"
                            />
                          </>
                        )
                      );
                    })}
              </Masonry>
            </ResponsiveMasonry>
          </Container>
          <Container style={{ marginTop: "20px" }}>
            {notes?.length > 0 && (
              <Typography
                sx={{ fontSize: 14 }}
                style={{ color: "#c7dee5" }}
                gutterBottom
              >
                OTHERS
              </Typography>
            )}
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 750: 2, 1000: 3 }}
            >
              <Masonry gutter={"15px"}>
                {notes?.length > 0 &&
                  notes
                    ?.filter((v) => v.pinned === false && v.view)
                    .map((e,i) => {
                      return (
                        e.view && (
                          <Card
                            id={e._id}
                            title={e.title}
                            content={e.content}
                            category={e.category}
                            createdAt={e.createdAt}
                            color={e.color}
                            fetchNotes={fetchNotes}
                            colorSync={colorSync}
                            pinNote={pinNote}
                            archive={archive}
                            setNotes={setNotes}
                            notes={notes}
                            view={e.view}
                            from="notes"
                            key={'input' + i}
                          />
                        )
                      );
                    })}
              </Masonry>
            </ResponsiveMasonry>

            {sharedNotes?.length > 0 && (
              <Typography
                sx={{ fontSize: 14 }}
                style={{ color: "#c7dee5" }}
                gutterBottom
              >
                SHARED NOTES
              </Typography>
            )}
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 750: 2, 1000: 3 }}
            >
              <Masonry gutter={"15px"}>
                {sharedNotes?.length >= 1 &&
                  sharedNotes
                    ?.map((e, i) => {
                      return ((
                          <>
                            <Card
                              key={'input' + i}
                              id={e._id}
                              title={e.title}
                              content={e.content}
                              category={e.category}
                              createdAt={e.createdAt}
                              color={e.color}
                              fetchNotes={fetchNotes}
                              colorSync={colorSync}
                              pinNote={pinNote}
                              archive={archive}
                              setNotes={setNotes}
                              notes={notes}
                              view={e.view}
                              from="notes"
                            />
                          </>
                        )
                      );
                    })}
              </Masonry>
            </ResponsiveMasonry>
            <button
              style={buttonStyle}
              className="btn btn-md btn-success"
              type="button"
            >
              <Create setNotes={setNotes} fetchNotes={fetchNotes}>
                <PencilSquare size={25} />
              </Create>
            </button>
          </Container>
        </div>
      }
    </div>
  );
};

export default Notes;
