import React, { useEffect } from 'react'
import {  useParams } from "react-router-dom";
import axios from "axios";

const Confirm = () => {
    const { id } = useParams();
    console.log("id",id)
    useEffect(() => {
      const { data } = axios.get(`/api/users/confirm/${id}`);
    }, [])

    return (
        <div>
            Email Confirmed
        </div>
    )
}

export default Confirm
