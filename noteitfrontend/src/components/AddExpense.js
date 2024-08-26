import React, { useEffect, useState } from 'react'
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Form } from 'react-bootstrap';
import axios from 'axios';
import Notification from './Notification';
import { numberToWords } from './utils';

const AddExpense = ({ fetchExpenses,children}) => {
    const [open, setOpen] = useState(false);
    const [expense, setExpense] = useState({
        cost: "",
        category: "",
        description: "",
        date:""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [costInWords, setCostInWords] = useState("");
    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: ""
    })
    const style = {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",  // Increase width
        maxWidth: "500px",  // Increase max width
        maxHeight: "100vh",  // Increase max height
        borderRadius: "0%",
        zIndex: 100,
        border: "0px",
        backgroundColor: "#222",
        padding : "20px"
    };

    const handleOpen = () => setOpen(true);
    const handleClose = async () => {
        setOpen(false);
    };
    const submitHandler = async(e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                },
            };
            
            const { data } = await axios.post("/api/expenses/add", expense, config);
            
            setLoading(false);
            setOpen(false);
            setExpense({
                cost: "",
                category: "",
                description: "",
                date: new Date().toISOString().split("T")[0]
            })
            setAlert({
                open: true,
                type: "success",
                message: "Expense - Added"
            })
            fetchExpenses();
        } catch (e) {
            console.log("failed");
            setError(e.response ? e.response.data.message : e.message);
            setLoading(false);
        }
    }

    const saveAndAddOther = async () => {
        setLoading(true);

        try {
            const config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                },
            };
            //eslint-disable-next-line
            const { data } = await axios.post("/api/expenses/add", expense, config);

            setLoading(false);
            setExpense({
                cost: "",
                category: "",
                description: "",
                date: new Date().toISOString().split("T")[0]
            })
            fetchExpenses();
        } catch (e) {
            console.log("failed");
            setError(e.response ? e.response.data.message : e.message);
            setLoading(false);
        }
    }

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        setExpense((prev) => ({ ...prev, date: today })); 
    },[])
  return (
      <div>
          <Notification alert={alert} setAlert={setAlert} />

          <div onClick={handleOpen}>{children}</div>
          <Modal
              className="model"
              open={open}
              onClose={handleClose}
              aria-labelledby="modal-modal-title"
              aria-describedby="modal-modal-description"
          >

              <Box style={style}>
                  <Form onSubmit={submitHandler}>
                      {/* Cost Field */}
                      <Form.Group controlId="cost" className="mb-3">
                          <Form.Label>Cost</Form.Label>
                          <Form.Control
                              type="number"
                              value={expense.cost}
                              placeholder="Enter the cost"
                              onChange={(e) =>
                                  setExpense((prev) => {
                                      return { ...prev, cost: e.target.value };
                                  })
                              }
                              required
                          />
                      </Form.Group>
                      <p> {costInWords}</p>
                      {/* Category Field */}
                      <Form.Group controlId="formCategory" className="mb-3">
                          <Form.Label>Category</Form.Label>
                          <Form.Control
                              as="select"
                              name="category"
                              value={expense.category}
                              onChange={(e) =>
                                  setExpense((prev) => {
                                      return { ...prev, category: e.target.value };
                                  })
                              }
                              required
                          >
                              <option value="">Select Category</option>
                              <option value="Needs">Needs</option>
                              <option value="Wants">Wants</option>
                              <option value="Investments">Investments</option>
                              <option value="Food">Food</option>
                              <option value="Others">Others</option>
                          </Form.Control>
                      </Form.Group>

                      {/* Description Field */}
                      <Form.Group controlId="description" className="mb-3">
                          <Form.Label>Description</Form.Label>
                          <Form.Control
                              as="textarea"
                              rows={3}
                              value={expense.description}
                              placeholder="Enter a description"
                              onChange={(e) =>
                                  setExpense((prev) => {
                                      return { ...prev, description: e.target.value };
                                  })
                              }
                              required
                          />
                      </Form.Group>

                      <Form.Group controlId="date" className="mb-3">
                          <Form.Label>Date</Form.Label>
                          <Form.Control
                              type="date"
                              value={expense.date}
                              onChange={(e) =>
                                  setExpense((prev) => ({
                                      ...prev,
                                      date: e.target.value,
                                  }))
                              }
                              required
                          />
                      </Form.Group>

                      {/* Submit Button */}
                      <Button disabled={loading} variant="primary" type="submit">
                          Save
                      </Button>

                      <Button onClick = {saveAndAddOther} variant="secondry" >
                          Save & add another
                      </Button>
                  </Form>
              </Box>

          </Modal>
    </div>
  )
}

export default AddExpense