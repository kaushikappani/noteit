import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Mainscreen from '../components/Mainscreen';
import { useHistory } from "react-router-dom"
import Card from "../components/Card";
import axios from "axios";
import Header from '../components/Header';
import Loading from "../components/Loading";
import { PencilSquare } from 'react-bootstrap-icons';

const buttonStyle = { borderRadius: "100%", height: "75px", width: "75px", float: "right", position: "sticky", bottom: "5px", }

const Notes = () => {
    const history = useHistory();
    const [notes, setNotes] = useState({});
    const [user, setUser] = useState({});
    const [loading, setLoading] = useState(false);
    const authData = localStorage.getItem("userInfo")
    const fetchNotes = async () => {
        try {
            const config = {
                headers: {
                    "Authorization": "Bearer " + JSON.parse(authData).token,
                }
            }
            setLoading(true);
            const { data } = await axios.get("/api/notes", config)
            setNotes(data.notes)
            setUser(data.user);
            setLoading(false)
        } catch (e) {
            console.log("failed")
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
            {loading && <Mainscreen title="loading ..."><Loading /></Mainscreen>}
            {!loading && <Mainscreen
                title={`Welcome back ${user.verified ? user.name : "Verification email sent"}`}>
                {!loading && (notes.length >= 1 && notes?.reverse().map((e) => {
                    return (
                        <Card key={e._id} id={e._id} title={e.title} content={e.content} category={e.category} createdAt={e.createdAt} />
                    )
                }))}

                <Link to="/createnote">
                    <button style={buttonStyle} className="btn btn-md btn-success" type="button"><PencilSquare size={30} /></button>
                </Link>
            </Mainscreen>}

        </div>
    )
}

export default Notes
