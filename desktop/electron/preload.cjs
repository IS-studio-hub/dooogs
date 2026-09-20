const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("dooogs", {
  getStatus: () => ipcRenderer.invoke("app:getStatus"),
  sendChat: (payload) => ipcRenderer.invoke("chat:send", payload),
  respondPermission: (payload) => ipcRenderer.invoke("permission:respond", payload),
  reconnectMcp: () => ipcRenderer.invoke("mcp:reconnect"),
  onPermission: (cb) => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on("permission:request", handler);
    return () => ipcRenderer.removeListener("permission:request", handler);
  },
});
