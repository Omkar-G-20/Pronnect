// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createServer } = require("http");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { parse } = require("url");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const next = require("next");
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Server } = require("socket.io");

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXTAUTH_URL || "http://localhost:3000",
      methods: ["GET", "POST"],
    },
  });

  // Store connected users: socketId -> { userId, userName }
  const connectedUsers = new Map();

  io.on("connection", (socket) => {
    console.log("[Socket.IO] Client connected:", socket.id);

    // Authenticate
    socket.on("authenticate", ({ userId, userName }) => {
      connectedUsers.set(socket.id, { userId, userName });
      socket.data.userId = userId;
      socket.data.userName = userName;
    });

    // Join project room
    socket.on("join-project", (projectId) => {
      socket.join(`project:${projectId}`);
      console.log(`[Socket.IO] ${socket.data.userName} joined project:${projectId}`);
    });

    // Leave project room
    socket.on("leave-project", (projectId) => {
      socket.leave(`project:${projectId}`);
    });

    // Join global chat
    socket.on("join-global", () => {
      socket.join("global");
    });

    // Project chat message
    socket.on("project-message", (data) => {
      const { projectId, message } = data;
      io.to(`project:${projectId}`).emit("new-project-message", message);
    });

    // Global chat message
    socket.on("global-message", (message) => {
      io.to("global").emit("new-global-message", message);
    });

    // Poll update (vote)
    socket.on("poll-update", (data) => {
      const { projectId, poll } = data;
      io.to(`project:${projectId}`).emit("poll-updated", poll);
    });

    // Task update
    socket.on("task-update", (data) => {
      const { projectId, task } = data;
      io.to(`project:${projectId}`).emit("task-updated", task);
    });

    // Typing indicator
    socket.on("typing", (data) => {
      const { room, projectId } = data;
      if (room === "global") {
        socket.to("global").emit("user-typing", {
          userId: socket.data.userId,
          userName: socket.data.userName,
        });
      } else if (projectId) {
        socket.to(`project:${projectId}`).emit("user-typing", {
          userId: socket.data.userId,
          userName: socket.data.userName,
        });
      }
    });

    socket.on("disconnect", () => {
      connectedUsers.delete(socket.id);
      console.log("[Socket.IO] Client disconnected:", socket.id);
    });
  });

  // Expose io globally for API routes
  global.io = io;

  httpServer.listen(port, () => {
    console.log(`> Pronnect ready on http://${hostname}:${port}`);
  });
});
