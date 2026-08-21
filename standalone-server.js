/**
 * Pronnect - Standalone Zero-NPM Full-Stack Server
 * Runs with 100% pure Node.js built-ins (http, crypto, fs, path, url)
 * No npm, no dependencies, no external downloads required!
 */

const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const url = require("url");

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "pronnect-local-data.json");
const ENCRYPTION_KEY_SECRET = "pronnect-standalone-secret-key-32b!";

// --- IN-MEMORY & PERSISTENT DATABASE ---
let db = {
  users: [],
  projects: [],
  members: [],
  joinRequests: [],
  tasks: [],
  polls: [],
  pollVotes: [],
  messages: [],
  media: [],
  notifications: [],
  sessions: {}, // token -> userId
};

// Load existing data
function loadDB() {
  if (fs.existsSync(DB_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      db = { ...db, ...data, sessions: {} };
    } catch (e) {
      console.error("Error loading local DB:", e);
    }
  } else {
    // Seed default sample data
    seedInitialData();
  }
}

function saveDB() {
  try {
    const toSave = { ...db, sessions: {} };
    fs.writeFileSync(DB_FILE, JSON.stringify(toSave, null, 2));
  } catch (e) {
    console.error("Error saving DB:", e);
  }
}

function seedInitialData() {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync("password123", salt, 1000, 64, "sha512").toString("hex");

  const user1 = {
    id: "user_alex",
    name: "Alex Rivera",
    email: "alex@example.com",
    salt,
    passwordHash: hash,
    school: "MIT",
    bio: "Full-stack AI developer & robotics enthusiast. Looking for collaborators on autonomous agents.",
    skills: ["AI/ML", "Web Dev", "Robotics", "Python", "React"],
    githubUrl: "https://github.com/alexrivera",
    createdAt: new Date().toISOString(),
  };

  const user2 = {
    id: "user_sarah",
    name: "Sarah Chen",
    email: "sarah@example.com",
    salt,
    passwordHash: hash,
    school: "Stanford",
    bio: "Computer Vision & Embedded Systems researcher.",
    skills: ["Computer Vision", "Embedded Systems", "C++", "IoT"],
    githubUrl: "https://github.com/sarahchen",
    createdAt: new Date().toISOString(),
  };

  const project1 = {
    id: "proj_autobots",
    name: "Autonomous Rover AI",
    description: "Building an open-source autonomous rover platform with SLAM, obstacle avoidance, and ROS2 integration.",
    visibility: "PUBLIC",
    tags: ["Robotics", "AI/ML", "Embedded Systems", "IoT"],
    leaderId: user1.id,
    encryptedSettings: encryptSettings({ allowInvites: true, maxMembers: 20 }, user1.id),
    inviteCode: "ROVER2026",
    createdAt: new Date().toISOString(),
  };

  const project2 = {
    id: "proj_healthai",
    name: "MediScan: Early Detection",
    description: "Collaborative medical imaging platform using deep learning to assist rural clinics with ultrasound scans.",
    visibility: "PUBLIC",
    tags: ["AI/ML", "Research", "Data Science"],
    leaderId: user2.id,
    encryptedSettings: encryptSettings({ allowInvites: true, maxMembers: 15 }, user2.id),
    inviteCode: "MEDISCAN",
    createdAt: new Date().toISOString(),
  };

  db.users.push(user1, user2);
  db.projects.push(project1, project2);
  db.members.push(
    { id: "m1", projectId: project1.id, userId: user1.id, role: "LEADER", joinedAt: new Date().toISOString() },
    { id: "m2", projectId: project2.id, userId: user2.id, role: "LEADER", joinedAt: new Date().toISOString() }
  );

  db.tasks.push(
    { id: "t1", projectId: project1.id, title: "Configure ROS2 navigation stack", description: "Set up Nav2 with custom costmaps", status: "IN_PROGRESS", assigneeId: user1.id, creatorId: user1.id, createdAt: new Date().toISOString() },
    { id: "t2", projectId: project1.id, title: "Hardware LiDAR calibration", description: "Test sensor accuracy in outdoor conditions", status: "TODO", assigneeId: null, creatorId: user1.id, createdAt: new Date().toISOString() },
    { id: "t3", projectId: project1.id, title: "Design 3D chassis mounting", description: "Complete CAD models for motor brackets", status: "DONE", assigneeId: user1.id, creatorId: user1.id, createdAt: new Date().toISOString() }
  );

  db.polls.push({
    id: "poll1",
    projectId: project1.id,
    createdById: user1.id,
    question: "Which compute module should we use for edge inference?",
    options: ["NVIDIA Jetson Orin Nano", "Raspberry Pi 5 + Coral TPU", "Qualcomm RB5"],
    isMultiChoice: false,
    createdAt: new Date().toISOString(),
  });

  db.messages.push(
    { id: "msg1", room: "PROJECT", projectId: project1.id, senderId: user1.id, content: "Welcome to the Autonomous Rover project! Check out the Tasks and Polls tab.", createdAt: new Date(Date.now() - 3600000).toISOString() },
    { id: "msg2", room: "GLOBAL", projectId: null, senderId: user1.id, content: "Hello world! Pronnect is live on localhost. Discover teams and build together!", createdAt: new Date(Date.now() - 7200000).toISOString() }
  );

  db.media.push({
    id: "med1",
    projectId: project1.id,
    uploaderId: user1.id,
    name: "ROS2 Documentation & Architecture",
    url: "https://docs.ros.org/en/humble/index.html",
    type: "LINK",
    createdAt: new Date().toISOString()
  });

  saveDB();
}

// --- ENCRYPTION HELPERS (AES-256-GCM) ---
function deriveKey(secret) {
  return crypto.pbkdf2Sync(secret, ENCRYPTION_KEY_SECRET, 10000, 32, "sha256");
}

function encryptSettings(obj, userId) {
  try {
    const key = deriveKey(userId);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let enc = cipher.update(JSON.stringify(obj), "utf8", "base64");
    enc += cipher.final("base64");
    const tag = cipher.getAuthTag().toString("base64");
    return JSON.stringify({ ciphertext: enc, iv: iv.toString("base64"), tag });
  } catch (e) {
    return null;
  }
}

// --- SSE CLIENTS FOR REALTIME ---
const sseClients = new Set();
function broadcastEvent(eventType, payload) {
  const data = JSON.stringify({ type: eventType, payload });
  sseClients.forEach((client) => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.delete(client);
    }
  });
}

// --- AUTH UTILS ---
function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
}

function getUserFromReq(req) {
  const cookie = req.headers["cookie"] || "";
  const match = cookie.match(/pronnect_token=([^;]+)/);
  if (!match) return null;
  const token = match[1];
  const userId = db.sessions[token];
  if (!userId) return null;
  return db.users.find((u) => u.id === userId) || null;
}

// --- JSON BODY PARSER ---
function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

function sendJSON(res, data, status = 200, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(data));
}

// --- HTTP REQUEST HANDLER ---
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;
  const user = getUserFromReq(req);

  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // Real-time SSE Stream
  if (pathname === "/api/events") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const client = { res, userId: user ? user.id : null };
    sseClients.add(client);
    req.on("close", () => sseClients.delete(client));
    return;
  }

  // --- API ROUTES ---

  // Auth: Current User
  if (pathname === "/api/auth/me") {
    if (!user) return sendJSON(res, { user: null });
    const { passwordHash, salt, ...safeUser } = user;
    return sendJSON(res, { user: safeUser });
  }

  // Auth: Register
  if (pathname === "/api/auth/register" && method === "POST") {
    const { name, email, password, school } = await parseBody(req);
    if (!name || !email || !password) {
      return sendJSON(res, { error: "Name, email and password required" }, 400);
    }
    if (db.users.find((u) => u.email.toLowerCase() === email.toLowerCase())) {
      return sendJSON(res, { error: "Email already exists" }, 409);
    }
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const newUser = {
      id: "u_" + crypto.randomUUID().slice(0, 8),
      name,
      email,
      salt,
      passwordHash,
      school: school || "",
      bio: "",
      skills: [],
      githubUrl: "",
      createdAt: new Date().toISOString(),
    };
    db.users.push(newUser);
    saveDB();

    const token = crypto.randomUUID();
    db.sessions[token] = newUser.id;
    const { salt: s, passwordHash: ph, ...safe } = newUser;
    return sendJSON(res, { user: safe }, 201, {
      "Set-Cookie": `pronnect_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }

  // Auth: Login
  if (pathname === "/api/auth/login" && method === "POST") {
    const { email, password } = await parseBody(req);
    const u = db.users.find((x) => x.email.toLowerCase() === (email || "").toLowerCase());
    if (!u) return sendJSON(res, { error: "Invalid credentials" }, 401);
    const hash = hashPassword(password, u.salt);
    if (hash !== u.passwordHash) return sendJSON(res, { error: "Invalid credentials" }, 401);

    const token = crypto.randomUUID();
    db.sessions[token] = u.id;
    const { salt, passwordHash, ...safe } = u;
    return sendJSON(res, { user: safe }, 200, {
      "Set-Cookie": `pronnect_token=${token}; Path=/; HttpOnly; SameSite=Lax`,
    });
  }

  // Auth: Logout
  if (pathname === "/api/auth/logout" && method === "POST") {
    const cookie = req.headers["cookie"] || "";
    const match = cookie.match(/pronnect_token=([^;]+)/);
    if (match) delete db.sessions[match[1]];
    return sendJSON(res, { success: true }, 200, {
      "Set-Cookie": "pronnect_token=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    });
  }

  // Projects List / Explore
  if (pathname === "/api/projects" && method === "GET") {
    const { search, tag, school } = parsedUrl.query;
    let list = db.projects.filter((p) => p.visibility === "PUBLIC");

    if (tag) {
      list = list.filter((p) => p.tags.includes(tag));
    }
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((p) => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (school) {
      const q = school.toLowerCase();
      list = list.filter((p) => {
        const leader = db.users.find((u) => u.id === p.leaderId);
        return leader && leader.school.toLowerCase().includes(q);
      });
    }

    const enriched = list.map((p) => {
      const leader = db.users.find((u) => u.id === p.leaderId);
      const memberCount = db.members.filter((m) => m.projectId === p.id).length;
      return {
        ...p,
        leader: leader ? { id: leader.id, name: leader.name, school: leader.school } : null,
        _count: { members: memberCount },
      };
    });

    return sendJSON(res, { projects: enriched });
  }

  // Create Project
  if (pathname === "/api/projects" && method === "POST") {
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);
    const { name, description, visibility, tags } = await parseBody(req);
    if (!name || !description) return sendJSON(res, { error: "Missing fields" }, 400);

    const newProj = {
      id: "p_" + crypto.randomUUID().slice(0, 8),
      name,
      description,
      visibility: visibility || "PUBLIC",
      tags: tags || [],
      leaderId: user.id,
      encryptedSettings: encryptSettings({ allowInvites: true, maxMembers: 50 }, user.id),
      inviteCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
      createdAt: new Date().toISOString(),
    };

    db.projects.unshift(newProj);
    db.members.push({
      id: "m_" + crypto.randomUUID().slice(0, 8),
      projectId: newProj.id,
      userId: user.id,
      role: "LEADER",
      joinedAt: new Date().toISOString(),
    });
    saveDB();
    broadcastEvent("NEW_PROJECT", newProj);
    return sendJSON(res, { project: newProj }, 201);
  }

  // Project Details
  if (pathname.startsWith("/api/projects/") && !pathname.includes("/join-requests") && !pathname.includes("/tasks") && !pathname.includes("/polls") && !pathname.includes("/messages") && !pathname.includes("/media")) {
    const projId = pathname.split("/")[3];
    const proj = db.projects.find((p) => p.id === projId);
    if (!proj) return sendJSON(res, { error: "Not found" }, 404);

    const leader = db.users.find((u) => u.id === proj.leaderId);
    const members = db.members
      .filter((m) => m.projectId === proj.id)
      .map((m) => {
        const u = db.users.find((x) => x.id === m.userId);
        return {
          ...m,
          user: u ? { id: u.id, name: u.name, school: u.school, skills: u.skills, bio: u.bio } : null,
        };
      });

    const isMember = user ? members.some((m) => m.userId === user.id) : false;
    const isLeader = user ? proj.leaderId === user.id : false;

    return sendJSON(res, {
      project: {
        ...proj,
        leader: leader ? { id: leader.id, name: leader.name, school: leader.school } : null,
        members,
        _count: { members: members.length },
      },
      isMember,
      isLeader,
    });
  }

  // Join Requests (GET & POST)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/join-requests$/)) {
    const projId = pathname.split("/")[3];
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);

    if (method === "GET") {
      const proj = db.projects.find((p) => p.id === projId);
      if (!proj || proj.leaderId !== user.id) return sendJSON(res, { error: "Forbidden" }, 403);
      const reqs = db.joinRequests
        .filter((r) => r.projectId === projId && r.status === "PENDING")
        .map((r) => {
          const u = db.users.find((x) => x.id === r.userId);
          return {
            ...r,
            user: u ? { id: u.id, name: u.name, school: u.school, skills: u.skills, bio: u.bio } : null,
          };
        });
      return sendJSON(res, { requests: reqs });
    }

    if (method === "POST") {
      const { message } = await parseBody(req);
      const isAlreadyMember = db.members.some((m) => m.projectId === projId && m.userId === user.id);
      if (isAlreadyMember) return sendJSON(res, { error: "Already a member" }, 400);

      const existing = db.joinRequests.find((r) => r.projectId === projId && r.userId === user.id && r.status === "PENDING");
      if (existing) return sendJSON(res, { error: "Request already pending" }, 400);

      const joinReq = {
        id: "jr_" + crypto.randomUUID().slice(0, 8),
        projectId: projId,
        userId: user.id,
        message: message || "",
        status: "PENDING",
        createdAt: new Date().toISOString(),
      };
      db.joinRequests.push(joinReq);
      saveDB();
      broadcastEvent("JOIN_REQUEST", joinReq);
      return sendJSON(res, { joinRequest: joinReq }, 201);
    }
  }

  // Join Request Response (PATCH)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/join-requests\/([^/]+)$/) && method === "PATCH") {
    const [, , , projId, reqId] = pathname.split("/");
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);
    const proj = db.projects.find((p) => p.id === projId);
    if (!proj || proj.leaderId !== user.id) return sendJSON(res, { error: "Forbidden" }, 403);

    const joinReq = db.joinRequests.find((r) => r.id === reqId);
    if (!joinReq) return sendJSON(res, { error: "Not found" }, 404);

    const { action } = await parseBody(req); // "APPROVED" or "DENIED"
    joinReq.status = action;

    if (action === "APPROVED") {
      db.members.push({
        id: "m_" + crypto.randomUUID().slice(0, 8),
        projectId: projId,
        userId: joinReq.userId,
        role: "MEMBER",
        joinedAt: new Date().toISOString(),
      });
    }
    saveDB();
    broadcastEvent("JOIN_REQUEST_UPDATED", { projId, reqId, action });
    return sendJSON(res, { success: true, status: action });
  }

  // Tasks (GET & POST)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/tasks$/)) {
    const projId = pathname.split("/")[3];
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);

    if (method === "GET") {
      const tasks = db.tasks.filter((t) => t.projectId === projId).map((t) => {
        const assignee = db.users.find((u) => u.id === t.assigneeId);
        const creator = db.users.find((u) => u.id === t.creatorId);
        return {
          ...t,
          assignee: assignee ? { id: assignee.id, name: assignee.name } : null,
          creator: creator ? { id: creator.id, name: creator.name } : null,
        };
      });
      return sendJSON(res, { tasks });
    }

    if (method === "POST") {
      const { title, description, assigneeId, dueDate } = await parseBody(req);
      if (!title) return sendJSON(res, { error: "Title required" }, 400);

      const newTask = {
        id: "t_" + crypto.randomUUID().slice(0, 8),
        projectId: projId,
        title,
        description: description || "",
        status: "TODO",
        assigneeId: assigneeId || null,
        creatorId: user.id,
        dueDate: dueDate || null,
        createdAt: new Date().toISOString(),
      };
      db.tasks.push(newTask);
      saveDB();
      broadcastEvent("TASK_CREATED", newTask);
      return sendJSON(res, { task: newTask }, 201);
    }
  }

  // Task Status Update (PATCH)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/tasks\/([^/]+)$/) && method === "PATCH") {
    const [, , , projId, taskId] = pathname.split("/");
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);
    const task = db.tasks.find((t) => t.id === taskId && t.projectId === projId);
    if (!task) return sendJSON(res, { error: "Not found" }, 404);

    const { status, title, description, assigneeId } = await parseBody(req);
    if (status) task.status = status;
    if (title) task.title = title;
    if (description !== undefined) task.description = description;
    if (assigneeId !== undefined) task.assigneeId = assigneeId;
    saveDB();
    broadcastEvent("TASK_UPDATED", task);
    return sendJSON(res, { task });
  }

  // Polls (GET & POST)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/polls$/)) {
    const projId = pathname.split("/")[3];
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);

    if (method === "GET") {
      const polls = db.polls.filter((p) => p.projectId === projId).map((poll) => {
        const creator = db.users.find((u) => u.id === poll.createdById);
        const votes = db.pollVotes.filter((v) => v.pollId === poll.id);
        const voteCounts = poll.options.map((_, i) =>
          votes.filter((v) => v.optionIndexes.includes(i)).length
        );
        const userVote = votes.find((v) => v.userId === user.id)?.optionIndexes || [];
        return {
          ...poll,
          createdBy: creator ? { id: creator.id, name: creator.name } : null,
          voteCounts,
          userVote,
          totalVoters: votes.length,
        };
      });
      return sendJSON(res, { polls });
    }

    if (method === "POST") {
      const { question, options, isMultiChoice } = await parseBody(req);
      if (!question || !options || options.length < 2) {
        return sendJSON(res, { error: "Question & at least 2 options required" }, 400);
      }
      const newPoll = {
        id: "poll_" + crypto.randomUUID().slice(0, 8),
        projectId: projId,
        createdById: user.id,
        question,
        options,
        isMultiChoice: !!isMultiChoice,
        createdAt: new Date().toISOString(),
      };
      db.polls.unshift(newPoll);
      saveDB();
      broadcastEvent("POLL_CREATED", newPoll);
      return sendJSON(res, { poll: newPoll }, 201);
    }
  }

  // Poll Vote (POST)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/polls\/([^/]+)\/vote$/) && method === "POST") {
    const [, , , projId, pollId] = pathname.split("/");
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);
    const { optionIndexes } = await parseBody(req);

    const existingIndex = db.pollVotes.findIndex((v) => v.pollId === pollId && v.userId === user.id);
    if (existingIndex >= 0) {
      db.pollVotes[existingIndex].optionIndexes = optionIndexes;
    } else {
      db.pollVotes.push({
        id: "pv_" + crypto.randomUUID().slice(0, 8),
        pollId,
        userId: user.id,
        optionIndexes,
      });
    }
    saveDB();
    broadcastEvent("POLL_VOTED", { pollId, userId: user.id, optionIndexes });
    return sendJSON(res, { success: true });
  }

  // Messages (Project & Global)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/messages$/) || pathname === "/api/global-chat") {
    const isGlobal = pathname === "/api/global-chat";
    const projId = isGlobal ? null : pathname.split("/")[3];

    if (method === "GET") {
      const msgs = db.messages
        .filter((m) => (isGlobal ? m.room === "GLOBAL" : m.room === "PROJECT" && m.projectId === projId))
        .map((m) => {
          const sender = db.users.find((u) => u.id === m.senderId);
          return {
            ...m,
            sender: sender ? { id: sender.id, name: sender.name } : { id: "unknown", name: "User" },
          };
        });
      return sendJSON(res, { messages: msgs.slice(-50) });
    }

    if (method === "POST") {
      if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);
      const { content } = await parseBody(req);
      if (!content || !content.trim()) return sendJSON(res, { error: "Content required" }, 400);

      // Simple word filter
      let sanitized = content.replace(/\b(spam|abuse)\b/gi, "****");

      const newMsg = {
        id: "msg_" + crypto.randomUUID().slice(0, 8),
        room: isGlobal ? "GLOBAL" : "PROJECT",
        projectId: projId,
        senderId: user.id,
        content: sanitized,
        createdAt: new Date().toISOString(),
      };
      db.messages.push(newMsg);
      saveDB();

      const enriched = { ...newMsg, sender: { id: user.id, name: user.name } };
      broadcastEvent(isGlobal ? "GLOBAL_MESSAGE" : "PROJECT_MESSAGE", enriched);
      return sendJSON(res, { message: enriched }, 201);
    }
  }

  // Media (GET & POST)
  if (pathname.match(/^\/api\/projects\/([^/]+)\/media$/)) {
    const projId = pathname.split("/")[3];
    if (!user) return sendJSON(res, { error: "Unauthorized" }, 401);

    if (method === "GET") {
      const items = db.media.filter((m) => m.projectId === projId).map((m) => {
        const uploader = db.users.find((u) => u.id === m.uploaderId);
        return {
          ...m,
          uploader: uploader ? { id: uploader.id, name: uploader.name } : null,
        };
      });
      return sendJSON(res, { items });
    }

    if (method === "POST") {
      const { name, url: mediaUrl, type } = await parseBody(req);
      if (!mediaUrl) return sendJSON(res, { error: "URL required" }, 400);

      const newItem = {
        id: "med_" + crypto.randomUUID().slice(0, 8),
        projectId: projId,
        uploaderId: user.id,
        name: name || mediaUrl,
        url: mediaUrl,
        type: type || "LINK",
        createdAt: new Date().toISOString(),
      };
      db.media.unshift(newItem);
      saveDB();
      broadcastEvent("MEDIA_ADDED", newItem);
      return sendJSON(res, { item: newItem }, 201);
    }
  }

  // Profile (GET & PATCH)
  if (pathname.startsWith("/api/users/")) {
    const targetId = pathname.split("/")[3];
    const target = db.users.find((u) => u.id === targetId);
    if (!target) return sendJSON(res, { error: "User not found" }, 404);

    if (method === "GET") {
      const userProjects = db.members
        .filter((m) => m.userId === targetId)
        .map((m) => {
          const p = db.projects.find((x) => x.id === m.projectId);
          return p ? { id: p.id, name: p.name, description: p.description, tags: p.tags, visibility: p.visibility } : null;
        })
        .filter(Boolean);

      const { salt, passwordHash, ...safe } = target;
      return sendJSON(res, { user: { ...safe, projects: userProjects } });
    }

    if (method === "PATCH") {
      if (!user || user.id !== targetId) return sendJSON(res, { error: "Forbidden" }, 403);
      const { name, bio, githubUrl, school, skills } = await parseBody(req);
      if (name) target.name = name;
      if (bio !== undefined) target.bio = bio;
      if (githubUrl !== undefined) target.githubUrl = githubUrl;
      if (school !== undefined) target.school = school;
      if (skills !== undefined) target.skills = skills;
      saveDB();
      const { salt, passwordHash, ...safe } = target;
      return sendJSON(res, { user: safe });
    }
  }

  // --- SERVE SINGLE-PAGE APP (VANILLA HTML + CSS + JS) ---
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(getAppHTML());
});

// --- BEAUTIFUL MODERN SPA UI (BUILT-IN) ---
function getAppHTML() {
  return `<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pronnect — Local Standalone Edition</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: { 500: '#6366f1', 600: '#4f46e5', 700: '#4338ca' }
          }
        }
      }
    }
  </script>
  <style>
    body { background-color: #030712; color: #f9fafb; font-family: ui-sans-serif, system-ui, sans-serif; }
    .glass { background: rgba(17, 24, 39, 0.75); backdrop-filter: blur(12px); border: 1px solid rgba(55, 65, 81, 0.5); }
    .glass-card { background: rgba(31, 41, 55, 0.5); backdrop-filter: blur(8px); border: 1px solid rgba(55, 65, 81, 0.4); border-radius: 0.75rem; }
    .gradient-text { background: linear-gradient(135deg, #6366f1, #a855f7, #ec4899); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
    .glow-indigo { box-shadow: 0 0 20px rgba(99, 102, 241, 0.25); }
    ::-webkit-scrollbar { width: 6px; height: 6px; }
    ::-webkit-scrollbar-track { background: #111827; }
    ::-webkit-scrollbar-thumb { background: #374151; border-radius: 3px; }
  </style>
</head>
<body class="min-h-screen flex flex-col antialiased">
  <!-- NAVBAR -->
  <nav class="sticky top-0 z-50 glass border-b border-gray-800/80 px-4 sm:px-8 py-3">
    <div class="max-w-7xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-6">
        <a href="#explore" onclick="navigate('explore')" class="flex items-center gap-2 cursor-pointer">
          <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/30">P</div>
          <span class="text-xl font-bold tracking-tight gradient-text">Pronnect</span>
        </a>
        <div class="hidden sm:flex items-center gap-1">
          <button onclick="navigate('explore')" id="nav-explore" class="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-all font-medium">Explore</button>
          <button onclick="navigate('global-chat')" id="nav-global" class="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-all font-medium">Global Chat</button>
          <button onclick="navigate('new-project')" id="nav-new" class="px-3 py-1.5 rounded-lg text-sm text-gray-300 hover:text-white hover:bg-gray-800 transition-all font-medium">+ New Project</button>
        </div>
      </div>
      <div id="nav-auth" class="flex items-center gap-3"></div>
    </div>
  </nav>

  <!-- MAIN CONTAINER -->
  <main class="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-8 py-8" id="app-root"></main>

  <!-- TOAST CONTAINER -->
  <div id="toast-root" class="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none"></div>

  <script>
    // --- STATE MANAGEMENT ---
    let currentUser = null;
    let currentView = 'explore';
    let activeProjectId = null;
    let activeProjectTab = 'chat';
    let projectsCache = [];
    let domainTags = ["AI/ML", "Web Dev", "Mobile", "Embedded Systems", "Robotics", "IoT", "Cybersecurity", "Data Science", "Research"];

    // Toast utility
    function showToast(msg, isError = false) {
      const root = document.getElementById('toast-root');
      const toast = document.createElement('div');
      toast.className = 'glass-card px-4 py-3 text-sm text-gray-100 shadow-xl border ' + (isError ? 'border-red-500/50 bg-red-950/80' : 'border-indigo-500/50 bg-gray-900/90') + ' pointer-events-auto transition-all transform duration-300';
      toast.innerHTML = (isError ? '⚠️ ' : '✅ ') + msg;
      root.appendChild(toast);
      setTimeout(() => { toast.remove(); }, 3500);
    }

    // Initialize App
    async function init() {
      setupRealtimeSSE();
      await checkAuth();
      navigate('explore');
    }

    function setupRealtimeSSE() {
      const evtSource = new EventSource('/api/events');
      evtSource.onmessage = (e) => {
        try {
          const { type, payload } = JSON.parse(e.data);
          if (type === 'GLOBAL_MESSAGE' && currentView === 'global-chat') loadGlobalChat();
          if (type === 'PROJECT_MESSAGE' && currentView === 'project' && activeProjectTab === 'chat') loadProjectChat(activeProjectId);
          if (type === 'TASK_CREATED' || type === 'TASK_UPDATED') {
            if (currentView === 'project' && activeProjectTab === 'tasks') loadProjectTasks(activeProjectId);
            if (currentView === 'project' && activeProjectTab === 'progress') loadProjectProgress(activeProjectId);
          }
          if (type === 'POLL_CREATED' || type === 'POLL_VOTED') {
            if (currentView === 'project' && activeProjectTab === 'polls') loadProjectPolls(activeProjectId);
          }
          if (type === 'JOIN_REQUEST' || type === 'JOIN_REQUEST_UPDATED') {
            if (currentView === 'project') renderProjectView(activeProjectId);
          }
        } catch (err) {}
      };
    }

    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        currentUser = data.user;
        renderNavAuth();
      } catch (e) {
        currentUser = null;
        renderNavAuth();
      }
    }

    function renderNavAuth() {
      const container = document.getElementById('nav-auth');
      if (currentUser) {
        container.innerHTML = \`
          <button onclick="navigate('profile', '\${currentUser.id}')" class="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors text-sm">
            <div class="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold flex items-center justify-center text-xs">\${currentUser.name.slice(0, 1).toUpperCase()}</div>
            <span class="font-medium text-gray-200">\${currentUser.name}</span>
          </button>
          <button onclick="logout()" class="text-xs text-gray-400 hover:text-red-400 transition-colors">Sign Out</button>
        \`;
      } else {
        container.innerHTML = \`
          <button onclick="navigate('login')" class="text-sm text-gray-300 hover:text-white px-3 py-1.5">Sign In</button>
          <button onclick="navigate('register')" class="text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-1.5 rounded-lg font-medium shadow-md shadow-indigo-600/30">Get Started</button>
        \`;
      }
    }

    async function logout() {
      await fetch('/api/auth/logout', { method: 'POST' });
      currentUser = null;
      renderNavAuth();
      showToast('Logged out');
      navigate('explore');
    }

    // Router
    function navigate(view, param = null) {
      currentView = view;
      const root = document.getElementById('app-root');
      if (view === 'explore') renderExploreView();
      else if (view === 'login') renderLoginView();
      else if (view === 'register') renderRegisterView();
      else if (view === 'new-project') renderNewProjectView();
      else if (view === 'project') renderProjectView(param);
      else if (view === 'global-chat') renderGlobalChatView();
      else if (view === 'profile') renderProfileView(param || (currentUser ? currentUser.id : null));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // --- 1. EXPLORE VIEW ---
    async function renderExploreView() {
      const root = document.getElementById('app-root');
      root.innerHTML = \`
        <div class="space-y-6">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 class="text-3xl font-extrabold tracking-tight">Explore Projects</h1>
              <p class="text-gray-400 text-sm mt-1">Discover teams, open collaboration projects, and hackathon groups</p>
            </div>
            <button onclick="navigate('new-project')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/30 self-start sm:self-auto">+ Create Project</button>
          </div>

          <!-- Filters -->
          <div class="glass-card p-4 space-y-3">
            <div class="flex flex-col sm:flex-row gap-3">
              <input id="search-input" oninput="debounceSearch()" placeholder="Search projects by name or description..." class="flex-1 px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
              <input id="school-input" oninput="debounceSearch()" placeholder="Filter by school / college..." class="sm:w-64 px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div class="flex flex-wrap gap-1.5 pt-1" id="tag-filters">
              <button onclick="selectTag('')" id="tag-btn-all" class="px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white">All Tags</button>
              \${domainTags.map(t => \`<button onclick="selectTag('\${t}')" id="tag-btn-\${t.replace(/[^a-zA-Z]/g, '')}" class="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700">\${t}</button>\`).join('')}
            </div>
          </div>

          <!-- Project Cards Grid -->
          <div id="projects-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            <div class="text-gray-500 text-sm col-span-full text-center py-12">Loading projects...</div>
          </div>
        </div>
      \`;
      loadProjects();
    }

    let activeTag = '';
    let searchDebounceTimer = null;

    function debounceSearch() {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(loadProjects, 300);
    }

    function selectTag(tag) {
      activeTag = tag;
      document.querySelectorAll('#tag-filters button').forEach(b => {
        b.className = 'px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 hover:bg-gray-700 border border-gray-700';
      });
      const selected = tag ? document.getElementById('tag-btn-' + tag.replace(/[^a-zA-Z]/g, '')) : document.getElementById('tag-btn-all');
      if (selected) selected.className = 'px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white';
      loadProjects();
    }

    async function loadProjects() {
      const search = document.getElementById('search-input')?.value || '';
      const school = document.getElementById('school-input')?.value || '';
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (school) params.set('school', school);
      if (activeTag) params.set('tag', activeTag);

      const res = await fetch('/api/projects?' + params.toString());
      const data = await res.json();
      projectsCache = data.projects || [];
      const grid = document.getElementById('projects-grid');
      if (!grid) return;

      if (projectsCache.length === 0) {
        grid.innerHTML = '<div class="col-span-full text-center py-16 text-gray-500">No projects found. Try a different search or tag!</div>';
        return;
      }

      grid.innerHTML = projectsCache.map(p => \`
        <div class="glass-card p-5 flex flex-col justify-between hover:border-indigo-500/40 transition-all group">
          <div>
            <div class="flex items-start justify-between gap-2 mb-2">
              <h3 onclick="navigate('project', '\${p.id}')" class="font-semibold text-lg text-gray-100 group-hover:text-indigo-300 cursor-pointer line-clamp-1">\${escapeHtml(p.name)}</h3>
              <span class="text-xs px-2 py-0.5 rounded bg-gray-800 border border-gray-700 text-gray-400 shrink-0">\${p._count.members} member\${p._count.members !== 1 ? 's' : ''}</span>
            </div>
            <p class="text-sm text-gray-400 line-clamp-2 mb-4">\${escapeHtml(p.description)}</p>
            <div class="flex flex-wrap gap-1.5 mb-4">
              \${p.tags.map(t => \`<span class="px-2 py-0.5 rounded text-[11px] font-medium bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">\${t}</span>\`).join('')}
            </div>
          </div>
          <div class="flex items-center justify-between pt-3 border-t border-gray-800/80">
            <div class="flex items-center gap-2">
              <div class="w-6 h-6 rounded-full bg-indigo-700 text-white font-bold flex items-center justify-center text-[10px]">\${p.leader ? p.leader.name.slice(0, 1).toUpperCase() : '?'}</div>
              <div>
                <div class="text-xs font-medium text-gray-300">\${p.leader ? escapeHtml(p.leader.name) : 'Anonymous'}</div>
                \${p.leader && p.leader.school ? \`<div class="text-[10px] text-gray-500">\${escapeHtml(p.leader.school)}</div>\` : ''}
              </div>
            </div>
            <button onclick="navigate('project', '\${p.id}')" class="text-xs font-medium text-indigo-400 hover:text-indigo-300">View &rarr;</button>
          </div>
        </div>
      \`).join('');
    }

    // --- 2. PROJECT DETAIL & WORKSPACE ---
    async function renderProjectView(projectId) {
      activeProjectId = projectId;
      const root = document.getElementById('app-root');
      root.innerHTML = '<div class="text-center py-20 text-gray-500">Loading project workspace...</div>';

      const res = await fetch('/api/projects/' + projectId);
      if (!res.ok) {
        root.innerHTML = '<div class="text-center py-20 text-red-400">Project not found or private.</div>';
        return;
      }
      const { project, isMember, isLeader } = await res.json();

      root.innerHTML = \`
        <div class="space-y-6">
          <!-- Project Header -->
          <div class="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div class="flex items-center gap-3">
                <h1 class="text-2xl font-bold text-gray-100">\${escapeHtml(project.name)}</h1>
                <span class="text-xs px-2.5 py-0.5 rounded-full font-medium \${project.visibility === 'PUBLIC' ? 'bg-green-500/20 text-green-300 border border-green-500/30' : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'}">\${project.visibility}</span>
              </div>
              <p class="text-sm text-gray-400 mt-2 max-w-2xl">\${escapeHtml(project.description)}</p>
              <div class="flex flex-wrap gap-2 mt-3">
                \${project.tags.map(t => \`<span class="px-2.5 py-0.5 rounded-md text-xs font-medium bg-indigo-950/80 border border-indigo-500/30 text-indigo-300">\${t}</span>\`).join('')}
              </div>
            </div>
            <div class="flex items-center gap-3 self-start md:self-auto" id="project-action-btn">
              \${!isMember && currentUser ? \`<button onclick="requestToJoin('\${project.id}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-md shadow-indigo-600/30">Request to Join</button>\` : ''}
              \${!currentUser ? \`<button onclick="navigate('login')" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-sm border border-gray-700">Sign in to Join</button>\` : ''}
            </div>
          </div>

          \${!isMember ? \`
            <div class="glass-card p-12 text-center text-gray-400">
              <div class="text-3xl mb-2">🔒</div>
              <h3 class="text-lg font-semibold text-gray-200">Members-Only Workspace</h3>
              <p class="text-sm text-gray-500 mt-1 max-w-md mx-auto">Join this team to participate in real-time chat, task boards, live polls, and shared media.</p>
            </div>
          \` : \`
            <!-- Workspace Tabs -->
            <div class="flex gap-2 border-b border-gray-800 pb-2 overflow-x-auto">
              <button onclick="switchProjectTab('chat')" id="ptab-chat" class="px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white">💬 Team Chat</button>
              <button onclick="switchProjectTab('tasks')" id="ptab-tasks" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800">📋 Tasks</button>
              <button onclick="switchProjectTab('polls')" id="ptab-polls" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800">📊 Polls</button>
              <button onclick="switchProjectTab('media')" id="ptab-media" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800">📁 Media & Links</button>
              <button onclick="switchProjectTab('progress')" id="ptab-progress" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800">📈 Progress</button>
              \${isLeader ? \`<button onclick="switchProjectTab('requests')" id="ptab-requests" class="px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800">👥 Join Requests</button>\` : ''}
            </div>

            <!-- Tab Content Container -->
            <div id="project-tab-content"></div>
          \`}
        </div>
      \`;

      if (isMember) switchProjectTab(activeProjectTab || 'chat');
    }

    async function requestToJoin(projId) {
      const res = await fetch('/api/projects/' + projId + '/join-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: "Hi, I'd love to collaborate on this project!" })
      });
      const data = await res.json();
      if (res.ok) {
        showToast("Join request sent to project leader!");
        document.getElementById('project-action-btn').innerHTML = '<span class="text-xs text-green-400 font-medium px-3 py-1.5 bg-green-500/10 border border-green-500/30 rounded-lg">Requested ✓</span>';
      } else {
        showToast(data.error || "Failed to send request", true);
      }
    }

    function switchProjectTab(tab) {
      activeProjectTab = tab;
      document.querySelectorAll('[id^="ptab-"]').forEach(b => {
        b.className = 'px-4 py-2 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-200 hover:bg-gray-800';
      });
      const activeBtn = document.getElementById('ptab-' + tab);
      if (activeBtn) activeBtn.className = 'px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 text-white';

      if (tab === 'chat') loadProjectChat(activeProjectId);
      else if (tab === 'tasks') loadProjectTasks(activeProjectId);
      else if (tab === 'polls') loadProjectPolls(activeProjectId);
      else if (tab === 'media') loadProjectMedia(activeProjectId);
      else if (tab === 'progress') loadProjectProgress(activeProjectId);
      else if (tab === 'requests') loadProjectRequests(activeProjectId);
    }

    // --- TAB: TEAM CHAT ---
    async function loadProjectChat(projId) {
      const container = document.getElementById('project-tab-content');
      container.innerHTML = \`
        <div class="glass-card flex flex-col h-[520px]">
          <div id="chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3">Loading messages...</div>
          <form onsubmit="sendProjectMessage(event, '\${projId}')" class="p-3 border-t border-gray-800 flex gap-2">
            <input id="proj-msg-input" placeholder="Type a message to the team..." class="flex-1 px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium">Send</button>
          </form>
        </div>
      \`;
      const res = await fetch('/api/projects/' + projId + '/messages');
      const data = await res.json();
      renderChatMessages('chat-messages', data.messages || []);
    }

    function renderChatMessages(elementId, msgs) {
      const box = document.getElementById(elementId);
      if (!box) return;
      if (msgs.length === 0) {
        box.innerHTML = '<div class="text-center text-gray-500 text-sm py-12">No messages yet. Say hello! 👋</div>';
        return;
      }
      box.innerHTML = msgs.map(m => {
        const isMe = currentUser && m.senderId === currentUser.id;
        return \`
          <div class="flex flex-col \${isMe ? 'items-end' : 'items-start'}">
            <div class="text-[10px] text-gray-500 mb-0.5 px-1">\${escapeHtml(m.sender.name)}</div>
            <div class="px-3.5 py-2 rounded-2xl text-sm max-w-[80%] \${isMe ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}">
              \${escapeHtml(m.content)}
            </div>
          </div>
        \`;
      }).join('');
      box.scrollTop = box.scrollHeight;
    }

    async function sendProjectMessage(e, projId) {
      e.preventDefault();
      const input = document.getElementById('proj-msg-input');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      await fetch('/api/projects/' + projId + '/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      loadProjectChat(projId);
    }

    // --- TAB: KANBAN TASKS ---
    async function loadProjectTasks(projId) {
      const container = document.getElementById('project-tab-content');
      container.innerHTML = \`
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-semibold text-gray-200 text-base">Project Tasks</h3>
            <button onclick="showCreateTaskModal('\${projId}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">+ Add Task</button>
          </div>
          <div id="tasks-board" class="grid grid-cols-1 md:grid-cols-3 gap-4">Loading tasks...</div>
        </div>
      \`;
      const res = await fetch('/api/projects/' + projId + '/tasks');
      const data = await res.json();
      const tasks = data.tasks || [];

      const todo = tasks.filter(t => t.status === 'TODO');
      const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS');
      const done = tasks.filter(t => t.status === 'DONE');

      document.getElementById('tasks-board').innerHTML = \`
        \${renderTaskColumn('To Do', todo, 'TODO', projId)}
        \${renderTaskColumn('In Progress', inProgress, 'IN_PROGRESS', projId)}
        \${renderTaskColumn('Done', done, 'DONE', projId)}
      \`;
    }

    function renderTaskColumn(title, list, status, projId) {
      return \`
        <div class="glass-card p-4 space-y-3">
          <div class="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
            <span>\${title}</span>
            <span class="px-2 py-0.5 bg-gray-800 rounded">\${list.length}</span>
          </div>
          <div class="space-y-2">
            \${list.length === 0 ? '<div class="text-xs text-gray-600 py-3 text-center">No tasks</div>' : ''}
            \${list.map(t => \`
              <div class="p-3 bg-gray-900 border border-gray-800 rounded-lg space-y-2">
                <div class="text-sm font-medium text-gray-200">\${escapeHtml(t.title)}</div>
                \${t.description ? \`<div class="text-xs text-gray-400 line-clamp-2">\${escapeHtml(t.description)}</div>\` : ''}
                <div class="flex items-center justify-between pt-1 text-[11px] text-gray-500">
                  <span>\${t.assignee ? '👤 ' + escapeHtml(t.assignee.name) : 'Unassigned'}</span>
                  <select onchange="updateTaskStatus('\${projId}', '\${t.id}', this.value)" class="bg-gray-800 border border-gray-700 rounded px-1.5 py-0.5 text-[10px] text-gray-300">
                    <option value="TODO" \${t.status === 'TODO' ? 'selected' : ''}>To Do</option>
                    <option value="IN_PROGRESS" \${t.status === 'IN_PROGRESS' ? 'selected' : ''}>In Progress</option>
                    <option value="DONE" \${t.status === 'DONE' ? 'selected' : ''}>Done</option>
                  </select>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    async function updateTaskStatus(projId, taskId, status) {
      await fetch('/api/projects/' + projId + '/tasks/' + taskId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      loadProjectTasks(projId);
    }

    function showCreateTaskModal(projId) {
      const title = prompt("Task title:");
      if (!title) return;
      const description = prompt("Task description (optional):") || "";
      fetch('/api/projects/' + projId + '/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      }).then(() => loadProjectTasks(projId));
    }

    // --- TAB: POLLS ---
    async function loadProjectPolls(projId) {
      const container = document.getElementById('project-tab-content');
      container.innerHTML = \`
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-semibold text-gray-200 text-base">Team Polls</h3>
            <button onclick="showCreatePollModal('\${projId}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">+ Create Poll</button>
          </div>
          <div id="polls-list" class="space-y-4">Loading polls...</div>
        </div>
      \`;
      const res = await fetch('/api/projects/' + projId + '/polls');
      const data = await res.json();
      const polls = data.polls || [];
      const box = document.getElementById('polls-list');
      if (polls.length === 0) {
        box.innerHTML = '<div class="glass-card p-8 text-center text-gray-500 text-sm">No polls created yet.</div>';
        return;
      }
      box.innerHTML = polls.map(p => {
        const totalVotes = p.voteCounts.reduce((a, b) => a + b, 0);
        return \`
          <div class="glass-card p-5 space-y-3">
            <div class="font-medium text-gray-100 text-base">\${escapeHtml(p.question)}</div>
            <div class="text-xs text-gray-500">Created by \${p.createdBy ? escapeHtml(p.createdBy.name) : 'Leader'} &middot; \${p.totalVoters} voter\${p.totalVoters !== 1 ? 's' : ''}</div>
            <div class="space-y-2 pt-1">
              \${p.options.map((opt, idx) => {
                const count = p.voteCounts[idx] || 0;
                const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
                const hasVoted = p.userVote.includes(idx);
                return \`
                  <button onclick="votePoll('\${projId}', '\${p.id}', \${idx})" class="w-full text-left p-3 rounded-lg border \${hasVoted ? 'border-indigo-500 bg-indigo-500/10' : 'border-gray-700 bg-gray-900/80 hover:border-gray-600'} transition-all relative overflow-hidden">
                    <div class="absolute inset-0 bg-indigo-600/20" style="width: \${pct}%;"></div>
                    <div class="relative flex justify-between items-center text-sm font-medium text-gray-200">
                      <span>\${escapeHtml(opt)} \${hasVoted ? '✓' : ''}</span>
                      <span class="text-xs text-gray-400">\${count} vote\${count !== 1 ? 's' : ''} (\${pct}%)</span>
                    </div>
                  </button>
                \`;
              }).join('')}
            </div>
          </div>
        \`;
      }).join('');
    }

    async function votePoll(projId, pollId, optionIdx) {
      await fetch('/api/projects/' + projId + '/polls/' + pollId + '/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionIndexes: [optionIdx] })
      });
      loadProjectPolls(projId);
    }

    function showCreatePollModal(projId) {
      const question = prompt("Poll question:");
      if (!question) return;
      const opt1 = prompt("Option 1:");
      const opt2 = prompt("Option 2:");
      if (!opt1 || !opt2) return;
      fetch('/api/projects/' + projId + '/polls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, options: [opt1, opt2] })
      }).then(() => loadProjectPolls(projId));
    }

    // --- TAB: MEDIA & LINKS ---
    async function loadProjectMedia(projId) {
      const container = document.getElementById('project-tab-content');
      container.innerHTML = \`
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <h3 class="font-semibold text-gray-200 text-base">Media & Project Resources</h3>
            <button onclick="showAddMediaModal('\${projId}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-medium">+ Add Link</button>
          </div>
          <div id="media-grid" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">Loading media...</div>
        </div>
      \`;
      const res = await fetch('/api/projects/' + projId + '/media');
      const data = await res.json();
      const items = data.items || [];
      const grid = document.getElementById('media-grid');
      if (items.length === 0) {
        grid.innerHTML = '<div class="col-span-full glass-card p-8 text-center text-gray-500 text-sm">No resources shared yet.</div>';
        return;
      }
      grid.innerHTML = items.map(m => \`
        <a href="\${escapeHtml(m.url)}" target="_blank" class="glass-card p-4 flex items-start gap-3 hover:border-indigo-500/40 transition-all group">
          <div class="w-8 h-8 rounded bg-indigo-600/20 text-indigo-400 flex items-center justify-center font-bold text-sm shrink-0">🔗</div>
          <div class="min-w-0 flex-1">
            <div class="text-sm font-medium text-gray-200 group-hover:text-indigo-300 truncate">\${escapeHtml(m.name)}</div>
            <div class="text-xs text-gray-500 truncate">\${escapeHtml(m.url)}</div>
            <div class="text-[10px] text-gray-600 mt-1">Shared by \${m.uploader ? escapeHtml(m.uploader.name) : 'User'}</div>
          </div>
        </a>
      \`).join('');
    }

    function showAddMediaModal(projId) {
      const name = prompt("Resource name:");
      const url = prompt("Resource URL (https://...):");
      if (!url) return;
      fetch('/api/projects/' + projId + '/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name || url, url })
      }).then(() => loadProjectMedia(projId));
    }

    // --- TAB: PROGRESS (CHARTS & STATS) ---
    async function loadProjectProgress(projId) {
      const container = document.getElementById('project-tab-content');
      const res = await fetch('/api/projects/' + projId + '/tasks');
      const { tasks = [] } = await res.json();

      const total = tasks.length;
      const done = tasks.filter(t => t.status === 'DONE').length;
      const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
      const todo = tasks.filter(t => t.status === 'TODO').length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      container.innerHTML = \`
        <div class="space-y-6">
          <div class="glass-card p-6 space-y-4">
            <h3 class="font-semibold text-gray-200 text-lg">Milestone & Task Completion</h3>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div class="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center">
                <div class="text-2xl font-bold text-gray-100">\${total}</div>
                <div class="text-xs text-gray-500">Total Tasks</div>
              </div>
              <div class="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center">
                <div class="text-2xl font-bold text-yellow-400">\${inProgress}</div>
                <div class="text-xs text-gray-500">In Progress</div>
              </div>
              <div class="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center">
                <div class="text-2xl font-bold text-green-400">\${done}</div>
                <div class="text-xs text-gray-500">Completed</div>
              </div>
              <div class="bg-gray-900 p-4 rounded-xl border border-gray-800 text-center">
                <div class="text-2xl font-bold text-indigo-400">\${pct}%</div>
                <div class="text-xs text-gray-500">Overall Progress</div>
              </div>
            </div>

            <!-- Visual Progress Bar -->
            <div class="space-y-2 pt-2">
              <div class="flex justify-between text-xs text-gray-400 font-medium">
                <span>Progress: \${done} of \${total} tasks done</span>
                <span>\${pct}%</span>
              </div>
              <div class="w-full h-3 bg-gray-800 rounded-full overflow-hidden">
                <div class="h-full bg-gradient-to-r from-indigo-500 to-green-500 rounded-full transition-all duration-700" style="width: \${pct}%;"></div>
              </div>
            </div>
          </div>
        </div>
      \`;
    }

    // --- TAB: JOIN REQUESTS ---
    async function loadProjectRequests(projId) {
      const container = document.getElementById('project-tab-content');
      const res = await fetch('/api/projects/' + projId + '/join-requests');
      const { requests = [] } = await res.json();

      container.innerHTML = \`
        <div class="glass-card p-6 space-y-4">
          <h3 class="font-semibold text-gray-200 text-base">Pending Join Requests (\${requests.length})</h3>
          \${requests.length === 0 ? '<div class="text-gray-500 text-sm text-center py-6">No pending join requests</div>' : ''}
          <div class="space-y-3">
            \${requests.map(r => \`
              <div class="p-4 bg-gray-900 border border-gray-800 rounded-xl flex items-center justify-between gap-4">
                <div>
                  <div class="font-medium text-gray-200">\${escapeHtml(r.user ? r.user.name : 'Applicant')}</div>
                  <div class="text-xs text-gray-400">\${escapeHtml(r.user ? r.user.school : '')}</div>
                  \${r.message ? \`<div class="text-xs text-gray-500 italic mt-1">"\${escapeHtml(r.message)}"</div>\` : ''}
                </div>
                <div class="flex gap-2">
                  <button onclick="handleJoinRequest('\${projId}', '\${r.id}', 'DENIED')" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-red-400 rounded-lg text-xs font-medium">Deny</button>
                  <button onclick="handleJoinRequest('\${projId}', '\${r.id}', 'APPROVED')" class="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white rounded-lg text-xs font-medium">Approve</button>
                </div>
              </div>
            \`).join('')}
          </div>
        </div>
      \`;
    }

    async function handleJoinRequest(projId, reqId, action) {
      await fetch('/api/projects/' + projId + '/join-requests/' + reqId, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });
      showToast(action === 'APPROVED' ? 'Member approved!' : 'Request denied');
      loadProjectRequests(projId);
    }

    // --- 3. CREATE PROJECT VIEW ---
    function renderNewProjectView() {
      if (!currentUser) {
        navigate('login');
        return;
      }
      const root = document.getElementById('app-root');
      root.innerHTML = \`
        <div class="max-w-2xl mx-auto glass-card p-8 space-y-6">
          <div>
            <h1 class="text-2xl font-bold text-gray-100">Create a New Project</h1>
            <p class="text-gray-400 text-sm mt-1">Launch a project, recruit team members, and encrypt project settings at rest.</p>
          </div>
          <form onsubmit="submitNewProject(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Project Name</label>
              <input id="new-proj-name" required placeholder="e.g. Autonomous Drone Swarm" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Description</label>
              <textarea id="new-proj-desc" required rows="3" placeholder="What are you building and who are you looking to recruit?" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500"></textarea>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Visibility</label>
              <select id="new-proj-vis" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500">
                <option value="PUBLIC">Public (Visible in explore feed)</option>
                <option value="PRIVATE">Private (Invite & direct link only)</option>
              </select>
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-2">Domain Tags (Click to select)</label>
              <div class="flex flex-wrap gap-2" id="create-tags-container">
                \${domainTags.map(t => \`
                  <button type="button" onclick="toggleCreateTag('\${t}', this)" class="px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">\${t}</button>
                \`).join('')}
              </div>
            </div>
            <div class="flex gap-3 pt-4">
              <button type="button" onclick="navigate('explore')" class="px-4 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium">Cancel</button>
              <button type="submit" class="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/30">Create Project</button>
            </div>
          </form>
        </div>
      \`;
    }

    let selectedCreateTags = [];
    function toggleCreateTag(tag, btn) {
      if (selectedCreateTags.includes(tag)) {
        selectedCreateTags = selectedCreateTags.filter(t => t !== tag);
        btn.className = 'px-2.5 py-1 rounded-full text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700';
      } else {
        selectedCreateTags.push(tag);
        btn.className = 'px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-600 text-white border border-indigo-500';
      }
    }

    async function submitNewProject(e) {
      e.preventDefault();
      const name = document.getElementById('new-proj-name').value.trim();
      const description = document.getElementById('new-proj-desc').value.trim();
      const visibility = document.getElementById('new-proj-vis').value;

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, visibility, tags: selectedCreateTags })
      });
      const data = await res.json();
      if (res.ok) {
        showToast('Project created successfully!');
        selectedCreateTags = [];
        navigate('project', data.project.id);
      } else {
        showToast(data.error || 'Failed to create', true);
      }
    }

    // --- 4. GLOBAL CHAT VIEW ---
    async function renderGlobalChatView() {
      const root = document.getElementById('app-root');
      root.innerHTML = \`
        <div class="max-w-4xl mx-auto space-y-4">
          <div class="flex items-center justify-between">
            <div>
              <h1 class="text-2xl font-bold text-gray-100">Global Community Chat</h1>
              <p class="text-xs text-gray-400">Live platform-wide chat for makers & developers</p>
            </div>
            <div class="flex items-center gap-1.5 text-xs text-green-400 bg-green-500/10 border border-green-500/30 px-2.5 py-1 rounded-full">
              <span class="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Live
            </div>
          </div>
          <div class="glass-card flex flex-col h-[560px]">
            <div id="global-chat-messages" class="flex-1 overflow-y-auto p-4 space-y-3">Loading global chat...</div>
            <form onsubmit="sendGlobalMessage(event)" class="p-3 border-t border-gray-800 flex gap-2">
              <input id="global-msg-input" placeholder="\${currentUser ? 'Share something with the whole community...' : 'Sign in to participate...'}" \${!currentUser ? 'disabled' : ''} class="flex-1 px-3.5 py-2 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500 disabled:opacity-50" />
              <button type="submit" \${!currentUser ? 'disabled' : ''} class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium disabled:opacity-50">Send</button>
            </form>
          </div>
        </div>
      \`;
      loadGlobalChat();
    }

    async function loadGlobalChat() {
      const res = await fetch('/api/global-chat');
      const data = await res.json();
      renderChatMessages('global-chat-messages', data.messages || []);
    }

    async function sendGlobalMessage(e) {
      e.preventDefault();
      if (!currentUser) return;
      const input = document.getElementById('global-msg-input');
      const content = input.value.trim();
      if (!content) return;
      input.value = '';
      await fetch('/api/global-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      loadGlobalChat();
    }

    // --- 5. PROFILE VIEW ---
    async function renderProfileView(userId) {
      const root = document.getElementById('app-root');
      root.innerHTML = '<div class="text-center py-20 text-gray-500">Loading profile...</div>';
      const res = await fetch('/api/users/' + userId);
      if (!res.ok) {
        root.innerHTML = '<div class="text-center py-20 text-red-400">User not found</div>';
        return;
      }
      const { user } = await res.json();
      const isMe = currentUser && currentUser.id === user.id;

      root.innerHTML = \`
        <div class="max-w-3xl mx-auto space-y-6">
          <div class="glass-card p-6 space-y-4">
            <div class="flex items-start justify-between">
              <div class="flex items-center gap-4">
                <div class="w-16 h-16 rounded-2xl bg-indigo-600 font-bold text-2xl text-white flex items-center justify-center shadow-lg shadow-indigo-600/30">\${user.name.slice(0, 1).toUpperCase()}</div>
                <div>
                  <h1 class="text-2xl font-bold text-gray-100">\${escapeHtml(user.name)}</h1>
                  \${user.school ? \`<div class="text-sm text-indigo-400">🎓 \${escapeHtml(user.school)}</div>\` : ''}
                </div>
              </div>
              \${isMe ? \`<button onclick="editProfileModal()" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium border border-gray-700">Edit Profile</button>\` : ''}
            </div>
            \${user.bio ? \`<p class="text-sm text-gray-300 pt-2">\${escapeHtml(user.bio)}</p>\` : '<p class="text-xs text-gray-500 italic">No bio provided yet.</p>'}
            \${user.skills && user.skills.length > 0 ? \`
              <div class="flex flex-wrap gap-1.5 pt-2">
                \${user.skills.map(s => \`<span class="px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 border border-gray-700 text-gray-300">\${s}</span>\`).join('')}
              </div>
            \` : ''}
          </div>

          <!-- Projects worked on -->
          <div class="glass-card p-6 space-y-4">
            <h3 class="font-semibold text-gray-200 text-base">Projects (\${user.projects ? user.projects.length : 0})</h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              \${user.projects && user.projects.length > 0 ? user.projects.map(p => \`
                <div onclick="navigate('project', '\${p.id}')" class="p-4 bg-gray-900 border border-gray-800 rounded-xl hover:border-indigo-500/40 cursor-pointer transition-all">
                  <div class="font-medium text-gray-200 text-sm mb-1">\${escapeHtml(p.name)}</div>
                  <div class="text-xs text-gray-500 line-clamp-2">\${escapeHtml(p.description)}</div>
                </div>
              \`).join('') : '<div class="text-gray-500 text-xs col-span-full">No public projects yet.</div>'}
            </div>
          </div>
        </div>
      \`;
    }

    function editProfileModal() {
      const bio = prompt("Update bio:", currentUser.bio || "");
      if (bio === null) return;
      const school = prompt("Update school / institution:", currentUser.school || "");
      fetch('/api/users/' + currentUser.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bio, school })
      }).then(async () => {
        await checkAuth();
        renderProfileView(currentUser.id);
      });
    }

    // --- 6. AUTH VIEWS (LOGIN / REGISTER) ---
    function renderLoginView() {
      const root = document.getElementById('app-root');
      root.innerHTML = \`
        <div class="max-w-md mx-auto glass-card p-8 space-y-6">
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-100">Welcome Back</h1>
            <p class="text-gray-400 text-xs mt-1">Sign in to your Pronnect local account</p>
          </div>
          <form onsubmit="handleLogin(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Email</label>
              <input id="login-email" type="email" required value="alex@example.com" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Password</label>
              <input id="login-password" type="password" required value="password123" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/30">Sign In</button>
          </form>
          <div class="text-center text-xs text-gray-400">
            Don't have an account? <button onclick="navigate('register')" class="text-indigo-400 font-medium hover:underline">Sign up</button>
          </div>
        </div>
      \`;
    }

    async function handleLogin(e) {
      e.preventDefault();
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok) {
        currentUser = data.user;
        renderNavAuth();
        showToast('Welcome back, ' + currentUser.name + '!');
        navigate('explore');
      } else {
        showToast(data.error || 'Login failed', true);
      }
    }

    function renderRegisterView() {
      const root = document.getElementById('app-root');
      root.innerHTML = \`
        <div class="max-w-md mx-auto glass-card p-8 space-y-6">
          <div class="text-center">
            <h1 class="text-2xl font-bold text-gray-100">Create an Account</h1>
            <p class="text-gray-400 text-xs mt-1">Start collaborating with makers locally</p>
          </div>
          <form onsubmit="handleRegister(event)" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Full Name</label>
              <input id="reg-name" required placeholder="Alex Rivera" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Email</label>
              <input id="reg-email" type="email" required placeholder="alex@example.com" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">Password</label>
              <input id="reg-password" type="password" required placeholder="••••••••" class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <div>
              <label class="block text-xs font-medium text-gray-300 mb-1">School / College</label>
              <input id="reg-school" placeholder="MIT, Stanford, etc." class="w-full px-3.5 py-2.5 bg-gray-900 border border-gray-700 rounded-lg text-sm text-gray-100 focus:outline-none focus:border-indigo-500" />
            </div>
            <button type="submit" class="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-medium shadow-lg shadow-indigo-600/30">Create Account</button>
          </form>
          <div class="text-center text-xs text-gray-400">
            Already have an account? <button onclick="navigate('login')" class="text-indigo-400 font-medium hover:underline">Sign in</button>
          </div>
        </div>
      \`;
    }

    async function handleRegister(e) {
      e.preventDefault();
      const name = document.getElementById('reg-name').value;
      const email = document.getElementById('reg-email').value;
      const password = document.getElementById('reg-password').value;
      const school = document.getElementById('reg-school').value;

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, school })
      });
      const data = await res.json();
      if (res.ok) {
        currentUser = data.user;
        renderNavAuth();
        showToast('Account created!');
        navigate('explore');
      } else {
        showToast(data.error || 'Registration failed', true);
      }
    }

    function escapeHtml(str) {
      if (!str) return '';
      return String(str).replace(/[&<>"']/g, function(m) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
      });
    }

    // Start App
    init();
  </script>
</body>
</html>`;
}

// Start standalone server
loadDB();
server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Pronnect Standalone Server running WITHOUT npm!`);
  console.log(`👉 Open: http://localhost:${PORT}`);
  console.log(`======================================================\n`);
});
