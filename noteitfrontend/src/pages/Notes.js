import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import Card from "../components/Card";
import axios from "axios";
import Header from "../components/Header";
import { PencilSquare, Search } from "react-bootstrap-icons";
import { Input, Typography } from "@mui/material";
import { Container } from "react-bootstrap";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import ApiCalendar from "react-google-calendar-api";
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
};

const Notes = () => {
  const history = useHistory();
  const [notes, setNotes] = useState({});
  const [user, setUser] = useState({});
  const [loading, setLoading] = useState(false);
  const [googleCredentials, setGoogleCredentials] = useState(false);
  const notify = (message, type) => toast(message, type);
  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: "",
  });
  const responseGoogle = async (response) => {
    setGoogleCredentials(response);
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.post(
        "/api/users/googleauth",
        { response },
        config
      );
      console.log(data);
    } catch (err) {
      console.log(err);
    }
  };
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
    } catch (e) {}
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
    } catch (e) {
      console.log(e);
      localStorage.clear();
      history.push("/");
      setLoading(false);
    }
  };

  const handleSearch = (value) => {
    console.log("handle search");
    const updatedNotes = notes.map((note) => ({
      ...note,
      view:
        note.content.toLowerCase().includes(value) ||
        note.title.toLowerCase().includes(value) ||
        note.category.toLowerCase().includes(value),
    }));

    setNotes(updatedNotes);
  };

  const SignIn = () => {
    ApiCalendar.handleAuthClick();
    console.log("logged in");
  };

  useEffect(() => {
    fetchNotes();
    // google.accounts.id.initialize({
    //   client_id:
    //     "557971450533-9m9mphqj0usak21cs88qgjj3v190kj47.apps.googleusercontent.com",
    //   callback: responseGoogle,
    //   access_type:"offline"
    // });
    // google.accounts.id.prompt((notification) => {
    //   console.log(notification);
    // });
    //eslint-disable-next-line
  }, []);

  return (
    <div>
      {/* <ToastContainer /> */}

      <Header
        page="notes"
        fetchNotes={fetchNotes}
        user={user}
        loading={loading}
      />
      <Notification alert={alert} setAlert={setAlert} />

      {
        <div>
          <Container>
            {/* <div>
              <button onClick={SignIn}>Sign IN</button>
            </div> */}
            <Input
              startAdornment={
                <InputAdornment position="start">
                  <Search color="white" />
                </InputAdornment>
              }
              onChange={(e) => handleSearch(e.target.value)}
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
              columnsCountBreakPoints={{ 350: 1, 750: 3, 1000: 4 }}
            >
              <Masonry gutter={"7px"}>
                {notes?.length >= 1 &&
                  notes
                    ?.filter((v) => v.pinned === true && v.view)
                    .map((e) => {
                      return (
                        e.pinned && (
                          <>
                            <Card
                              key={e._id}
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
              columnsCountBreakPoints={{ 350: 1, 750: 3, 1000: 4 }}
            >
              <Masonry gutter={"7px"}>
                {notes?.length > 0 &&
                  notes
                    ?.filter((v) => v.pinned === false && v.view)
                    .map((e) => {
                      return (
                        e.view && (
                          <Card
                            key={e._id}
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
