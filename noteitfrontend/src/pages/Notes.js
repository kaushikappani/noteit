import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import Card from "../components/Card";
import axios from "axios";
import Header from "../components/Header";
import { PencilSquare, Search, ChatDots } from "react-bootstrap-icons";
import { Input, Typography } from "@mui/material";
import { Button, Container } from "react-bootstrap";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import Notification from "../components/Notification";

import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Create from "./Create";
import InputAdornment from "@mui/material/InputAdornment";
import RemindersCard from "../components/RemindersCard";
import { isMobile } from 'react-device-detect';
import StockIndexCards from "../components/StockIndexCards";
import ChatPage from "./NoteItChat";


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
  const [reloadStockDataCallback, setReloadStockDataCallback] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);


  const notify = (message, type) => toast(message, type);
  const [alert, setAlert] = useState({
    open: false,
    type: "",
    message: "",
  });

  function sendSubscriptionToServer(subscription, user) {
    return fetch('/api/webpush/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription, user, subscriptionType: isMobile ? "mobile" : "web" }),
      headers: {
        'Content-Type': 'application/json',
      },
    })
      .then(function (response) {
        if (!response.ok) {
          throw new Error('Failed to send subscription to server');
        }
        return response.json();
      })
      .catch(function (error) {
        console.error('Error sending subscription to server:', error);
      });
  }

  function subscribeUser(user) {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(function (registration) {
        if (!registration.pushManager) {
          console.log('Push manager unavailable.');
          return;
        }

        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array("BMW33keysXHJ-xrCQrBsCWZscmQK02RehvanDFhipdeq1ImmDOblKRbAU3_LJQkJXtXdfhZV3wS4cKmjhW-qSeY"),
        })
          .then(function (subscription) {
            console.log('User is subscribed:', subscription);
            sendSubscriptionToServer(subscription, user);  // Send this subscription object to your server
          })
          .catch(function (err) {
            console.log('Failed to subscribe the user: ', err);
          });
      });
    }
  }

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding)
      .replace(/\-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }


  const archive = async (id) => {
    setLoading(true);
    try {
      setNotes((prev) => {
        return prev.filter((e) => e._id !== id);
      });
      const config = {
        withCredentials: true,
      };
        await axios.put(
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
      await axios.put(
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
      await axios.put(`/api/notes/${id}`, { color }, config);
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
      // setUser(data.user);
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

  const fetchUser = async () => {
    console.log("fetch user");
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.get("/api/users/info", config);
      setUser(data);
      subscribeUser(data);
    } catch (e) {
      setAlert({
        open: true,
        type: "warning",
        message: e.response ? e.response.data.message : e.message,
      });
      history.push("/");
    }
  };

  const fetchSharedNotes = async () => {
    try {
      const config = {
        withCredentials: true,
      };
      const { data } = await axios.get("/api/notes/shared", config);
      console.log(data)
      setSharedNotes(data.notes);

    
    } catch (e) {
      console.log(e);
      localStorage.clear();
      history.push("/");
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
    setReloadStockDataCallback((prev) => {
      return !prev;
      }); 
    
    fetchNotes();
    fetchSharedNotes();
  }
  useEffect(() => {
    fetchNotes();
    fetchSharedNotes();
    fetchUser();
   
    window.addEventListener('focus', reload);

    return () => {
      window.removeEventListener('focus', reload);
    }

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
            <StockIndexCards reloadStockData={reloadStockDataCallback}  />
            <RemindersCard refreshReminders={fetchNotes} />

            {/* <div
              style={{
                position: 'fixed',
                bottom: '20px',
                left: '20px',
                zIndex: 1300,
              }}
            >
              <Button
                variant="primary"
                onClick={() => setIsChatOpen(prev => !prev)}
                style={{
                  borderRadius: '50%',
                  width: '56px',
                  height: '56px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  fontSize: '1.4rem',
                }}
              >
                <ChatDots />
              </Button>
            </div> */}

            {/* Chat Popup */}
            {/* {isChatOpen && (
              <div
                style={{
                  position: 'fixed',
                  bottom: '90px',
                  left: '20px',
                  width: '350px',
                  height: '500px',
                  zIndex: 1300,
                  backgroundColor: '#121212',
                  borderRadius: '10px',
                  boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                  overflow: 'hidden',
                  border: '1px solid #333',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <ChatPage />
              </div>
            )} */}

            <ChatPage />
            {/* <Input
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
            /> */
            }

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
              <Masonry gutter={"10px"}>
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
                              edit={e.edit}
                              from="notes"
                            />
                          </>
                        )
                      );
                    })}
              </Masonry>
            </ResponsiveMasonry>

            {notes?.length > 0 && (
              <Typography
                sx={{ fontSize: 14 }}
                style={{ color: "#c7dee5",marginTop:"20px" }}
                gutterBottom
              >
                OTHERS
              </Typography>
            )}
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 750: 2, 1000: 3 }}
            >
              <Masonry gutter={"10px"}>
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
                            edit={e.edit}
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
                            edit={e.edit}
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
