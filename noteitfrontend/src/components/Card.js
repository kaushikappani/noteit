import React from 'react'
import { Button } from 'react-bootstrap';
import { PencilSquare } from 'react-bootstrap-icons';
import ReactMarkdown from "react-markdown";

const Card = (p) => {
    return (
        <div className="card border-primary mb-3" >
            <div className="card-header">{p.title}
                <div style={{ float: "right" }}>
                    <Button href={`/note/${p.id}`} variant="outline-primiary"><PencilSquare /> Edit</Button>

                </div>
            </div>

            <div className="card-body">
                <span className="badge bg-secondary">Category - {p.category}</span>
                <ReactMarkdown>{p.content}</ReactMarkdown>
                <p className="blockquote-footer"> Created on - {p.createdAt.substring(0, 10)}</p>
            </div>
        </div>
    )
}

export default Card
