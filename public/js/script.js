/* ───── constants ───── */
const MIN_SEC = 1;
const NATIONWIDE = "Across the country";
const DEBUG = true; // Set to true for debugging
const MAX_RETRIES = 3;
const FETCH_TIMEOUT = 10000;

/* categories we still create check-boxes for by default */
const DEFAULT_CATS = {
  1: "Missiles",
  2: "Hostile aircraft",
  14: "Flash",
  13: "Update",
};

const CATEGORY_ICONS = {
  1: "🚀",
  2: "✈️",
  14: "⚡",
  13: "📢",
};

// New: Define sound files for each category
const CATEGORY_SOUNDS = {
  1: "audio/missiles.mp3",
  2: "audio/hostileAircraft.mp3",
  14: "audio/flash.mp3",
  13: "audio/update.mp3",
};

// NEW: Define sound durations for each category (in milliseconds)
const CATEGORY_SOUND_DURATIONS = {
  1: 30000, // Missiles: 30 seconds
  2: 30000, // Hostile aircraft: 30 seconds
  14: 30000, // Flash: 30 seconds
  13: 5000, // Update: 5 seconds
};

/* ───── elements ───── */
const categoryGrid = document.getElementById("categoryGrid");
const log = document.getElementById("log");
const last = document.getElementById("lastLbl");

const cityIn = document.getElementById("cityIn");
const intervalIn = document.getElementById("intervalIn");
const lookbackIn = document.getElementById("lookbackIn");
const histSel = document.getElementById("histSel");
const sortBtn = document.getElementById("sortBtn");
const autoBtn = document.getElementById("autoBtn");
const darkModeToggle = document.getElementById("darkModeToggle");

// New: References to dropdown elements and stop button
const testSoundDropdownBtn = document.getElementById("testSoundDropdownBtn");
const testSoundDropdownContent = document.getElementById(
  "testSoundDropdownContent"
);
const stopSirenBtn = document.getElementById("stopSirenBtn");

/* ───── state ───── */
let city = cityIn.value.trim();
let pollMs = +intervalIn.value * 1000;
let lookBackMs = +lookbackIn.value * 1000;
let histRange = histSel.value;
let sortDesc = true;
let autoOn = true;
let timerID = null;
let alarmTO = null;
let isDarkMode = false;
let currentAudio = null; // To keep track of the currently playing audio element
let isPolling = false; // NEW: Prevent overlapping polls
let audioQueue = []; // NEW: Queue for audio playback
let pausePollingUntil = null; // NEW: Pause polling when alert is playing
let alertsSoundPlayed = new Set(); // NEW: Track which alerts we've already played sounds for

let seen = new Set();
let cats = new Map();

/* ───── helpers ───── */
const pad = (n) => n.toString().padStart(2, "0");
const api = (c) =>
  `/api/history?city=${encodeURIComponent(
    c
  )}&range=${histRange}&ts=${Date.now()}`;
const cls = (c) => `cat-${c}`;

// NEW: Debug logging function
function debugLog(message, data = null) {
  if (DEBUG) {
    console.log(`[DEBUG ${new Date().toISOString()}] ${message}`, data);
  }
}

// NEW: Safe localStorage wrapper
function safeLocalStorage(key, value) {
  try {
    if (value !== undefined) {
      localStorage.setItem(key, value);
      return value;
    }
    return localStorage.getItem(key);
  } catch (e) {
    console.warn("localStorage not available:", e);
    return null;
  }
}

// NEW: Fetch with retry and timeout
async function fetchWithRetry(url, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      debugLog(`Fetch attempt ${i + 1} for: ${url}`);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);

      const response = await fetch(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: "https://alerts-history.oref.org.il/",
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      debugLog(`Fetch successful, got ${data.length} items`);
      return data;
    } catch (error) {
      console.error(`Fetch attempt ${i + 1} failed:`, error.message);
      if (i === retries - 1) throw error;

      // Exponential backoff
      const delay = 1000 * Math.pow(2, i);
      debugLog(`Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

function resetUI() {
  categoryGrid.innerHTML = "";
  seen.clear();
  cats.clear();
  log.innerHTML =
    '<div class="empty-state"><div class="empty-state-icon">📭</div><p>No alerts yet. Monitoring in progress...</p></div>';

  // Clear test sound dropdown
  testSoundDropdownContent.innerHTML = "";

  // NEW: Reset all alert tracking when UI resets
  pausePollingUntil = null;
  alertsSoundPlayed.clear();

  debugLog("UI reset complete");
}

/* ───── polling (chosen city + nationwide) ───── */
async function poll() {
  // NEW: Check if polling is paused due to alert sound
  const now = Date.now();
  if (pausePollingUntil && now < pausePollingUntil) {
    debugLog(
      `Polling paused until ${new Date(
        pausePollingUntil
      ).toLocaleTimeString()}, skipping...`
    );
    if (autoOn) timerID = setTimeout(poll, 1000); // Check again in 1 second
    return;
  }

  // Clear pause when time is up
  if (pausePollingUntil && now >= pausePollingUntil) {
    pausePollingUntil = null;
    debugLog("Polling pause expired, resuming normal polling");
  }

  // NEW: Prevent overlapping polls
  if (isPolling) {
    debugLog("Poll already in progress, skipping...");
    return;
  }

  isPolling = true;
  clearTimeout(timerID);

  try {
    debugLog(`Starting poll for city: ${city}, range: ${histRange}`);

    const [loc, nat] = await Promise.allSettled([
      fetchWithRetry(api(city)),
      fetchWithRetry(api(NATIONWIDE)),
    ]);

    // Handle fetch results with better error checking
    const locData = loc.status === "fulfilled" ? loc.value : [];
    const natData = nat.status === "fulfilled" ? nat.value : [];

    if (loc.status === "rejected") {
      console.error("Local alerts fetch failed:", loc.reason.message);
    }
    if (nat.status === "rejected") {
      console.error("Nationwide alerts fetch failed:", nat.reason.message);
    }

    const data = [...locData, ...natData.map((a) => ({ ...a, nw: true }))];

    debugLog(`Total alerts received: ${data.length}`);

    /* inject default check-boxes if missing and populate dropdown */
    Object.entries(DEFAULT_CATS).forEach(([cat, desc]) => {
      addCatBox(+cat, desc);
    });

    // Remove empty state if we have data
    if (data.length > 0 && log.querySelector(".empty-state")) {
      log.innerHTML = "";
    }

    // NEW: Improved alert filtering with atomic operations
    const newAlerts = [];
    data.forEach((a) => {
      try {
        // Validate alert data
        if (!a.alertDate || !a.category) {
          debugLog("Invalid alert data:", a);
          return;
        }

        const id = `${a.alertDate}-${a.category}${a.nw ? "N" : ""}`;
        if (!seen.has(id)) {
          seen.add(id);
          newAlerts.push(a);
          debugLog(`New alert: ${id}`);
        }
      } catch (error) {
        console.error("Error processing alert:", a, error);
      }
    });

    debugLog(`New alerts to process: ${newAlerts.length}`);

    // Render new alerts (order will be fixed by sortLogEntries)
    newAlerts.forEach(renderRow);

    // NEW: Sort all alerts in the log after adding new ones
    sortLogEntries();

    // NEW: Clean up sound tracking if it gets too large (prevent memory leaks)
    if (alertsSoundPlayed.size > 100) {
      alertsSoundPlayed.clear();
      debugLog("Cleared sound tracking cache (too many entries)");
    }

    /* NEW: Simple fresh alert detection */
    const freshAlerts = data.filter((a) => {
      try {
        const alertTime = new Date(a.alertDate).getTime();
        if (isNaN(alertTime)) {
          debugLog("Invalid alert date:", a.alertDate);
          return false;
        }

        const fresh = now - alertTime <= lookBackMs;
        const categoryInfo = cats.get(a.category);
        const enabled = categoryInfo?.cb?.checked ?? false;

        debugLog(`Alert ${a.alertDate}: fresh=${fresh}, enabled=${enabled}`);
        return fresh && enabled;
      } catch (error) {
        console.error("Error checking fresh alert:", a, error);
        return false;
      }
    });

    debugLog(`Fresh alerts found: ${freshAlerts.length}`);

    if (freshAlerts.length > 0) {
      // Sort ALL alerts by date (newest first) and take ONLY the newest one
      const newestAlert = freshAlerts.sort(
        (a, b) => new Date(b.alertDate) - new Date(a.alertDate)
      )[0];

      const soundFile = CATEGORY_SOUNDS[newestAlert.category];
      const duration = CATEGORY_SOUND_DURATIONS[newestAlert.category] || 30000;
      const alertSoundId = `${newestAlert.alertDate}-${newestAlert.category}${
        newestAlert.nw ? "N" : ""
      }`;

      // Only play sound if we haven't already played it for this specific alert
      if (!alertsSoundPlayed.has(alertSoundId)) {
        debugLog(
          `Playing sound for THE NEWEST alert ${alertSoundId}: ${soundFile} for ${duration}ms`
        );
        debugLog(`Ignoring ${freshAlerts.length - 1} older fresh alerts`);

        alertsSoundPlayed.add(alertSoundId);
        pausePollingUntil = now + duration;
        debugLog(
          `Pausing polling until ${new Date(
            pausePollingUntil
          ).toLocaleTimeString()}`
        );

        await playSound(soundFile, duration);
      } else {
        debugLog(
          `Already played sound for newest alert ${alertSoundId}, skipping`
        );
      }
    }

    last.textContent = new Date().toLocaleTimeString("he-IL", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch (e) {
    console.error("Poll error:", e);
  } finally {
    isPolling = false;
    if (autoOn) {
      // NEW: Use shorter interval when polling is paused to check more frequently
      const nextPollInterval =
        pausePollingUntil && now < pausePollingUntil ? 1000 : pollMs;
      timerID = setTimeout(poll, nextPollInterval);
      debugLog(`Next poll scheduled in ${nextPollInterval}ms`);
    }
  }
}

/* ───── rendering ───── */
function renderRow(a) {
  try {
    const d = new Date(a.alertDate);
    if (isNaN(d.getTime())) {
      console.error("Invalid date for alert:", a);
      return;
    }

    const ts = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(
      d.getHours()
    )}:${pad(d.getMinutes())}`;

    const row = document.createElement("div");
    row.dataset.time = d.getTime();
    row.dataset.cat = a.category;
    row.className = `alert ${cls(a.category)}`;

    const icon = CATEGORY_ICONS[a.category] || "🔔";

    // NEW: Use "Across the country" as category text for nationwide alerts
    const categoryText = a.nw
      ? "Across the country"
      : a.category_desc || "Unknown";

    row.innerHTML = `
      <div class="alert-icon">${icon}</div>
      <div class="alert-content">
        <div class="alert-header">
          <span class="alert-time">${ts}</span>
          <span class="alert-category">${categoryText}</span>
        </div>
      </div>
    `;

    const categoryInfo = cats.get(a.category);
    if (!categoryInfo?.cb?.checked) {
      row.classList.add("hidden");
    }

    // NEW: Always append and let the batch sorting handle order
    log.append(row);

    debugLog(`Rendered alert: ${a.alertDate} - ${categoryText}`);
  } catch (error) {
    console.error("Error rendering alert:", a, error);
  }
}

function addCatBox(cat, desc) {
  // NEW: Prevent duplicate categories
  if (cats.has(cat)) {
    debugLog(`Category ${cat} already exists`);
    return;
  }

  try {
    const cb = Object.assign(document.createElement("input"), {
      type: "checkbox",
      checked: true,
      id: `cat-${cat}`,
    });

    cb.onchange = () =>
      log.querySelectorAll(".alert").forEach((el) => {
        const elCat = +el.dataset.cat;
        const categoryInfo = cats.get(elCat);
        if (categoryInfo) {
          el.classList.toggle("hidden", !categoryInfo.cb.checked);
        }
      });

    const label = document.createElement("label");
    label.className = "category-checkbox";
    label.htmlFor = `cat-${cat}`;
    label.innerHTML = `
      <input type="checkbox" id="cat-${cat}" checked>
      <span style="font-weight: 400;">${
        CATEGORY_ICONS[cat] || "🔔"
      } ${desc}</span>
    `;

    // Replace the checkbox with the actual one
    label.replaceChild(cb, label.querySelector("input"));

    categoryGrid.appendChild(label);
    cats.set(cat, { desc, cb });

    // Ensure test button exists
    createTestSoundButton(cat, desc);

    debugLog(`Added category: ${cat} - ${desc}`);
  } catch (error) {
    console.error("Error adding category box:", cat, desc, error);
  }
}

// NEW: Function to create individual test sound buttons for the dropdown
function createTestSoundButton(cat, desc) {
  // Prevent duplicates
  if (document.getElementById(`test-${cat}`)) {
    return;
  }

  try {
    const button = document.createElement("button");
    button.id = `test-${cat}`;
    button.className = `cat-${cat}`; // Apply category class for coloring
    button.innerHTML = `<span class="icon">${
      CATEGORY_ICONS[cat] || "🔔"
    }</span> ${desc}`;

    button.onclick = async () => {
      const soundFile = CATEGORY_SOUNDS[cat];
      const duration = CATEGORY_SOUND_DURATIONS[cat] || 30000;

      debugLog(
        `Testing sound for category ${cat}: ${soundFile} for ${duration}ms`
      );

      // NEW: Don't pause polling for test sounds
      await playSound(soundFile, duration);
      testSoundDropdownContent.parentElement.classList.remove("active");
    };

    testSoundDropdownContent.appendChild(button);
    debugLog(`Created test button for category: ${cat}`);
  } catch (error) {
    console.error("Error creating test sound button:", cat, desc, error);
  }
}

/* ───── NEW: Improved audio management ───── */
async function playSound(soundFile, duration = 30000) {
  try {
    debugLog(`Attempting to play sound: ${soundFile} for ${duration}ms`);

    // Stop any currently playing sound
    await stopSound();

    return new Promise((resolve) => {
      // Wait a frame to ensure cleanup is complete
      requestAnimationFrame(() => {
        try {
          currentAudio = new Audio(soundFile);
          currentAudio.loop = true;
          currentAudio.currentTime = 0;

          const onCanPlay = () => {
            currentAudio
              .play()
              .then(() => {
                debugLog(`Successfully started playing: ${soundFile}`);
                resolve();
              })
              .catch((error) => {
                console.error(`Error playing audio: ${soundFile}`, error);
                resolve();
              });
          };

          const onError = (error) => {
            console.error(`Failed to load audio: ${soundFile}`, error);
            resolve();
          };

          currentAudio.addEventListener("canplay", onCanPlay, { once: true });
          currentAudio.addEventListener("error", onError, { once: true });

          // Set a timeout to stop the sound after the specified duration
          alarmTO = setTimeout(async () => {
            debugLog(`Auto-stopping sound after ${duration}ms`);
            await stopSound();
          }, duration);
        } catch (error) {
          console.error("Error creating audio element:", error);
          resolve();
        }
      });
    });
  } catch (error) {
    console.error("Error in playSound:", error);
  }
}

async function stopSound() {
  return new Promise((resolve) => {
    try {
      if (currentAudio) {
        debugLog("Stopping current audio");
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio.removeEventListener("canplay", () => {});
        currentAudio.removeEventListener("error", () => {});
        currentAudio = null;
      }

      if (alarmTO) {
        clearTimeout(alarmTO);
        alarmTO = null;
      }

      // Use requestAnimationFrame to ensure cleanup is complete
      requestAnimationFrame(() => {
        resolve();
      });
    } catch (error) {
      console.error("Error stopping sound:", error);
      resolve();
    }
  });
}

/* ───── controls ───── */
// NEW: Extract sorting logic into reusable function
function sortLogEntries() {
  const rows = [...log.children]
    .filter((el) => !el.classList.contains("empty-state") && el.dataset.time)
    .sort((a, b) =>
      sortDesc
        ? b.dataset.time - a.dataset.time
        : a.dataset.time - b.dataset.time
    );

  if (rows.length > 0) {
    // Clear and re-add in correct order
    const emptyState = log.querySelector(".empty-state");
    log.innerHTML = "";
    if (emptyState && rows.length === 0) {
      log.appendChild(emptyState);
    } else {
      rows.forEach((row) => log.appendChild(row));
    }
  }

  debugLog(
    `Sorted ${rows.length} alerts: ${sortDesc ? "descending" : "ascending"}`
  );
}

sortBtn.onclick = () => {
  sortDesc = !sortDesc;
  sortBtn.innerHTML = sortDesc
    ? "<span>Sort</span><span>↓</span>"
    : "<span>Sort</span><span>↑</span>";

  sortLogEntries();
};

autoBtn.onclick = () => {
  autoOn = !autoOn;
  autoBtn.innerHTML = autoOn ? "⏸️ Pause Updates" : "▶️ Resume Updates";
  autoBtn.classList.toggle("btn-primary", autoOn);
  autoBtn.classList.toggle("btn-secondary", !autoOn);

  if (autoOn) {
    debugLog("Resuming automatic updates");
    poll();
  } else {
    debugLog("Pausing automatic updates");
    clearTimeout(timerID);
  }
};

stopSirenBtn.onclick = async () => {
  debugLog("Manual sound stop requested");
  pausePollingUntil = null; // Resume polling immediately
  await stopSound();
};

// Dropdown toggle functionality - Click to open, smooth interaction
testSoundDropdownBtn.onclick = (event) => {
  event.stopPropagation();
  const dropdown = testSoundDropdownContent.parentElement;
  dropdown.classList.toggle("active");
};

// Prevent dropdown from closing when clicking inside it
testSoundDropdownContent.onclick = (event) => {
  event.stopPropagation();
};

// Close the dropdown only when clicking outside the entire dropdown area
document.addEventListener("click", (event) => {
  const dropdown = testSoundDropdownContent.parentElement;
  if (
    dropdown.classList.contains("active") &&
    !dropdown.contains(event.target)
  ) {
    dropdown.classList.remove("active");
  }
});

intervalIn.onchange = () => {
  const v = Math.max(MIN_SEC, +intervalIn.value);
  intervalIn.value = v;
  pollMs = v * 1000;
  debugLog(`Poll interval changed to: ${pollMs}ms`);
  if (autoOn) poll();
};

lookbackIn.onchange = () => {
  const v = Math.max(MIN_SEC, +lookbackIn.value);
  lookbackIn.value = v;
  lookBackMs = v * 1000;
  debugLog(`Lookback time changed to: ${lookBackMs}ms`);
};

histSel.onchange = () => {
  histRange = histSel.value;
  debugLog(`History range changed to: ${histRange}`);
  resetUI();
  // Repopulate default categories and test buttons
  Object.entries(DEFAULT_CATS).forEach(([cat, desc]) => {
    addCatBox(+cat, desc);
  });
  poll();
};

cityIn.onchange = () => {
  const c = cityIn.value.trim();
  if (!c) return;
  city = c;
  debugLog(`City changed to: ${city}`);
  resetUI();
  // Repopulate default categories and test buttons
  Object.entries(DEFAULT_CATS).forEach(([cat, desc]) => {
    addCatBox(+cat, desc);
  });
  poll();
};

/* ───── Dark Mode Toggle with improved localStorage ───── */
function toggleDarkMode() {
  isDarkMode = !isDarkMode;
  document.body.classList.toggle("dark-mode", isDarkMode);
  darkModeToggle.innerHTML = isDarkMode ? "🌙" : "☀️";
  // Store user preference safely
  safeLocalStorage("darkMode", isDarkMode.toString());
  debugLog(`Dark mode: ${isDarkMode ? "enabled" : "disabled"}`);
}

// Check for user preference on load
document.addEventListener("DOMContentLoaded", () => {
  const savedDarkMode = safeLocalStorage("darkMode");
  if (savedDarkMode === "true") {
    isDarkMode = true;
    document.body.classList.add("dark-mode");
    darkModeToggle.innerHTML = "🌙";
  } else {
    isDarkMode = false;
    document.body.classList.remove("dark-mode");
    darkModeToggle.innerHTML = "☀️";
  }

  // Initial population of categories and test sound buttons
  Object.entries(DEFAULT_CATS).forEach(([cat, desc]) => {
    addCatBox(+cat, desc);
  });

  debugLog("DOM loaded, starting initial poll");
});

darkModeToggle.onclick = toggleDarkMode;

/* ───── boot ───── */
debugLog("Starting oref alert system");
poll();
