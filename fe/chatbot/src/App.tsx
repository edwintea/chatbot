import React, { useState, useEffect, useRef, FormEvent } from "react";
import { FaComments, FaImage, FaVideo } from "react-icons/fa";
import "./App.css";

type MessageType = "user" | "bot" | "error";

interface ChatMessage {
  type: MessageType;
  text: string;
  model?: string;
  mediaUrl?: string;
}

function App() {
  const [input, setInput] = useState<string>("");
  const [model, setModel] = useState<"chat" | "image" | "video">("chat");
  const [chatLog, setChatLog] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("chatLog");
    if (saved) setChatLog(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("chatLog", JSON.stringify(chatLog));
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatLog]);

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage: ChatMessage = { type: "user", text: input };
    setChatLog((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_message: input, model }),
      });

      if (!res.ok) throw new Error("Network response was not ok");

      const data = await res.json();

      let botMessage: ChatMessage;
      if (model === "chat") {
        botMessage = { type: "bot", text: data.bot_response, model };
      } else if (model === "image") {
        botMessage = {
          type: "bot",
          text: "Image generated:",
          model,
          mediaUrl: data.media_url,
        };
      } else if (model === "video") {
        botMessage = {
          type: "bot",
          text: "Video generated:",
          model,
          mediaUrl: data.media_url,
        };
      } else {
        botMessage = { type: "bot", text: "Unknown model response", model };
      }

      setChatLog((prev) => [...prev, botMessage]);
    } catch (error) {
      setChatLog((prev) => [
        ...prev,
        { type: "error", text: "Error: Could not get response." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      {loading && (
        <div className="loading-overlay" aria-label="Loading">
          <div className="spinner" />
        </div>
      )}
      <header className="app-header">Edwin's Chat</header>
      <div className="chat-area-wrapper">
        <div className="chat-window">
          {chatLog.map((msg, idx) => (
            <div key={idx} className={`chat-message ${msg.type}`}>
              <div>{msg.text}</div>
              {msg.model === "image" && msg.mediaUrl && (
                <img
                  src={msg.mediaUrl}
                  alt="Generated"
                  style={{ maxWidth: "300px", marginTop: "0.5rem" }}
                />
              )}
              {msg.model === "video" && msg.mediaUrl && (
                <video
                  controls
                  autoPlay
                  muted
                  loop
                  style={{ maxWidth: "300px", marginTop: "0.5rem" }}
                >
                  <source src={msg.mediaUrl} type="video/mp4" />
                  Your browser does not support the video tag.
                </video>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
      <form className="input-form" onSubmit={sendMessage}>
        <div className="model-buttons">
          <button
            type="button"
            className={model === "chat" ? "active" : ""}
            onClick={() => !loading && setModel("chat")}
            disabled={loading}
            aria-label="Chat mode"
          >
            <FaComments />
            <span>Chat</span>
          </button>
          <button
            type="button"
            className={model === "image" ? "active" : ""}
            onClick={() => !loading && setModel("image")}
            disabled={loading}
            aria-label="Image generation mode"
          >
            <FaImage />
            <span>Image</span>
          </button>
          <button
            type="button"
            className={model === "video" ? "active" : ""}
            onClick={() => !loading && setModel("video")}
            disabled={loading}
            aria-label="Video generation mode"
          >
            <FaVideo />
            <span>Video</span>
          </button>
        </div>
        <div className="input-row">
          <input
            type="text"
            placeholder={
              model === "chat"
                ? "Type your message..."
                : model === "image"
                ? "Describe the image you want..."
                : "Describe the video you want..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            autoFocus
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? "..." : "Send"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default App;