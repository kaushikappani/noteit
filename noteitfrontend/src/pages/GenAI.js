import { useState } from "react";

const GenAI = () => {
    const [messages, setMessages] = useState([]); // Stores chat history
    const [input, setInput] = useState(""); // Stores user input
    const [isLoading, setIsLoading] = useState(false); // Track loading state

    const sendMessage = async () => {
        if (!input.trim()) return; // Prevent empty messages

        const userMessage = { role: "user", text: input };
        setMessages((prev) => [...prev, userMessage]); // Show user message immediately

        setInput("");
        setIsLoading(true);

        const response = await fetch("/gpt/ai/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: input }),
        });

        const reader = response.body.getReader();
        let aiResponse = "";

        // Add an empty AI message placeholder
        setMessages((prev) => [...prev, { role: "model", text: "" }]);

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = new TextDecoder().decode(value);
            aiResponse += chunk; // Append chunk to AI response

            // Update only the last AI message in real-time
            setMessages((prev) =>
                prev.map((msg, idx) =>
                    idx === prev.length - 1 ? { ...msg, text: aiResponse } : msg
                )
            );
        }

        setIsLoading(false);
    };

    return (
        <div className="chat-container">
            <div className="chat-box">
                {messages.map((msg, index) => (
                    <div key={index} className={`message ${msg.role}`}>
                        {msg.text}
                    </div>
                ))}
            </div>

            <div className="chat-input">
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type a message..."
                />
                <button onClick={sendMessage} disabled={isLoading}>
                    {isLoading ? "Thinking..." : "Send"}
                </button>
            </div>
        </div>
    );
};

export default GenAI;
