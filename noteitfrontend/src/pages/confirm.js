import React, { useEffect } from 'react'
import {  useParams } from "react-router-dom";
import axios from "axios";
import Header from '../components/Header';

const Confirm = ({history}) => {
    const { id } = useParams();
    // const [success, setSuccess] = React.useState(false);
    const [data, setData] = React.useState();
    const [error, setError] = React.useState();
    const verify = async() => {
        try {
            const { data } = await axios.get(`/api/users/confirm/${id}`);
            setData(data);
            setTimeout(() => history.push("/notes"), 3000)
        } catch (err) {
            setError(err);
            // setTimeout(() => history.push("/notes"), 3000)
        }
    }
    useEffect(() => {
        verify();
    }, [])

    return (

        <div>
            <Header />
            {data && (<h1>{ data.message}</h1>)}
        </div>
    )
}

export default Confirm;
