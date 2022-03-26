import axios from "axios";
import React, { useEffect, useState } from "react";
import { Container, Form, Row } from "react-bootstrap";
import { Link,useParams } from "react-router-dom";
import Loading from "../components/Loading";
import "./page.css";
import Header from "../components/Header";

const PasswordReset = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(false);
    const [passwords, setPasswords] = useState({});
    const [data, setData] = useState();
    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const config = {
              withCredentials: true,
              headers: {
                "Content-Type": "application/json",
              },
            };
            const { data } = await axios.post("/api/users/resetpassword/" + id, passwords, config);
            setData(data);
        } catch (err) {
            
        }
    }
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
                    value={passwords.password}
                    onChange={(e) => {
                        setPasswords((prev) => {
                            return { ...prev, password:e.target.value};
                      })
                    }}
                    type="password"
                    className="form-control"
                    id="password1"
                    placeholder="name@example.com"
                    required
                  />
                  <input
                    value={passwords.conformpassword}
                    onChange={(e) => {
                        setPasswords((prev) => {
                         return {...prev,conformpassword:e.target.value}
                     })
                    }}
                    type="password"
                    className="form-control"
                    id="password2"
                    placeholder="name@example.com"
                    required
                  />
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
                    {loading ? <Loading /> : "Reset Password"}
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

export default PasswordReset;
