import React, { useEffect, useState } from "react";
import axios from "axios";
import { Card, Button, Modal, Form, ListGroup } from "react-bootstrap";
import { PlusCircle } from "react-bootstrap-icons";


import './css/Remainders.css'; // Import custom CSS

const RemindersCard = ({  }) => {
    const [reminders, setReminders] = useState([]);
    const [showModal, setShowModal] = useState(false);
    const [newReminder, setNewReminder] = useState({ description: "", date: "", time: "" });
    const fetchReminders = async () => {
        try {
            const { data } = await axios.get("/api/remainders"); // Correct endpoint for fetching reminders
            setReminders(data);
        } catch (error) {
            console.error("Error fetching reminders:", error);
        }
    };
    useEffect(() => {
        

        fetchReminders();
    }, []);

    const handleOpenModal = () => setShowModal(true);
    const handleCloseModal = () => setShowModal(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setNewReminder((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async () => {
        try {
            // Combine date and time into a single Date object
            const combinedDateTime = new Date(`${newReminder.date}T${newReminder.time}`);

            await axios.post("/api/remainders/add", {
                description: newReminder.description,
                date: combinedDateTime.getTime() // Send timestamp
            });
            setNewReminder({ description: "", date: "", time: "" });
            handleCloseModal();
            fetchReminders();
        } catch (error) {
            console.error("Error adding reminder:", error);
        }
    };

    return (
        <Card className="reminders-card shadow-sm rounded">
            <Card.Body>
                <div className="d-flex justify-content-between align-items-center mb-3">
                    <Card.Title className="mb-0">Reminders</Card.Title>
                    <Button
                        className="add-button btn-fab"
                        variant="primary"
                        onClick={handleOpenModal}
                    >
                    <PlusCircle />
                    </Button>
                </div>
                <ListGroup variant="flush">
                    {reminders.length > 0 ? (
                        reminders.map((reminder) => (
                            <ListGroup.Item className="reminder-item" key={reminder._id}>
                                <div className="reminder-content">
                                    <span>{reminder.description}</span>
                                    <small className="text-muted">
                                        {new Date(reminder.date).toLocaleString()}
                                    </small>
                                </div>
                            </ListGroup.Item>
                        ))
                    ) : (
                        <ListGroup.Item className="no-reminders">
                            No reminders available
                        </ListGroup.Item>
                    )}
                </ListGroup>
            </Card.Body>

            {/* Modal for Adding Reminders */}
            <Modal show={showModal} onHide={handleCloseModal} centered>
                <Modal.Header>
                    <Modal.Title>Add New Reminder</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group controlId="formDescription">
                            <Form.Label>Description</Form.Label>
                            <Form.Control
                                type="text"
                                name="description"
                                value={newReminder.description}
                                onChange={handleChange}
                                placeholder="Enter reminder description"
                                className="form-control-lg"
                            />
                        </Form.Group>
                        <Form.Group controlId="formDate" className="mt-3">
                            <Form.Label>Date</Form.Label>
                            <Form.Control
                                type="date"
                                name="date"
                                value={newReminder.date}
                                onChange={handleChange}
                                className="form-control-lg"
                            />
                        </Form.Group>
                        <Form.Group controlId="formTime" className="mt-3">
                            <Form.Label>Time</Form.Label>
                            <Form.Control
                                type="time"
                                name="time"
                                value={newReminder.time}
                                onChange={handleChange}
                                className="form-control-lg"
                            />
                        </Form.Group>
                    </Form>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={handleCloseModal}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSubmit}>
                        Add
                    </Button>
                </Modal.Footer>
            </Modal>
        </Card>
    );
};

export default RemindersCard;
