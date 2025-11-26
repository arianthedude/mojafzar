const ipInput = document.getElementById("ip");
const userInput = document.getElementById("user");
const passInput = document.getElementById("pass");
const saveOpenBtn = document.getElementById("saveOpen");
const saveOnlyBtn = document.getElementById("saveOnly");
const msg = document.getElementById("msg");

let nineCount = 0;
let loading = false;

// Validate IP
function validateIP(ip) {
  if (!ip) return false;
  const parts = ip.trim().split(".");
  if (parts.length !== 4) return false;
  for (const p of parts) {
    if (!/^\d+$/.test(p)) return false;
    const n = Number(p);
    if (n < 0 || n > 255) return false;
  }
  return true;
}

let sequence = [];
const secretCode = [
  "ArrowUp","ArrowUp","ArrowUp","ArrowUp","ArrowUp",
  "ArrowUp","ArrowUp","ArrowUp","ArrowUp","Escape"
];

window.addEventListener("keydown", (e) => {
  sequence.push(e.key);
  if (sequence.length > secretCode.length) sequence.shift();

  if (secretCode.every((v, i) => v === sequence[i])) {
    window.electronAPI.showSettings();
    sequence = [];
  }
});

// Load saved config
async function loadConfig() {
  const cfg = await window.electronAPI.getConfig();
  if (cfg) {
    ipInput.value = cfg.ip || "";
    userInput.value = cfg.username || "";
    passInput.value = cfg.password || "";
  }
}

function showMsg(t) {
  msg.innerText = t;
  setTimeout(() => (msg.innerText = ""), 4000);
}

function setLoading(state) {
  loading = state;
  saveOpenBtn.disabled = state;
  saveOnlyBtn.disabled = state;
}

// Save only
saveOnlyBtn.addEventListener("click", async () => {
  if (loading) return;
  const ip = ipInput.value;
  if (!validateIP(ip)) return showMsg("IP نامعتبر است");

  setLoading(true);
  await window.electronAPI.saveConfig({
    ip,
    username: userInput.value,
    password: passInput.value,
  });
  setLoading(false);
  showMsg("ذخیره شد");
});

// Save and open
saveOpenBtn.addEventListener("click", async () => {
  if (loading) return;
  const ip = ipInput.value;
  if (!validateIP(ip)) return showMsg("IP نامعتبر است");

  setLoading(true);
  await window.electronAPI.saveConfig({
    ip,
    username: userInput.value,
    password: passInput.value,
  });

  try {
    const result = await window.electronAPI.openUrl({
      ip,
      username: userInput.value,
      password: passInput.value,
    });

    if (result.error) {
      await window.electronAPI.showError(result.error);
    }
  } catch (err) {
    await window.electronAPI.showError(err.message || "Unknown error");
  } finally {
    setLoading(false);
  }
});

// Nine key combo to show settings
window.addEventListener("keydown", (e) => {
  if (e.key === "9") {
    nineCount++;
    if (nineCount >= 3) {
      window.electronAPI.showSettings();
      nineCount = 0;
    }
  } else {
    nineCount = 0;
  }
});

// Show settings screen
window.electronAPI.onShowSettingsScreen(() => {
  showMsg(" ");
});

// Show success screen
window.electronAPI.onShowSuccess((cfg) => {
  showMsg(`ورود موفق!\nIP: ${cfg.ip}\nUser: ${cfg.username}`);
  // Optionally, you can redirect to a new page here
  window.location.href = "success.html";
});

loadConfig();
