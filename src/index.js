const http = require("http");
const express = require("express");
const cors = require("cors");
const { Server } = require("socket.io");

const config = require("./config/env");
const setupSocket = require("./socket");

const app = express();

app.use(
  cors({
    origin: config.clientOrigin === "*" ? true : config.clientOrigin,
    credentials: true
  })
);
app.use(express.json());

app.get("/health", (_, res) => {
  res.status(200).json({
    ok: true,
    service: "cu-server",
    env: config.nodeEnv,
    publicServerUrl: config.publicServerUrl || null,
    timestamp: new Date().toISOString()
  });
});

app.get("/api/devices", (_, res) => {
  const devices = setupSocket._registry ? setupSocket._registry.list() : [];
  res.status(200).json({ ok: true, count: devices.length, devices });
});

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: config.clientOrigin === "*" ? true : config.clientOrigin,
    methods: ["GET", "POST"],
    credentials: true
  }
});

setupSocket(io);

server.listen(config.port, () => {
  console.log(`[cu-server] listening on port ${config.port}`);
  if (config.publicServerUrl) {
    console.log(`[cu-server] public url: ${config.publicServerUrl}`);
  }
});
