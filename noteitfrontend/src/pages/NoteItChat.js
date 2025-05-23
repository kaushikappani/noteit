import React, { useState, useRef, useEffect } from 'react';
import { Container, Form, Button } from 'react-bootstrap';
import { Box, Paper, Typography, CircularProgress } from '@mui/material';
import { ChatDots } from 'react-bootstrap-icons';
import axios from 'axios';
import Notification from '../components/Notification';

const ChatPage = (props) => {
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [messages, setMessages] = useState([
     
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const bottomRef = useRef(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const [alert, setAlert] = useState({
        open: false,
        type: "",
        message: "",
    });


    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = { role: 'user', content: input.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const response = await axios.post(
                '/gpt/ai/chat',
                { message: input.trim() },
                { withCredentials: true }
            );
            const aiResponse = { role: 'ai', content: response.data };
            setMessages(prev => [...prev, aiResponse]);
        } catch (err) {
            setMessages(prev => [
                ...prev,
                { role: 'ai', content: '<p>Error getting response from AI.</p>' }
            ]);
        } finally {
            setLoading(false);
        }
    };

    const handleAddNote = async (htmlContent) => {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const plainText = tempDiv.textContent || tempDiv.innerText || '';
        const title = plainText.substring(0, 30) + (plainText.length > 30 ? '...' : '');

        const payload = {
            title: "From AI Chat",
            content: htmlContent
        };

        const config = {
            headers: { 'Content-Type': 'application/json' },
            withCredentials: true
        };

        try {
            await axios.post(`/api/notes/create`, payload, config);
            setAlert({
                open: true,
                type: "success",
                message: "Note Added",
            });
            props.reload();
        } catch (error) {
            setAlert({
                open: true,
                type: "warning",
                message: error.response ? error.response.data.message : error.message,
            });
            console.error(error);
        }
    };

    return (
        <>
            {/* Floating Button */}
            <Notification alert={alert} setAlert={setAlert} />

            <div
                style={{
                    position: 'fixed',
                    bottom: '20px',
                    left: '20px',
                    zIndex: 1300,
                }}
            >
                <Button
                    variant="primary"
                    onClick={() => setIsChatOpen(prev => !prev)}
                    style={{
                        borderRadius: '50%',
                        width: '56px',
                        height: '56px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 0,
                        fontSize: '1.4rem',
                    }}
                >
                    <ChatDots />
                </Button>
            </div>

            {/* Chat Popup */}
            {isChatOpen && (
                <div
                    style={{
                        position: 'fixed',
                        bottom: '90px',
                        left: '20px',
                        width: '350px',
                        height: '500px',
                        zIndex: 1300,
                        backgroundColor: '#121212',
                        borderRadius: '10px',
                        boxShadow: '0 4px 10px rgba(0,0,0,0.5)',
                        overflow: 'hidden',
                        border: '1px solid #333',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    <Box sx={{
                        height: '100%',
                        display: 'flex',
                        flexDirection: 'column',
                        backgroundColor: '#121212',
                        color: '#ffffff',
                    }}>
                        <Container fluid className="py-3" style={{ flex: 1, overflowY: 'auto', height: "100%", position: 'relative' }}>
                            {messages.map((msg, idx) => (
                                <Box
                                    key={idx}
                                    display="flex"
                                    justifyContent={msg.role === 'user' ? 'flex-end' : 'flex-start'}
                                    my={1}
                                >
                                    <Paper
                                        elevation={3}
                                        sx={{
                                            padding: '10px 15px',
                                            backgroundColor: msg.role === 'user' ? '#1e88e5' : '#2c2c2c',
                                            color: msg.role === 'user' ? '#fff' : '#e0e0e0',
                                            borderRadius: '16px',
                                            maxWidth: '75%',
                                            overflowX: 'auto',
                                        }}
                                    >
                                        {msg.role === 'ai' ? (
                                            <Box>
                                                <Typography
                                                    component="div"
                                                    sx={{
                                                        '& table': {
                                                            width: '100%',
                                                            color: '#e0e0e0',
                                                            borderCollapse: 'collapse'
                                                        },
                                                        '& th, & td': {
                                                            border: '1px solid #555',
                                                            padding: '8px'
                                                        }
                                                    }}
                                                    dangerouslySetInnerHTML={{ __html: msg.content }}
                                                />
                                                <Button
                                                    size="sm"
                                                    variant="outline-light"
                                                    onClick={() => handleAddNote(msg.content)}
                                                    style={{ marginTop: '5px' }}
                                                >
                                                    + Add Note
                                                </Button>
                                            </Box>
                                        ) : (
                                            <Typography>{msg.content}</Typography>
                                        )}
                                    </Paper>
                                </Box>
                            ))}
                            {loading && (
                                <Box display="flex" justifyContent="center" mt={2}>
                                    <CircularProgress size={24} sx={{ color: '#90caf9' }} />
                                </Box>
                            )}
                            <div ref={bottomRef} />
                        </Container>

                        <Box
                            sx={{
                                borderTop: '1px solid #333',
                                padding: '10px',
                                backgroundColor: '#1e1e1e',
                            }}
                        >
                            <Form onSubmit={handleSend} className="d-flex gap-2">
                                <Form.Control
                                    type="text"
                                    placeholder="Send a message..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    style={{ backgroundColor: '#2c2c2c', color: '#fff', border: '1px solid #555' }}
                                />
                                <Button type="submit" variant="primary">Send</Button>
                            </Form>
                        </Box>
                    </Box>
                </div>
            )}
        </>
    );
};

export default ChatPage;
