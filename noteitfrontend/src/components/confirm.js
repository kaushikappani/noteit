import React, { useEffect } from 'react'
import {  useParams } from "react-router-dom";
import axios from "axios";

const Confirm = () => {
    const { id } = useParams();
    // const [success, setSuccess] = React.useState(false);
    const [data, setData] = React.useState();
    console.log("id",id)
    useEffect(async() => {
        const { data } = await axios.get(`/api/users/confirm/${id}`);
        setData(data);
    }, [])

    return (
        <div>
            {data && (<h1>{ data.message}</h1>)}
        </div>
    )
}

export default Confirm
