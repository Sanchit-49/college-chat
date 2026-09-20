import { useEffect, useState } from "react";

function Admin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState(
    localStorage.getItem("adminToken") || ""
  );

  const [messages, setMessages] = useState([]);
  const [error, setError] = useState("");

  // LOGIN
  const login = async (e) => {
    e.preventDefault();
    setError("");

    try {
      const response = await fetch(
        "https://college-chat-1.onrender.com",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            username,
            password,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || "Login failed");
        return;
      }

      localStorage.setItem("adminToken", data.token);
      setToken(data.token);
    } catch (err) {
      setError("Server connection failed");
    }
  };

  // LOAD MESSAGES
  const loadMessages = async () => {
    try {
      const response = await fetch(
        "https://college-chat-1.onrender.com",
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.status === 401) {
        logout();
        return;
      }

      const data = await response.json();
      setMessages(data);
    } catch (err) {
      setError("Could not load messages");
    }
  };

  // DELETE MESSAGE
  const deleteMessage = async (id) => {
    const confirmDelete = window.confirm(
      "Delete this message?"
    );

    if (!confirmDelete) return;

    try {
      await fetch(
        `https://college-chat-1.onrender.com/${id}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      loadMessages();
    } catch (err) {
      setError("Delete failed");
    }
  };

  // LOGOUT
  const logout = () => {
    localStorage.removeItem("adminToken");
    setToken("");
    setMessages([]);
  };

  useEffect(() => {
    if (token) {
      loadMessages();
    }
  }, [token]);

  // =========================
  // LOGIN SCREEN
  // =========================

  if (!token) {
    return (
      <div className="admin-page">
        <div className="admin-login-card">

          <div className="admin-logo">
            ✦
          </div>

          <div className="admin-title">
            <h1>CollegeChat</h1>
            <span>ADMIN</span>
          </div>

          <p className="admin-subtitle">
            Secure administration panel
          </p>

          <form onSubmit={login}>

            <label>USERNAME</label>

            <input
              type="text"
              placeholder="Admin username"
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />

            <label>PASSWORD</label>

            <input
              type="password"
              placeholder="Admin password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            {error && (
              <div className="admin-error">
                {error}
              </div>
            )}

            <button type="submit">
              Enter Admin Panel
              <span>→</span>
            </button>

          </form>

          <div className="admin-security">
            🔐 Protected access
          </div>

        </div>
      </div>
    );
  }

  // =========================
  // ADMIN DASHBOARD
  // =========================

  return (
    <div className="admin-page">

      <div className="admin-dashboard">

        {/* HEADER */}

        <header className="admin-header">

          <div className="admin-brand">

            <div className="admin-logo small">
              ✦
            </div>

            <div>
              <h1>CollegeChat</h1>
              <span>ADMIN PANEL</span>
            </div>

          </div>

          <div className="admin-actions">

            <button
              className="admin-refresh"
              onClick={loadMessages}
            >
              ↻ Refresh
            </button>

            <button
              className="admin-logout"
              onClick={logout}
            >
              Logout
            </button>

          </div>

        </header>

        {/* STATS */}

        <div className="admin-stats">

          <div className="admin-stat-card">
            <span>💬</span>
            <div>
              <small>TOTAL MESSAGES</small>
              <strong>{messages.length}</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <span>🗄️</span>
            <div>
              <small>DATABASE</small>
              <strong>Connected</strong>
            </div>
          </div>

          <div className="admin-stat-card">
            <span>🛡️</span>
            <div>
              <small>ACCESS</small>
              <strong>Admin</strong>
            </div>
          </div>

        </div>

        {/* MESSAGES */}

        <section className="admin-messages-card">

          <div className="admin-section-header">

            <div>
              <h2>Chat Messages</h2>
              <p>
                Stored conversations from CollegeChat
              </p>
            </div>

            <span className="message-count">
              {messages.length}
            </span>

          </div>

          {messages.length === 0 ? (

            <div className="admin-empty">
              <div>💬</div>
              <h3>No messages yet</h3>
              <p>
                Messages will appear here when students
                start chatting.
              </p>
            </div>

          ) : (

            <div className="admin-message-list">

              {messages.map((msg) => (

                <div
                  className="admin-message"
                  key={msg._id}
                >

                  <div className="admin-message-main">

                    <div className="admin-users">

                      <div className="admin-user-avatar">
                        {msg.sender
                          ?.charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {msg.sender}
                        </strong>

                        <span>→</span>

                        <strong>
                          {msg.receiver}
                        </strong>
                      </div>

                    </div>

                    <div className="admin-message-text">
                      {msg.text}
                    </div>

                    <small>
                      {new Date(
                        msg.time
                      ).toLocaleString()}
                    </small>

                  </div>

                  <button
                    className="admin-delete"
                    onClick={() =>
                      deleteMessage(msg._id)
                    }
                  >
                    Delete
                  </button>

                </div>

              ))}

            </div>

          )}

        </section>

      </div>

    </div>
  );
}

export default Admin;