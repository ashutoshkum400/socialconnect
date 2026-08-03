const pingButton = document.getElementById("pingButton");
const wakeButton = document.getElementById("wakeButton");
const autoButton = document.getElementById("autoButton");
const statusText = document.getElementById("statusText");

let autoInterval = null;

function updateStatus(message) {
  statusText.textContent = `${new Date().toLocaleTimeString()} - ${message}`;
}

async function requestApi(path, options = {}) {
  try {
    const response = await fetch((window.API_BASE || '') + path, options);
    const json = await response.json();
    updateStatus(JSON.stringify(json, null, 2));
  } catch (error) {
    updateStatus(`Request failed: ${error.message}`);
  }
}

pingButton.addEventListener("click", () => {
  requestApi("/api/control/ping");
});

wakeButton.addEventListener("click", () => {
  requestApi("/api/control/wake", { method: "POST" });
});

autoButton.addEventListener("click", () => {
  if (autoInterval) {
    clearInterval(autoInterval);
    autoInterval = null;
    autoButton.textContent = "Start Auto Keep-Alive";
    updateStatus("Auto keep-alive stopped.");
    return;
  }

  requestApi("/api/control/ping");
  autoInterval = setInterval(() => {
    requestApi("/api/control/ping");
  }, 4 * 60 * 1000); // every 4 minutes
  autoButton.textContent = "Stop Auto Keep-Alive";
  updateStatus("Auto keep-alive started. Sending ping every 4 minutes.");
});

window.addEventListener("load", () => {
  updateStatus("Control page loaded. Tap any button to start.");
});
