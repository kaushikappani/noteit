import axios from 'axios';
import React, { useEffect, useState } from 'react'
import { Col, Form, Row, Button,Image } from 'react-bootstrap';
import { useHistory } from 'react-router';
import Header from '../components/Header'
import Loading from '../components/Loading';
import Mainscreen from '../components/Mainscreen';
import { CheckCircleFill,XCircleFill } from 'react-bootstrap-icons';
import "./profile.css"

const Profile = () => {
    const history = useHistory();
    const [user, setUser] = useState();
    const [update,setUpdate] = useState()
    const [error, setError] = useState();
    const [success, setSuccess] = useState();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState(null);

    const fetchUser = async () => {
        console.log("fetch user")
        try {
            const config = {
              withCredentials: true,
            };
            setLoading(true);
            const { data } = await axios.get("/api/users/info", config);
            setUser(data);
            setUpdate(data);
            setLoading(false)
        } catch (e) {
            setLoading(false)
            setError(e.response ? e.response.data.message : e.message)
            history.push("/")
        }
    }
    const submitHandler = async (e) => {
        e.preventDefault()
        try {
            const config = {
              withCredentials: true,
              headers: {
                "Content-Type": "application/json",
              },
            };
            setLoading(true);
            const { data } = await axios.put("/api/users/info", user, config);
          setSuccess(data.message)
          setLoading(false)
         
            setError(null)
        } catch (e) {
            setLoading(false)
            setSuccess(null);
            setError(e.response ? e.response.data.message : e.message)
        }
  }
  
  const sendVerificationLink = async (e) => {
    e.preventDefault();
    try {
      const config = {
        withCredentials: true,
        headers: {
          "Content-Type": "application/json",
        },
      };
      setLoading(true);
      const { data } = await axios.post("/api/users/verification/link", config);
      setSuccess(data.message)
      setLoading(false)
      setError(null)
    } catch (e) {
      setLoading(false)
      setSuccess(null);
      setError(e.response ? e.response.data.message : e.message)
    }
   

  }

  const handleImageChange = (e) => {
    const selectedFile = e.target.files[0];
    setImage(selectedFile);
  };

  const handleImageUpload = async () => {
    try {
      const formData = new FormData();
      formData.append('profilePicture', image);

      const config = {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      };

      setLoading(true);
      const { data } = await axios.post("api/users/upload/profile/pic", formData, config);
      setLoading(false);
      setSuccess("Profile picture uploaded successfully");
      setError(null);
      setImage(null);
      fetchUser();
    } catch (e) {
      setLoading(false);
      setSuccess(null);
      setError(e.response ? e.response.data.message : e.message);
    }
  };
    useEffect(() => {
        fetchUser();
        //eslint-disable-next-line
    }, [])
    return (
      <>
        <Header user={update} />
        <Mainscreen title="Profile">
          {user && (
            <div>
              <Row
                style={{
                  maxWidth: "500px",
                  position: "relative",
                  margin: "auto",
                }}
                className="profileContainer"
              >
              
                <Col md={12}>

                  <label htmlFor="profileImage" style={{ position: "relative" }}>
                    <Image
                      src={user.pic}
                      style={{ width: "250px", cursor: "pointer" }}
                      rounded
                    />
                    <input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display : "none" }}
                    />
                  </label>
                  {user && user.pic == "" && (
                    <input
                      id="profileImage"
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      style={{ display: "block" }}
                    />
                  )}
                  {image && <Button onClick={handleImageUpload}>Upload Profile Pic</Button>}

                   {success && <p className="text-success">{success}</p>}
                  <Form onSubmit={submitHandler}>
                    {loading && <Loading />}
                    {error && <p className="text-danger">{error}</p>}
                    <Form.Group controlId="name">
                      <Form.Label>Name</Form.Label>
                      <Form.Control
                        type="text"
                        placeholder="Enter Name"
                        value={user.name}
                        onChange={(e) =>
                          setUser((prev) => {
                            return { ...prev, name: e.target.value };
                          })
                        }
                      ></Form.Control>
                    </Form.Group>
                    <Form.Group controlId="email">
                      <Form.Label>Email Address</Form.Label>
                      <Form.Control
                        type="email"
                        placeholder="Enter Email"
                        value={user.email}
                        readOnly
                        onChange={(e) =>
                          setUser((prev) => {
                            return { ...prev, email: e.target.value };
                          })
                        }
                      ></Form.Control>
                    </Form.Group>
                    <Form.Group controlId="password">
                      <Form.Label>Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Enter Password"
                        value={user.password}
                        onChange={(e) =>
                          setUser((prev) => {
                            return { ...prev, password: e.target.value };
                          })
                        }
                      ></Form.Control>
                    </Form.Group>
                    <Form.Group controlId="confirmPassword">
                      <Form.Label>Confirm Password</Form.Label>
                      <Form.Control
                        type="password"
                        placeholder="Confirm Password"
                        value={user.confirmPassword}
                        onChange={(e) =>
                          setUser((prev) => {
                            return { ...prev, conformPassword: e.target.value };
                          })
                        }
                      ></Form.Control>
                    </Form.Group>{" "}

                    {user && user.verified == true && (<p> <CheckCircleFill color='green' /> Profile verified</p>)}
                    {user && user.verified == false && (<p> <XCircleFill color='red' /> Profile Not Verified Click here to send verification Link <Button onClick={sendVerificationLink} varient="primary">
                      Send
                    </Button></p>)}

                    <Button type="submit" varient="primary">
                      Update
                    </Button>
                  </Form>
                </Col>
              </Row>
            </div>
          )}
        </Mainscreen>
      </>
    );
}

export default Profile
