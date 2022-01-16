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
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";

const buttonStyle = { borderRadius: "100%", height: "75px", width: "75px", float: "right", position: "sticky", bottom: "5px", }

const Notes = () => {
    const history = useHistory();
    const [notes, setNotes] = useState({});
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(true);

    const fetchNotes = async () => {
        try {
            const config = {
              withCredentials: true,
            };
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
            <ResponsiveMasonry
              columnsCountBreakPoints={{ 350: 1, 750: 3, 1000: 4 }}
            >
              <Masonry gutter={"7px"}>
                {!loading &&
                  notes.length >= 1 &&
                  notes?.map((e) => {
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
                      />
                    );
                  })}
              </Masonry>
            </ResponsiveMasonry>

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
