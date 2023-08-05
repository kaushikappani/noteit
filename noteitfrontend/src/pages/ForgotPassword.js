import axios from "axios";
import React, { useEffect, useState } from "react";
import { Container, Form, Row } from "react-bootstrap";
import { Link } from "react-router-dom";
import Loading from "../components/Loading";
import "./page.css";
import Header from "../components/Header";

const ForgotPassword = () => {
  const [data, setData] = useState();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState();
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const config = {
      withCredentials: true,
      headers: {
        "Content-Type": "application/json",
      },
    };
    const { data } = await axios.post("/api/users/forgotpassword", { email }, config);
    console.log(data);
    setData(data);
    } catch (err) {
      console.log(err);
      setLoading(false);
    }
    setLoading(false);
  };
  return (
    <>
      <Header paage="landing" />
      <Container className="pagecontainer">
        <Row>
          <div className="col-lg-6" style={{}}>
            <h1
              style={{ fontSize: "8vh", fontFamily: "Poppins, sans-serif" }}
              className="text-primary"
            >
              NoteIt
            </h1>
            <p
              style={{
                fontSize: "3vh",
                fontFamily: "Poppins, sans-serif",
                fontWeight: "lighter",
              }}
            >
              Note It helps to save and sync all your notes at one place
            </p>
          </div>
          <div
            className="col-lg-6"
            style={{
              fontFamily: "Poppins, sans-serif",
              justifyContent: "center",
            }}
          >
            <Form onSubmit={handleSubmit}>
              <div className="form-group">
                <div className="form-floating mb-3">
                  <input
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value)
                    }}
                    type="email"
                    className="form-control"
                    id="floatingInput"
                    placeholder="name@example.com"
                    required
                  />
                  <label htmlFor="floatingInput">Email address</label>
                </div>
                {data && (
                  <p
                    className="text-success"
                    style={{ justifyContent: "right", textAlign: "center" }}
                  >
                    {data.message}
                  </p>
                )}
                <div className="d-grid mb-5">
                  <button className="btn btn-lg btn-primary" type="submit">
                    {" "}
                    {loading ? <Loading /> : "Get Password Change Link"}
                  </button>
                </div>
                
                
              </div>
            </Form>
          </div>
        </Row>
      </Container>
    </>
  );
};

export default ForgotPassword;
