import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import Admin from "./Admin";
import "./App.css";

const socket = io("https://oxide-suites-reduce-entity.trycloudflare.com", {
  transports: ["websocket", "polling"],
});

function App() {
  // =========================
  // ADMIN PAGE
  // =========================

  if (window.location.pathname === "/admin") {
    return <Admin />;
  }

  // =========================
  // COLLEGE CHAT
  // =========================

  const [username, setUsername] = useState("");
  const [year, setYear] = useState("");
  const [joined, setJoined] = useState(false);
  const [searching, setSearching] = useState(false);
  const [matchedUser, setMatchedUser] = useState(null);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("SOCKET CONNECTED:", socket.id);
    });

    socket.on("connect_error", (error) => {
      console.log("SOCKET ERROR:", error.message);
    });

    socket.on("waiting", () => {
      setSearching(true);
      setMatchedUser(null);
      setMessages([]);
    });

    socket.on("matched", (user) => {
      setSearching(false);
      setMatchedUser(user);
      setMessages([]);
    });

    socket.on("receiveMessage", (newMessage) => {
      setMessages((prev) => [...prev, newMessage]);
    });

    socket.on("partnerLeft", () => {
      setMatchedUser(null);
      setSearching(false);
      setMessages([]);
      alert("The other person left the chat.");
    });

    return () => {
      socket.off("connect");
      socket.off("connect_error");
      socket.off("waiting");
      socket.off("matched");
      socket.off("receiveMessage");
      socket.off("partnerLeft");
    };
  }, []);

  const handleJoin = () => {
    if (!username.trim() || !year) {
      alert("Enter username and select year");
      return;
    }

    socket.emit("join", {
      username: username.trim(),
      year,
    });

    setJoined(true);
  };

  const findSomeone = () => {
    setSearching(true);
    setMatchedUser(null);
    setMessages([]);

    socket.emit("findSomeone");
  };

  const sendMessage = () => {
    if (!message.trim() || !matchedUser) return;

    socket.emit("sendMessage", {
      sender: username,
      text: message.trim(),
    });

    setMessage("");
  };

  const handleNext = () => {
    setMessages([]);
    setMatchedUser(null);
    setSearching(true);

    socket.emit("next");
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      sendMessage();
    }
  };

  // =========================
  // LANDING PAGE
  // =========================

  if (!joined) {
    return (
      <div className="app">
        <div className="glow glow-one"></div>
        <div className="glow glow-two"></div>

        <div className="landing">
          <div className="brand">
            <div className="brand-icon">✦</div>
            <span>
              College<span>Chat</span>
            </span>
          </div>

          <div className="hero">
            <div className="hero-badge">
              <span className="live-dot"></span>
              Made for campus conversations
            </div>

            <h1>
              Meet someone.
              <br />
              <span>Start a conversation.</span>
            </h1>

            <p className="hero-text">
              Connect with students from your college,
              discover new people and have a random conversation.
            </p>

            <div className="join-card">
              <div className="card-title">
                <span>👋</span>

                <div>
                  <h3>Let's get you in</h3>
                  <p>No complicated signup.</p>
                </div>
              </div>

              <label>USERNAME</label>

              <div className="input-box">
                <span>⌾</span>

                <input
                  type="text"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleJoin();
                  }}
                />
              </div>

              <label>YOUR YEAR</label>

              <div className="years">
                {["1st Year", "2nd Year", "3rd Year", "4th Year"].map(
                  (item) => (
                    <button
                      key={item}
                      className={year === item ? "year active" : "year"}
                      onClick={() => setYear(item)}
                    >
                      {item}
                    </button>
                  )
                )}
              </div>

              <button className="primary-btn" onClick={handleJoin}>
                Enter College Chat
                <span>→</span>
              </button>

              <p className="privacy">
                🔒 Your username is all you need to start.
              </p>
            </div>
          </div>

          <div className="features">
            <div>
              <span>⚡</span>
              <strong>Instant matching</strong>
              <small>Find someone online</small>
            </div>

            <div>
              <span>💬</span>
              <strong>Real-time chat</strong>
              <small>Talk without delay</small>
            </div>

            <div>
              <span>🎓</span>
              <strong>Campus only</strong>
              <small>Made for students</small>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================
  // CHAT PAGE
  // =========================

  return (
    <div className="app">
      <div className="chat-page">
        <header className="chat-header">
          <div className="brand small">
            <div className="brand-icon">✦</div>

            <span>
              College<span>Chat</span>
            </span>
          </div>

          <div className="your-profile">
            <div className="avatar">
              {username.charAt(0).toUpperCase()}
            </div>

            <div>
              <strong>{username}</strong>
              <small>{year}</small>
            </div>

            <span className="online-badge">
              <i></i> Online
            </span>
          </div>
        </header>

        <main className="chat-container">
          {!matchedUser && !searching && (
            <div className="welcome-panel">
              <div className="welcome-icon">✦</div>

              <span className="mini-label">YOU'RE IN</span>

              <h2>
                Ready to meet
                <br />
                <span>someone new?</span>
              </h2>

              <p>
                Find another student who's online right now
                and start a random conversation.
              </p>

              <button
                className="primary-btn find-btn"
                onClick={findSomeone}
              >
                <span>⚡</span>
                Find Someone
              </button>
            </div>
          )}

          {searching && (
            <div className="search-panel">
              <div className="radar">
                <div className="radar-ring ring-one"></div>
                <div className="radar-ring ring-two"></div>
                <div className="radar-ring ring-three"></div>
                <div className="radar-dot">✦</div>
              </div>

              <span className="mini-label">SEARCHING</span>

              <h2>Finding your next conversation...</h2>

              <p>
                Looking for another student who is online.
              </p>

              <div className="loading-line">
                <span></span>
              </div>
            </div>
          )}

          {matchedUser && (
            <div className="conversation">
              <div className="partner-card">
                <div className="partner-avatar">
                  {matchedUser.username.charAt(0).toUpperCase()}
                  <i></i>
                </div>

                <div>
                  <span className="mini-label">
                    CONNECTED WITH
                  </span>

                  <h3>{matchedUser.username}</h3>

                  <p>{matchedUser.year} · Online now</p>
                </div>

                <button
                  className="next-btn"
                  onClick={handleNext}
                >
                  Next →
                </button>
              </div>

              <div className="messages">
                {messages.length === 0 && (
                  <div className="conversation-start">
                    <div>👋</div>

                    <strong>
                      Say hello to {matchedUser.username}
                    </strong>

                    <span>
                      Start the conversation. Be nice :)
                    </span>
                  </div>
                )}

                {messages.map((msg, index) => (
                  <div
                    key={index}
                    className={
                      msg.sender === username
                        ? "message-row own"
                        : "message-row"
                    }
                  >
                    <div className="message-bubble">
                      <span>{msg.text}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="message-input-area">
                <input
                  type="text"
                  placeholder="Write something..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                />

                <button
                  className="send-btn"
                  onClick={sendMessage}
                >
                  ↑
                </button>
              </div>

              <button
                className="next-bottom"
                onClick={handleNext}
              >
                ↻ &nbsp; Find someone else
              </button>
            </div>
          )}
        </main>

        <footer>
          <span>CollegeChat</span>
          <span>•</span>
          <span>Have fun. Be respectful.</span>
        </footer>
      </div>
    </div>
  );
}

export default App;