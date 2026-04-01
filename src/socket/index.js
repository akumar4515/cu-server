const { v4: uuidv4 } = require("uuid");
const DeviceRegistry = require("../utils/deviceRegistry");

function setupSocket(io) {
  const registry = new DeviceRegistry();

  const viewersByDevice = new Map();
  const viewerCurrentDevice = new Map();

  const emitDeviceList = () => {
    io.emit("devices:list", registry.list());
  };

  io.on("connection", (socket) => {
    socket.emit("devices:list", registry.list());

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

    socket.on("sender:stream-status", ({ isStreaming } = {}) => {
      const deviceId = socket.data.deviceId;
      if (!deviceId) return;

      registry.updateStreamingStatus(deviceId, Boolean(isStreaming));
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
