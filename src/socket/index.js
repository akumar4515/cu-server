const { v4: uuidv4 } = require("uuid");
const DeviceRegistry = require("../utils/deviceRegistry");

function setupSocket(io) {
  const registry = new DeviceRegistry();
  setupSocket._registry = registry; // expose for HTTP routes

  const viewersByDevice = new Map();
  const viewerCurrentDevice = new Map();

  const emitDeviceList = () => {
    io.emit("devices:list", registry.list());
  };

  io.on("connection", (socket) => {
    socket.emit("devices:list", registry.list());

    socket.on("sender:debug", (payload = {}) => {
      try {
        const meta = {
          from: socket.id,
          deviceId: socket.data?.deviceId || payload?.deviceId || null
        };
        // eslint-disable-next-line no-console
        console.log("[sender:debug]", { ...meta, ...payload });
      } catch (_) {
        // ignore
      }
    });

    socket.on("sender:register", ({ deviceId, hostname } = {}, ack) => {
      const safeDeviceId =
        typeof deviceId === "string" && deviceId.trim() ? deviceId.trim() : uuidv4();
      const safeHostname =
        typeof hostname === "string" && hostname.trim() ? hostname.trim() : "Unknown Device";

      const device = registry.addOrUpdateDevice({
        deviceId: safeDeviceId,
        hostname: safeHostname,
        senderSocketId: socket.id
      });

      socket.data.role = "sender";
      socket.data.deviceId = safeDeviceId;

      emitDeviceList();

      if (typeof ack === "function") {
        ack({ ok: true, device });
      }
    });

    socket.on("sender:stream-status", ({ isStreaming, deviceId } = {}) => {
      const id = deviceId || socket.data.deviceId;
    
      if (!id) {
        console.log("❌ No deviceId");
        return;
      }
    
      console.log("🔥 STREAM UPDATE:", id, isStreaming);
    
      registry.updateStreamingStatus(id, Boolean(isStreaming));
      emitDeviceList();
    });

    socket.on("sender:heartbeat", ({ deviceId } = {}) => {
      const id = typeof deviceId === "string" && deviceId.trim() ? deviceId.trim() : socket.data.deviceId;
      if (!id) return;
      const existing = registry.getById(id);
      if (!existing) return;
      // Touch lastSeenAt by updating a benign field
      registry.setViewerCount(id, existing.viewerCount || 0);
      emitDeviceList();
    });

    socket.on("viewer:get-devices", (_, ack) => {
      const devices = registry.list();
      if (typeof ack === "function") {
        ack({ ok: true, devices });
      } else {
        socket.emit("devices:list", devices);
      }
    });

    socket.on("viewer:watch-device", ({ deviceId } = {}, ack) => {
      const device = registry.getById(deviceId);
      if (!device) {
        if (typeof ack === "function") ack({ ok: false, error: "Device not found" });
        return;
      }

      const prevDeviceId = viewerCurrentDevice.get(socket.id);
      if (prevDeviceId && viewersByDevice.has(prevDeviceId)) {
        viewersByDevice.get(prevDeviceId).delete(socket.id);
        const nextCount = viewersByDevice.get(prevDeviceId).size;
        registry.setViewerCount(prevDeviceId, nextCount);
      }

      if (!viewersByDevice.has(deviceId)) {
        viewersByDevice.set(deviceId, new Set());
      }

      viewersByDevice.get(deviceId).add(socket.id);
      viewerCurrentDevice.set(socket.id, deviceId);
      registry.setViewerCount(deviceId, viewersByDevice.get(deviceId).size);

      io.to(device.senderSocketId).emit("viewer:joined", {
        viewerSocketId: socket.id,
        deviceId
      });

      emitDeviceList();

      if (typeof ack === "function") {
        ack({ ok: true, deviceId });
      }
    });

    socket.on("webrtc:offer", ({ to, sdp } = {}) => {
      if (!to || !sdp) return;
      io.to(to).emit("webrtc:offer", { from: socket.id, sdp });
    });

    socket.on("webrtc:answer", ({ to, sdp } = {}) => {
      if (!to || !sdp) return;
      io.to(to).emit("webrtc:answer", { from: socket.id, sdp });
    });

    socket.on("webrtc:ice-candidate", ({ to, candidate } = {}) => {
      if (!to || !candidate) return;
      io.to(to).emit("webrtc:ice-candidate", { from: socket.id, candidate });
    });

    socket.on("disconnect", () => {
      const removed = registry.removeBySenderSocketId(socket.id);
      if (removed) {
        const { deviceId } = removed;
        const viewers = viewersByDevice.get(deviceId) || new Set();

        for (const viewerSocketId of viewers) {
          io.to(viewerSocketId).emit("viewer:device-offline", { deviceId });
          viewerCurrentDevice.delete(viewerSocketId);
        }

        viewersByDevice.delete(deviceId);
        emitDeviceList();
      }

      const watchedDeviceId = viewerCurrentDevice.get(socket.id);
      if (watchedDeviceId && viewersByDevice.has(watchedDeviceId)) {
        viewersByDevice.get(watchedDeviceId).delete(socket.id);
        const nextCount = viewersByDevice.get(watchedDeviceId).size;
        registry.setViewerCount(watchedDeviceId, nextCount);
        viewerCurrentDevice.delete(socket.id);
        emitDeviceList();
      }
    });
  });
}

module.exports = setupSocket;
