class DeviceRegistry {
  constructor() {
    this.devices = new Map();
  }

  addOrUpdateDevice({ deviceId, hostname, senderSocketId }) {
    const existing = this.devices.get(deviceId);

    const next = {
      deviceId,
      hostname,
      senderSocketId,
      isStreaming: existing?.isStreaming ?? false,
      viewerCount: existing?.viewerCount ?? 0,
      lastSeenAt: Date.now()
    };

    this.devices.set(deviceId, next);
    return next;
  }

  removeBySenderSocketId(senderSocketId) {
    for (const [deviceId, device] of this.devices.entries()) {
      if (device.senderSocketId === senderSocketId) {
        this.devices.delete(deviceId);
        return { deviceId, device };
      }
    }
    return null;
  }

  getById(deviceId) {
    return this.devices.get(deviceId);
  }

  updateStreamingStatus(deviceId, isStreaming) {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    device.isStreaming = Boolean(isStreaming);
    device.lastSeenAt = Date.now();
    this.devices.set(deviceId, device);

    return device;
  }

  setViewerCount(deviceId, viewerCount) {
    const device = this.devices.get(deviceId);
    if (!device) return null;

    device.viewerCount = Math.max(0, viewerCount);
    device.lastSeenAt = Date.now();
    this.devices.set(deviceId, device);

    return device;
  }

  list() {
    return Array.from(this.devices.values())
      .sort((a, b) => a.hostname.localeCompare(b.hostname))
      .map((d) => ({
        deviceId: d.deviceId,
        hostname: d.hostname,
        isStreaming: d.isStreaming,
        viewerCount: d.viewerCount,
        lastSeenAt: d.lastSeenAt
      }));
  }
}

module.exports = DeviceRegistry;
