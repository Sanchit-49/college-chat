require("dotenv").config();
const express = require("express");
const cors = require("cors");
const http = require("http");
const jwt = require("jsonwebtoken");
const { createClient } = require("@supabase/supabase-js");
const { Server } = require("socket.io");

const app = express();

app.use(cors());
app.use(express.json());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// =========================
// ADMIN SETTINGS
// =========================

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "collegechat123";
const JWT_SECRET = "collegechat_secret_2026";

// =========================
// SUPABASE
// =========================

const supabase = createClient(
  "https://gitsamqnaevgnnvxjwoc.supabase.co",
  process.env.SUPABASE_SECRET_KEY
);

// =========================
// ADMIN LOGIN
// =========================

app.post("/admin/login", (req, res) => {
  const { username, password } = req.body;

  if (
    username !== ADMIN_USERNAME ||
    password !== ADMIN_PASSWORD
  ) {
    return res.status(401).json({
      message: "Invalid username or password",
    });
  }

  const token = jwt.sign(
    { username: ADMIN_USERNAME },
    JWT_SECRET,
    { expiresIn: "2h" }
  );

  res.json({ token });
});

// =========================
// ADMIN AUTH
// =========================

function verifyAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({
        message: "Unauthorized",
      });
    }

    const token = authHeader.split(" ")[1];

    jwt.verify(token, JWT_SECRET);

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired token",
    });
  }
}

// =========================
// GET ALL MESSAGES
// =========================

app.get("/admin/messages", verifyAdmin, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .order("time", { ascending: false })
      .limit(1000);

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.log("Load messages error:", error.message);

    res.status(500).json({
      message: "Failed to load messages",
    });
  }
});

// =========================
// DELETE MESSAGE
// =========================

app.delete(
  "/admin/messages/:id",
  verifyAdmin,
  async (req, res) => {
    try {
      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", req.params.id);

      if (error) throw error;

      res.json({
        message: "Message deleted",
      });
    } catch (error) {
      console.log("Delete error:", error.message);

      res.status(500).json({
        message: "Delete failed",
      });
    }
  }
);

// =========================
// ONLINE USERS / MATCHING
// =========================

let waitingUsers = [];
let matchedUsers = {};
let recentPartners = {};
let waitingTimers = {};

// =========================
// SOCKET CONNECTION
// =========================

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // JOIN
  socket.on("join", (user) => {
    socket.user = user;

    if (!recentPartners[socket.id]) {
      recentPartners[socket.id] = new Set();
    }

    console.log("User joined:", user.username);

    socket.emit("joined", user);
  });

  // FIND SOMEONE
  socket.on("findSomeone", () => {
    findMatch(socket);
  });

  // NEXT
  socket.on("next", () => {
    const oldPartnerId = matchedUsers[socket.id];

    clearWaitingTimer(socket.id);

    if (oldPartnerId) {
      recentPartners[socket.id]?.add(oldPartnerId);
      recentPartners[oldPartnerId]?.add(socket.id);

      delete matchedUsers[socket.id];
      delete matchedUsers[oldPartnerId];

      waitingUsers = waitingUsers.filter(
        (user) =>
          user.socketId !== socket.id &&
          user.socketId !== oldPartnerId
      );

      const oldPartnerSocket =
        io.sockets.sockets.get(oldPartnerId);

      if (oldPartnerSocket?.user) {
        waitingUsers.push({
          socketId: oldPartnerId,
          user: oldPartnerSocket.user,
        });

        io.to(oldPartnerId).emit("partnerLeft");
        io.to(oldPartnerId).emit("waiting");

        console.log(
          "Added previous partner to waiting:",
          oldPartnerSocket.user.username
        );
      }
    }

    findMatch(socket);
  });

  // TYPING
  socket.on("typing", () => {
    const partnerId = matchedUsers[socket.id];

    if (partnerId) {
      io.to(partnerId).emit("partnerTyping");
    }
  });

  // STOP TYPING
  socket.on("stopTyping", () => {
    const partnerId = matchedUsers[socket.id];

    if (partnerId) {
      io.to(partnerId).emit("partnerStoppedTyping");
    }
  });

  // SEND MESSAGE
  socket.on("sendMessage", async (message) => {
    const partnerId = matchedUsers[socket.id];

    if (!partnerId || !socket.user) return;

    const text = message.text?.trim();

    if (!text || text.length > 500) return;

    const partner = io.sockets.sockets.get(partnerId);

    if (!partner?.user) return;

    const newMessage = {
      sender: socket.user.username,
      receiver: partner.user.username,
      text: text,
      time: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert([newMessage])
        .select()
        .single();

      if (error) throw error;

      console.log(
        `[MESSAGE] ${newMessage.sender} -> ${newMessage.receiver}: ${text}`
      );

      io.to(socket.id).emit(
        "receiveMessage",
        data
      );

      io.to(partnerId).emit(
        "receiveMessage",
        data
      );
    } catch (error) {
      console.log(
        "Message save error:",
        error.message
      );
    }
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    clearWaitingTimer(socket.id);

    waitingUsers = waitingUsers.filter(
      (user) => user.socketId !== socket.id
    );

    const partnerId = matchedUsers[socket.id];

    if (partnerId) {
      delete matchedUsers[socket.id];
      delete matchedUsers[partnerId];

      io.to(partnerId).emit("partnerLeft");
    }

    delete recentPartners[socket.id];
    delete waitingTimers[socket.id];

    console.log(
      "User disconnected:",
      socket.id
    );
  });
});

// =========================
// MATCH FUNCTION
// =========================

function findMatch(socket, allowRecent = false) {
  if (!socket.user) return;

  waitingUsers = waitingUsers.filter(
    (user) => user.socketId !== socket.id
  );

  if (matchedUsers[socket.id]) {
    return;
  }

  const availableUsers = waitingUsers.filter(
    (user) => {
      const alreadyTalked =
        recentPartners[socket.id]?.has(
          user.socketId
        );

      return (
        user.socketId !== socket.id &&
        !alreadyTalked
      );
    }
  );

  if (availableUsers.length > 0) {
    clearWaitingTimer(socket.id);

    const randomIndex = Math.floor(
      Math.random() * availableUsers.length
    );

    const opponent =
      availableUsers[randomIndex];

    waitingUsers = waitingUsers.filter(
      (user) =>
        user.socketId !== opponent.socketId &&
        user.socketId !== socket.id
    );

    matchedUsers[socket.id] =
      opponent.socketId;

    matchedUsers[opponent.socketId] =
      socket.id;

    recentPartners[socket.id]?.add(
      opponent.socketId
    );

    recentPartners[opponent.socketId]?.add(
      socket.id
    );

    io.to(socket.id).emit(
      "matched",
      opponent.user
    );

    io.to(opponent.socketId).emit(
      "matched",
      socket.user
    );

    console.log(
      "Matched:",
      socket.user.username,
      "with",
      opponent.user.username
    );

    return;
  }

  if (allowRecent) {
    const fallbackUsers =
      waitingUsers.filter(
        (user) =>
          user.socketId !== socket.id
      );

    if (fallbackUsers.length > 0) {
      clearWaitingTimer(socket.id);

      const randomIndex = Math.floor(
        Math.random() *
          fallbackUsers.length
      );

      const opponent =
        fallbackUsers[randomIndex];

      waitingUsers = waitingUsers.filter(
        (user) =>
          user.socketId !== opponent.socketId &&
          user.socketId !== socket.id
      );

      matchedUsers[socket.id] =
        opponent.socketId;

      matchedUsers[opponent.socketId] =
        socket.id;

      recentPartners[socket.id]?.add(
        opponent.socketId
      );

      recentPartners[opponent.socketId]?.add(
        socket.id
      );

      io.to(socket.id).emit(
        "matched",
        opponent.user
      );

      io.to(opponent.socketId).emit(
        "matched",
        socket.user
      );

      console.log(
        "Fallback rematch:",
        socket.user.username,
        "with",
        opponent.user.username
      );

      return;
    }
  }

  waitingUsers.push({
    socketId: socket.id,
    user: socket.user,
  });

  socket.emit("waiting");

  console.log(
    "Waiting:",
    socket.user.username
  );

  clearWaitingTimer(socket.id);

  waitingTimers[socket.id] = setTimeout(() => {
    if (
      !matchedUsers[socket.id] &&
      waitingUsers.some(
        (user) =>
          user.socketId === socket.id
      )
    ) {
      console.log(
        "No new person found. Allowing previous partner:",
        socket.user.username
      );

      findMatch(socket, true);
    }

    delete waitingTimers[socket.id];
  }, 3000);
}

// =========================
// CLEAR WAITING TIMER
// =========================

function clearWaitingTimer(socketId) {
  if (waitingTimers[socketId]) {
    clearTimeout(waitingTimers[socketId]);
    delete waitingTimers[socketId];
  }
}

// =========================
// START SERVER
// =========================

server.listen(process.env.PORT || 5000, () => {
  console.log(
    "Server running on port 5000"
  );
});