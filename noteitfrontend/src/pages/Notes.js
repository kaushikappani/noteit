import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Mainscreen from '../components/Mainscreen';
import { useHistory } from "react-router-dom"
import Card from "../components/Card";
import axios from "axios";
import Header from '../components/Header';
import Loading from "../components/Loading";
import { PencilSquare } from 'react-bootstrap-icons';
import { Container, Grid } from '@mui/material';

const buttonStyle = { borderRadius: "100%", height: "75px", width: "75px", float: "right", position: "sticky", bottom: "5px", }

const Notes = () => {
    const history = useHistory();
    const [notes, setNotes] = useState({});
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(true);
    const authData = localStorage.getItem("userInfo");

    const fetchNotes = async () => {
        try {
            const config = {
                headers: {
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
          const { data } = await axios.get("/api/notes", config)
          setNotes(data.notes);
          setLoading(false);
            setUser(data.user);
        } catch (e) {
            console.log("failed124")
            localStorage.clear();
            history.push('/');
            setLoading(false);
        }
    }
    useEffect(() => {
        fetchNotes();
        //eslint-disable-next-line
    }, [])

    return (
      <div>
        <Header user={user} />
        <Container>{loading && <Loading />}</Container>
        {!loading && (
          <Container style={{ marginTop: "20px" }}>
            <Grid
              container
              rowSpacing={2}
              columnSpacing={{ xs: 1, sm: 2, md: 2, lg: 2 }}
              style={{ display: "flex", flexWrap: "wrap" }}
            >
              {!loading &&
                notes.length >= 1 &&
                notes?.map((e) => {
                  return (
                    <Grid item lg={3} md={6} sm={6} xs={12}>
                      <Card
                        key={e._id}
                        id={e._id}
                        title={e.title}
                        content={e.content}
                        category={e.category}
                        createdAt={e.createdAt}
                        color={e.color}
                        fetchNotes={fetchNotes}
                      />
                    </Grid>
                  );
                })}
            </Grid>

            <Link to="/createnote">
              <button
                style={buttonStyle}
                className="btn btn-md btn-success"
                type="button"
              >
                <PencilSquare size={30} />
              </button>
            </Link>
          </Container>
        )}
      </div>
    );
}

export default Notes
