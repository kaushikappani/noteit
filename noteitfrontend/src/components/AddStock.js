import React, { useEffect, useState } from 'react'
import Box from "@mui/material/Box";
import Modal from "@mui/material/Modal";
import { Button, Form } from 'react-bootstrap';
import axios from 'axios';
import Notification from './Notification';

const AddStock = ({ fetchPortfolio, children }) => {
    const [open, setOpen] = useState(false);
    const [stock, addStock] = useState({
        symbol: "",
        quantity: "",
        price: "",
        purchaseDate: "",
        comments:""
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState();
    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: ""
    })
    const style = {
        position: "absolute",
        top: "40%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: "100%",
        maxWidth: "500px",
        maxHeight: "100vh",
        borderRadius: "0%",
        zIndex: 100,
        border: "0px",
        backgroundColor: "#222",
        padding: "20px"
    };

    const handleOpen = () => setOpen(true);
    const handleClose = async () => {
        setOpen(false);
    };
    const submitHandler = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const config = {
                withCredentials: true,
                headers: {
                    "Content-Type": "application/json",
                },
            };

            const { data } = await axios.post("/api/stock/v2/portfolio/add", stock, config);

            setLoading(false);
            setOpen(false);
            addStock({
                symbol: "",
                quantity: "",
                price: "",
                purchaseDate: new Date().toISOString().split("T")[0],
                comments: ""
            })
            setAlert({
                open: true,
                type: "success",
                message: "Transaction - Added"
            })
            fetchPortfolio();
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
            const { data } = await axios.post("/api/stock/v2/portfolio/add", stock, config);

            setLoading(false);
            addStock({
                symbol: "",
                quantity: "",
                price: "",
                purchaseDate: new Date().toISOString().split("T")[0],
                comments: ""
            })
            fetchPortfolio();
        } catch (e) {
            console.log("failed");
            setError(e.response ? e.response.data.message : e.message);
            setLoading(false);
        }
    }

    const [symbolOptions, setSymbolOptions] = useState([]);
    const [filteredSymbols, setFilteredSymbols] = useState([]);

    useEffect(() => {
        const today = new Date().toISOString().split("T")[0];
        addStock((prev) => ({ ...prev, purchaseDate: today }));

        const fetchSymbols = async () => {
            try {
                const { data } = await axios.get("/api/stock/all");
                setSymbolOptions(data); // Assuming API returns an array of strings
            } catch (error) {
                console.error("Error fetching stock symbols:", error);
            }
        };
        fetchSymbols();

    }, [])

    const handleSymbolSearch = (input) => {
        const filtered = symbolOptions.filter((symbol) =>
            symbol.toLowerCase().includes(input.toLowerCase())
        );
        setFilteredSymbols(filtered);
    };
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
                        {/* Symbol Field with Smart Search */}
                        <Form.Group controlId="formSymbol" className="mb-3">
                            <Form.Label>Symbol</Form.Label>
                            <Form.Control
                                type="text"
                                value={stock.symbol}
                                placeholder="Enter or search symbol"
                                onChange={(e) => {
                                    const value = e.target.value;
                                    addStock((prev) => ({ ...prev, symbol: value }));
                                    handleSymbolSearch(value);
                                }}
                                required
                            />
                            {filteredSymbols.length > 0 && (
                                <ul style={{
                                    // maxHeight: "150px",
                                    overflowY: "auto",
                                    position: "absolute",
                                    background: "#fff",
                                    zIndex: 1050,
                                    width: "90%",
                                    boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                                    borderRadius: "4px",
                                    marginTop: "2px",
                                }} className="list-group">
                                    {filteredSymbols.map((symbol, index) => (
                                        <li
                                            key={index}
                                            className="list-group-item"
                                            onClick={() => {
                                                addStock((prev) => ({ ...prev, symbol }));
                                                setFilteredSymbols([]); // Clear dropdown on selection
                                            }}
                                            style={{ cursor: "pointer" }}
                                        >
                                            {symbol}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Form.Group>

                        {/* Quantity Field */}
                        <Form.Group controlId="quantity" className="mb-3">
                            <Form.Label>Quantity</Form.Label>
                            <Form.Control
                                type="number"
                                value={stock.quantity}
                                placeholder="Enter quantity"
                                onChange={(e) =>
                                    addStock((prev) => ({ ...prev, quantity: e.target.value }))
                                }
                                required
                            />
                        </Form.Group>

                        {/* Price Field */}
                        <Form.Group controlId="price" className="mb-3">
                            <Form.Label>Price</Form.Label>
                            <Form.Control
                                type="number"
                                value={stock.price}
                                placeholder="Enter price"
                                onChange={(e) =>
                                    addStock((prev) => ({ ...prev, price: e.target.value }))
                                }
                                required
                            />
                        </Form.Group>

                        {/* Purchase Date Field */}
                        <Form.Group controlId="purchaseDate" className="mb-3">
                            <Form.Label>Purchase Date</Form.Label>
                            <Form.Control
                                type="date"
                                value={stock.purchaseDate}
                                onChange={(e) =>
                                    addStock((prev) => ({
                                        ...prev,
                                        purchaseDate: e.target.value,
                                    }))
                                }
                                required
                            />
                        </Form.Group>

                        {/* Comments Field */}
                        <Form.Group controlId="comments" className="mb-3">
                            <Form.Label>Comments</Form.Label>
                            <Form.Control
                                as="textarea"
                                rows={3}
                                value={stock.comments}
                                placeholder="Add comments (optional)"
                                onChange={(e) =>
                                    addStock((prev) => ({ ...prev, comments: e.target.value }))
                                }
                            />
                        </Form.Group>

                        {/* Submit Buttons */}
                        <Button disabled={loading} variant="primary" type="submit">
                            Save
                        </Button>
                        <Button onClick={saveAndAddOther} variant="secondary">
                            Save & Add Another
                        </Button>
                    </Form>
                </Box>

            </Modal>
        </div>
    )
}

export default AddStock