import { Paper, Typography } from '@mui/material'
import React from 'react'

const NotesV2LeftCard = ( props ) => {
    return (
      <Paper
        key={props?.note?._id}
          onClick={() => props.handleNoteClick(props.note)}
          style={{
              padding: "10px",
              marginBottom: "10px",
              cursor: "pointer",
              backgroundColor: props.note.color,
              color: "#e8eaed",
          }}
      >
          <Typography variant="subtitle1" style={{ fontWeight: 600 }}>
              {props.note.title || "Untitled"}
          </Typography>
          <Typography variant="body2" style={{ color: "#ccc", overflow: "hidden" }}>
              {(props.note.content || "").replace(/<[^>]+>/g, "").slice(0, 100)}...
          </Typography>

      </Paper>
  )
}

export default NotesV2LeftCard