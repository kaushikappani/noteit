import { Paper, Typography, IconButton, Tooltip } from '@mui/material';
import React, { useState } from 'react';
import { Pin, PinAngle, Archive } from 'react-bootstrap-icons';
import axios from 'axios';

const NotesV2LeftCard = ({ note, handleNoteClick, setLoading, fetchNotes, setNotes }) => {
    const [hover, setHover] = useState(false);
    const colors = [
        { code: '#5c2b29', name: 'Red' },
        { code: '#345920', name: 'Green' },
        { code: '#614a19', name: 'Brown' },
    ];

    const updateNoteField = (id, updatedFields) => {
        setNotes(prev =>
            prev.map(n => (n._id === id ? { ...n, ...updatedFields } : n))
        );
    };

    const pinNote = async (id) => {
        updateNoteField(id, { pinned: !note.pinned }); // Optimistic toggle
        try {
            const config = { withCredentials: true };
            await axios.put(`/api/notes/${id}`, { pinned: true }, config);
            await fetchNotes();
        } catch (e) {
            console.error("Failed to pin/unpin note", e);
        }
    };

    const noteArchive = async (id) => {
        try {
            const config = { withCredentials: true };
            await axios.put(`/api/notes/${id}`, { archived: true }, config);
            await fetchNotes();
        } catch (e) {
            console.error("Failed to archive note", e);
        }
    };

    const changeColor = async (color) => {
        updateNoteField(note._id, { color }); // Optimistic color update
        try {
            const config = { withCredentials: true };
            await axios.put(`/api/notes/${note._id}`, { color }, config);
            await fetchNotes();
        } catch (e) {
            console.error("Failed to update color", e);
        }
    };

    return (
        <Paper
            key={note?._id}
            onClick={() => handleNoteClick(note)}
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '10px',
                cursor: 'pointer',
                backgroundColor: note.color,
                color: '#e8eaed',
                position: 'relative',
                transition: 'background-color 0.3s ease',
            }}
        >
            
            {hover && (
                <IconButton
                    onClick={(e) => {
                        e.stopPropagation();
                        pinNote(note._id);
                    }}
                    size="small"
                    sx={{
                        position: 'absolute',
                        top: 4,
                        right: 4,
                        color: 'white',
                        backgroundColor: 'rgba(0,0,0,0.3)',
                        '&:hover': {
                            backgroundColor: 'rgba(0,0,0,0.5)',
                        },
                    }}
                >
                    {note.pinned ? <Pin /> : <PinAngle />}
                </IconButton>
            )}

            {hover && (
                <div
                    style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        display: 'flex',
                        gap: '8px',
                        zIndex: 1,
                        padding: '4px',
                    }}
                    onClick={(e) => e.stopPropagation()}
                >
                    {colors.map(({ code, name }) => (
                        <Tooltip key={code} title={`Set ${name}`} arrow>
                            <div
                                onClick={() => changeColor(code)}
                                style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    backgroundColor: code,
                                    border: '1px solid white',
                                    cursor: 'pointer',
                                }}
                            />
                        </Tooltip>
                    ))}

                    <Archive
                        onClick={() => noteArchive(note._id)}
                        style={{
                            width: 20,
                            height: 20,
                            marginLeft: 5,
                            cursor: 'pointer',
                        }}
                    />
                </div>
            )}

            <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
                {note.title || 'Untitled'}
            </Typography>
            <Typography variant="body2" style={{ color: '#ccc', overflow: 'hidden' }}>
                {(note.content || '').replace(/<[^>]+>/g, '').slice(0, 100)}...
            </Typography>
        </Paper>
    );
};


export default NotesV2LeftCard;
