
/* =========================================
   F1 HUB — COMPLETE APP.JS
   Jolpica + OpenF1
   ========================================= */

"use strict";

const API = "https://api.jolpi.ca/ergast/f1";
const OPENF1 = "https://api.openf1.org/v1";
const SEASON = "current";

const appView = document.getElementById("appView");

let raceRequest = 0;
let sessionRequest = 0;
let liveRequest = 0;
let sessionCache = [];

let currentSession = {
  year: new Date().getFullYear(),
  round: null,
  type: "R",
  race: null,
  openF1Session: null
};

const SESSION_TYPES = [
  { id: "FP1", label: "FP1" },
  { id: "FP2", label: "FP2" },
  { id: "FP3", label: "FP3" },
  { id: "Q1", label: "Q1" },
  { id: "Q2", label: "Q2" },
  { id: "Q3", label: "Q3" },
  { id: "SQ", label: "SPRINT QUALI" },
  { id: "S", label: "SPRINT" },
  { id: "R", label: "RACE" }
];

const OPENF1_SESSION_NAMES = {
  FP1: ["Practice 1"],
  FP2: ["Practice 2"],
  FP3: ["Practice 3"],
  Q1: ["Qualifying"],
  Q2: ["Qualifying"],
  Q3: ["Qualifying"],
  SQ: ["Sprint Qualifying", "Sprint Shootout"],
  S: ["Sprint"],
  R: ["Race"]
};

/* =========================================
   HELPERS
   ========================================= */

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

async function requestJSON(url) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15000
  );

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Request timed out. Please try again.");
    }

    throw error;

  } finally {
    clearTimeout(timeout);
  }
}

async function fetchF1(endpoint) {
  const separator = endpoint.includes("?") ? "&" : "?";

  return requestJSON(
    `${API}/${endpoint}.json${separator}limit=100`
  );
}

async function fetchOpenF1(endpoint, params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      query.set(key, value);
    }
  });

  return requestJSON(
    `${OPENF1}/${endpoint}?${query.toString()}`
  );
}

function getRaceList(data) {
  return data?.MRData?.RaceTable?.Races || [];
}

function getDriverName(driver) {
  if (!driver) return "Unknown";

  return (
    driver.name_acronym ||
    driver.code ||
    driver.full_name ||
    `${driver.givenName || driver.first_name || ""} ${
      driver.familyName || driver.last_name || ""
    }`.trim() ||
    "Unknown"
  );
}

function formatDate(date) {
  if (!date) return "-";

  return new Date(date + "T00:00:00").toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "short",
      year: "numeric"
    }
  );
}

function formatSeconds(seconds) {
  if (seconds === null || seconds === undefined) {
    return "-";
  }

  const value = Number(seconds);

  if (!Number.isFinite(value)) return "-";

  const minutes = Math.floor(value / 60);
  const remaining = (value % 60).toFixed(3);

  return minutes > 0
    ? `${minutes}:${remaining.padStart(6, "0")}`
    : remaining;
}

function normalizeName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/grand prix/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function showLoading(title) {
  appView.innerHTML = `
    <div class="panel">
      <h2>${escapeHTML(title)}</h2>
      <p class="status">⏳ Loading F1 data...</p>
    </div>
  `;
}

function showError(error) {
  appView.innerHTML = `
    <div class="panel">
      <h2>⚠️ CONNECTION ERROR</h2>
      <p class="error">${escapeHTML(error.message)}</p>

      <button class="action-btn"
        onclick="showDashboard('home')">
        BACK TO HOME
      </button>
    </div>
  `;
}

function emptyState(message) {
  return `
    <div class="empty-state">
      <h3>📭 NO DATA AVAILABLE</h3>
      <p>${escapeHTML(message)}</p>
    </div>
  `;
}

function getActiveSession() {
  return currentSession.openF1Session;
}

/* =========================================
   NAVIGATION
   ========================================= */

function showDashboard(page, button) {
  const aliases = {
    championship: "standings",
    standings: "standings",
    sessions: "sessions",
    live: "live",
    calendar: "calendar",
    home: "home"
  };

  page = aliases[page] || "home";

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  if (button) {
    button.classList.add("active");
  } else {
    const indexes = {
      home: 0,
      standings: 1,
      sessions: 2,
      live: 3
    };

    const buttons = document.querySelectorAll(".nav-btn");

    if (buttons[indexes[page]]) {
      buttons[indexes[page]].classList.add("active");
    }
  }

  if (page === "home") return loadHome();
  if (page === "standings") return loadStandings();
  if (page === "sessions") return loadSessions();
  if (page === "live") return loadLiveTiming();
  if (page === "calendar") return loadCalendar();

  return loadHome();
}

window.showDashboard = showDashboard;

/* =========================================
   HOME
   ========================================= */

async function loadHome() {
  const requestId = ++raceRequest;

  appView.innerHTML = `
    <div class="hero">
      <p class="muted">WELCOME TO YOUR PADDOCK</p>
      <h2>FORMULA 1<br>COMMAND CENTRE.</h2>
      <p>One place. Everything F1.</p>
    </div>

    <div class="panel">
      <h2>🏁 GRAND PRIX RESULTS</h2>

      <select id="gpSelect">
        <option>Loading races...</option>
      </select>

      <div id="selectedRaceResults"></div>
    </div>

    <div class="panel">
      <h2>🏆 CHAMPIONSHIP</h2>
      <button class="action-btn"
        onclick="showDashboard('championship')">
        VIEW STANDINGS →
      </button>
    </div>

    <div class="panel">
      <h2>⏱️ SESSION CENTRE</h2>
      <button class="action-btn"
        onclick="showDashboard('sessions')">
        OPEN SESSION CENTRE →
      </button>
    </div>

    <div class="panel">
      <h2>📡 LIVE TIMING</h2>
      <button class="action-btn"
        onclick="showDashboard('live')">
        OPEN LIVE TIMING →
      </button>
    </div>

    <div class="panel">
      <h2>📅 RACE CALENDAR</h2>
      <button class="action-btn"
        onclick="loadCalendar()">
        VIEW CALENDAR →
      </button>
    </div>
  `;

  try {
    const data = await fetchF1(`${SEASON}/races`);

    if (requestId !== raceRequest) return;

    const races = getRaceList(data);
    const selector = document.getElementById("gpSelect");

    if (!selector) return;

    if (!races.length) {
      selector.innerHTML = "<option>No races available</option>";
      return;
    }

    selector.innerHTML = races.map(race => `
      <option value="${escapeHTML(race.round)}">
        ROUND ${escapeHTML(race.round)} -
        ${escapeHTML(race.raceName)}
      </option>
    `).join("");

    selector.addEventListener("change", () => {
      loadRaceResults(selector.value);
    });

    const completed = races.filter(race =>
      race.date &&
      new Date(`${race.date}T23:59:59`) < new Date()
    );

    const selected = completed.length
      ? completed[completed.length - 1]
      : races[0];

    selector.value = selected.round;

    await loadRaceResults(selected.round);

  } catch (error) {
    if (requestId === raceRequest) showError(error);
  }
}

/* =========================================
   RACE RESULTS
   ========================================= */

async function loadRaceResults(round) {
  const container = document.getElementById(
    "selectedRaceResults"
  );

  if (!container) return;

  const requestId = ++raceRequest;

  container.innerHTML =
    '<p class="status">⏳ Loading classification...</p>';

  try {
    const data = await fetchF1(
      `${SEASON}/${round}/results`
    );

    if (requestId !== raceRequest) return;

    const race = getRaceList(data)[0];
    const results = race?.Results || [];

    if (!race || !results.length) {
      container.innerHTML = emptyState(
        "Race results have not been published yet."
      );
      return;
    }

    container.innerHTML = `
      <h3>${escapeHTML(race.raceName)}</h3>

      <p class="status">
        ${escapeHTML(race.Circuit?.circuitName)}
      </p>

      <p class="status">
        ${escapeHTML(formatDate(race.date))}
        • Round ${escapeHTML(race.round)}
      </p>

      <div style="overflow-x:auto;">
        <table>
          <tr>
            <th>POS</th>
            <th>GRID</th>
            <th>DRIVER</th>
            <th>TEAM</th>
            <th>LAPS</th>
            <th>STATUS</th>
            <th>PTS</th>
          </tr>

          ${results.map(driver => `
            <tr>
              <td class="position">
                ${escapeHTML(driver.positionText)}
              </td>
              <td>${escapeHTML(driver.grid)}</td>
              <td>
                <strong>${escapeHTML(getDriverName(driver.Driver))}</strong>
              </td>
              <td>${escapeHTML(driver.Constructor?.name)}</td>
              <td>${escapeHTML(driver.laps)}</td>
              <td>${escapeHTML(driver.status)}</td>
              <td>${escapeHTML(driver.points)}</td>
            </tr>
          `).join("")}
        </table>
      </div>
    `;

  } catch (error) {
    if (requestId !== raceRequest) return;

    container.innerHTML = `
      <p class="error">${escapeHTML(error.message)}</p>
    `;
  }
}

/* =========================================
   STANDINGS
   ========================================= */

async function loadStandings() {
  const requestId = ++raceRequest;

  showLoading("🏆 CHAMPIONSHIP STANDINGS");

  try {
    const [driverData, teamData] = await Promise.all([
      fetchF1(`${SEASON}/driverstandings`),
      fetchF1(`${SEASON}/constructorstandings`)
    ]);

    if (requestId !== raceRequest) return;

    const driverList =
      driverData.MRData?.StandingsTable
        ?.StandingsLists?.[0]?.DriverStandings || [];

    const teamList =
      teamData.MRData?.StandingsTable
        ?.StandingsLists?.[0]?.ConstructorStandings || [];

    appView.innerHTML = `
      <div class="panel">
        <h2>🏆 DRIVER CHAMPIONSHIP</h2>

        <div style="overflow-x:auto;">
          <table>
            <tr>
              <th>POS</th>
              <th>DRIVER</th>
              <th>TEAM</th>
              <th>PTS</th>
            </tr>

            ${driverList.map(driver => `
              <tr>
                <td class="position">${escapeHTML(driver.position)}</td>
                <td><strong>${escapeHTML(getDriverName(driver.Driver))}</strong></td>
                <td>${escapeHTML(driver.Constructors?.[0]?.name || "-")}</td>
                <td>${escapeHTML(driver.points)}</td>
              </tr>
            `).join("")}
          </table>
        </div>

        ${!driverList.length
          ? emptyState("No driver standings available.")
          : ""}
      </div>

      <div class="panel">
        <h2>🏎️ CONSTRUCTOR CHAMPIONSHIP</h2>

        <div style="overflow-x:auto;">
          <table>
            <tr>
              <th>POS</th>
              <th>TEAM</th>
              <th>PTS</th>
              <th>WINS</th>
            </tr>

            ${teamList.map(team => `
              <tr>
                <td class="position">${escapeHTML(team.position)}</td>
                <td><strong>${escapeHTML(team.Constructor?.name)}</strong></td>
                <td>${escapeHTML(team.points)}</td>
                <td>${escapeHTML(team.wins)}</td>
              </tr>
            `).join("")}
          </table>
        </div>

        ${!teamList.length
          ? emptyState("No constructor standings available.")
          : ""}
      </div>
    `;

  } catch (error) {
    if (requestId === raceRequest) showError(error);
  }
}

/* =========================================
   CALENDAR
   ========================================= */

async function loadCalendar() {
  const requestId = ++raceRequest;

  showLoading("📅 RACE CALENDAR");

  try {
    const data = await fetchF1(`${SEASON}/races`);

    if (requestId !== raceRequest) return;

    const races = getRaceList(data);

    appView.innerHTML = `
      <div class="panel">
        <h2>📅 GRAND PRIX CALENDAR</h2>

        ${!races.length
          ? emptyState("No calendar available.")
          : `
            <div style="overflow-x:auto;">
              <table>
                <tr>
                  <th>ROUND</th>
                  <th>GRAND PRIX</th>
                  <th>CIRCUIT</th>
                  <th>DATE</th>
                </tr>

                ${races.map(race => `
                  <tr>
                    <td class="position">${escapeHTML(race.round)}</td>
                    <td><strong>${escapeHTML(race.raceName)}</strong></td>
                    <td>${escapeHTML(race.Circuit?.circuitName)}</td>
                    <td>${escapeHTML(formatDate(race.date))}</td>
                  </tr>
                `).join("")}
              </table>
            </div>
          `
        }
      </div>
    `;

  } catch (error) {
    if (requestId === raceRequest) showError(error);
  }
}

/* =========================================
   SESSION CENTRE
   ========================================= */

async function loadSessions() {
  const year = new Date().getFullYear();

  currentSession.year = year;
  currentSession.round = null;
  currentSession.type = "R";
  currentSession.race = null;
  currentSession.openF1Session = null;

  appView.innerHTML = `
    <div class="hero">
      <p class="muted">THE COMPLETE PADDOCK</p>
      <h2>⏱️ SESSION CENTRE.</h2>
      <p>Every session. Every driver. Every result.</p>
    </div>

    <div class="panel">
      <h2>📅 SELECT SEASON</h2>

      <select id="seasonSelect">
        ${Array.from(
          { length: year - 1949 },
          (_, index) => year - index
        ).map(value => `
          <option value="${value}">${value} SEASON</option>
        `).join("")}
      </select>

      <h2>🏁 SELECT GRAND PRIX</h2>

      <select id="sessionGPSelect">
        <option>Loading Grand Prix...</option>
      </select>

      <p id="sessionRaceInfo" class="status"></p>
    </div>

    <div class="panel">
      <h2>SESSION SELECTOR</h2>

      <div class="session-grid" id="sessionGrid">
        ${SESSION_TYPES.map(session => `
          <button
            class="session-btn ${session.id === "R" ? "active" : ""}"
            data-session="${session.id}"
            onclick="selectSession('${session.id}')">
            ${session.label}
          </button>
        `).join("")}
      </div>

      <div id="sessionResults">
        <p class="status">Select a Grand Prix.</p>
      </div>
    </div>
  `;

  const seasonSelect = document.getElementById("seasonSelect");
  const gpSelect = document.getElementById("sessionGPSelect");

  seasonSelect.value = year;

  seasonSelect.addEventListener("change", () => {
    currentSession.year = Number(seasonSelect.value);
    currentSession.round = null;
    currentSession.race = null;
    currentSession.openF1Session = null;
    loadSeasonRaces();
  });

  gpSelect.addEventListener("change", () => {
    currentSession.round = gpSelect.value;

    currentSession.race =
      gpSelect.selectedOptions[0]?.dataset.race
        ? JSON.parse(gpSelect.selectedOptions[0].dataset.race)
        : null;

    currentSession.openF1Session = null;

    showSessionInfo();
    loadSessionResults();
  });

  await loadSeasonRaces();
}

window.selectSession = function(type) {
  selectSession(type);
};

/* =========================================
   SEASON RACES
   ========================================= */

async function loadSeasonRaces() {
  const gpSelect = document.getElementById("sessionGPSelect");
  const results = document.getElementById("sessionResults");

  if (!gpSelect || !results) return;

  const requestId = ++sessionRequest;

  gpSelect.innerHTML = "<option>Loading races...</option>";
  results.innerHTML = '<p class="status">⏳ Loading season...</p>';

  try {
    const data = await fetchF1(`${currentSession.year}/races`);

    if (requestId !== sessionRequest) return;

    const races = getRaceList(data);

    if (!races.length) {
      gpSelect.innerHTML = "<option>No races found</option>";
      results.innerHTML = emptyState("No schedule available.");
      return;
    }

    gpSelect.innerHTML = races.map(race => `
      <option
        value="${escapeHTML(race.round)}"
        data-race="${escapeHTML(JSON.stringify(race))}">
        ROUND ${escapeHTML(race.round)} -
        ${escapeHTML(race.raceName)}
      </option>
    `).join("");

    const completed = races.filter(race =>
      race.date &&
      new Date(`${race.date}T23:59:59`) < new Date()
    );

    const selected = completed.length
      ? completed[completed.length - 1]
      : races[0];

    currentSession.round = selected.round;
    currentSession.race = selected;

    gpSelect.value = selected.round;

    showSessionInfo();
    await loadSessionResults();

  } catch (error) {
    if (requestId !== sessionRequest) return;

    gpSelect.innerHTML = "<option>Unable to load races</option>";

    results.innerHTML = `
      <p class="error">${escapeHTML(error.message)}</p>
    `;
  }
}

/* =========================================
   SESSION INFO
   ========================================= */

function showSessionInfo() {
  const info = document.getElementById("sessionRaceInfo");
  const race = currentSession.race;

  if (!info || !race) return;

  info.innerHTML = `
    📍 ${escapeHTML(race.Circuit?.circuitName)}
    <br>
    📅 ${escapeHTML(formatDate(race.date))}
    <br>
    🌍 ${escapeHTML(race.Circuit?.Location?.country || "")}
  `;
}

/* =========================================
   SELECT SESSION
   ========================================= */

function selectSession(type) {
  currentSession.type = type;
  currentSession.openF1Session = null;

  document.querySelectorAll(".session-btn").forEach(button => {
    button.classList.toggle(
      "active",
      button.dataset.session === type
    );
  });

  loadSessionResults();
}

/* =========================================
   OPENF1 SESSION MATCHING
   ========================================= */



/* =========================================
   F1 HUB — SESSION CENTRE REPAIR
   Driver names + FP1 + Qualifying
   ========================================= */

/* SESSION MATCHING */

function findMatchingSession(sessions, race, type) {
  if (!race || !sessions?.length) return null;

  const allowedNames = OPENF1_SESSION_NAMES[type] || [];
  const raceName = normalizeName(race.raceName);
  const circuitName = normalizeName(race.Circuit?.circuitName);
  const locality = normalizeName(race.Circuit?.Location?.locality);

  const raceDate = new Date(`${race.date}T00:00:00Z`).getTime();

  const candidates = sessions
    .filter(session => {
      if (!allowedNames.includes(session.session_name)) {
        return false;
      }

      const sessionDate = new Date(session.date_start).getTime();

      if (!Number.isFinite(sessionDate)) return false;

      const difference = Math.abs(sessionDate - raceDate);

      return difference <= 4 * 86400000;
    })
    .map(session => {
      const meeting = normalizeName(session.meeting_name);
      const circuit = normalizeName(session.circuit_short_name);

      const meetingMatch =
        meeting === raceName ||
        meeting.includes(raceName) ||
        raceName.includes(meeting);

      const circuitMatch =
        (locality && circuit.includes(locality)) ||
        (circuitName && (
          circuitName.includes(circuit) ||
          circuit.includes(circuitName)
        ));

      const dateDifference = Math.abs(
        new Date(session.date_start).getTime() - raceDate
      ) / 86400000;

      let score = dateDifference;

      if (meetingMatch) score -= 20;
      if (circuitMatch) score -= 10;

      return { session, score };
    });

  if (!candidates.length) return null;

  candidates.sort((a, b) => a.score - b.score);

  return candidates[0].session;
}


/* SEASON SESSION LOADER */

async function getSeasonOpenF1Sessions(year) {
  return await fetchOpenF1("sessions", {
    year: year
  });
}


/* TIME FORMATTER */

function formatSessionTime(value) {
  if (Array.isArray(value)) {
    return value
      .map(item => item == null ? "-" : formatSeconds(item))
      .join(" / ");
  }

  return formatSeconds(value);
}


/* DRIVER MAP */

function createDriverMap(drivers) {
  const map = {};

  (drivers || []).forEach(driver => {
    map[String(driver.driver_number)] = driver;
  });

  return map;
}


/* QUALIFYING CLASSIFICATION */

function buildQualifyingRows(results, driverMap, phase) {
  const phaseIndex = {
    Q1: 0,
    Q2: 1,
    Q3: 2
  }[phase];

  const rows = [];

  results.forEach(result => {
    const number = String(result.driver_number);
    const driver = driverMap[number] || {};

    const durations = Array.isArray(result.duration)
      ? result.duration
      : [result.duration];

    const duration = durations[phaseIndex];

    if (
      duration === null ||
      duration === undefined ||
      !Number.isFinite(Number(duration)) ||
      Number(duration) <= 0
    ) {
      return;
    }

    rows.push({
      number,
      name: driver.full_name ||
        driver.broadcast_name ||
        driver.name_acronym ||
        `${driver.first_name || ""} ${driver.last_name || ""}`.trim() ||
        `Driver ${number}`,

      team: driver.team_name || "-",
      duration: Number(duration),
      time: formatSeconds(duration),
      points: "-"
    });
  });

  rows.sort((a, b) => a.duration - b.duration);

  return rows.map((row, index) => ({
    ...row,
    position: index + 1
  }));
}


/* PRACTICE FASTEST LAP CLASSIFICATION */

function buildPracticeRows(laps, driverMap) {
  const bestLaps = {};

  (laps || []).forEach(lap => {
    const number = String(lap.driver_number);
    const duration = Number(lap.lap_duration);

    if (
      !number ||
      number === "undefined" ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      lap.is_pit_out_lap
    ) {
      return;
    }

    if (
      !bestLaps[number] ||
      duration < bestLaps[number]
    ) {
      bestLaps[number] = duration;
    }
  });

  return Object.entries(bestLaps)
    .map(([number, duration]) => {
      const driver = driverMap[number] || {};

      return {
        number,
        name: driver.full_name ||
          driver.broadcast_name ||
          driver.name_acronym ||
          `${driver.first_name || ""} ${driver.last_name || ""}`.trim() ||
          `Driver ${number}`,

        team: driver.team_name || "-",
        duration,
        time: formatSeconds(duration),
        points: "-"
      };
    })
    .sort((a, b) => a.duration - b.duration)
    .map((row, index) => ({
      ...row,
      position: index + 1
    }));
}


/* =========================================
   SESSION RESULT LOADER
   ========================================= */

async function loadSessionResults() {
  const container = document.getElementById("sessionResults");

  if (!container) return;

  const requestId = ++sessionRequest;

  currentSession.openF1Session = null;

  if (!currentSession.race) {
    container.innerHTML = emptyState(
      "Please select a Grand Prix."
    );
    return;
  }

  const type = currentSession.type;

  container.innerHTML = `
    <p class="status">
      ⏳ Loading ${escapeHTML(type)} results...
    </p>
  `;

  try {
    const sessions = await getSeasonOpenF1Sessions(
      currentSession.year
    );

    if (requestId !== sessionRequest) return;

    const matched = findMatchingSession(
      sessions,
      currentSession.race,
      type
    );

    if (!matched) {
      container.innerHTML = emptyState(
        `${type} session could not be matched with an OpenF1 session for this Grand Prix.`
      );
      return;
    }

    currentSession.openF1Session = matched;

    const sessionKey = matched.session_key;

    /* Fetch the three data sources */

    const [resultsResponse, driversResponse, lapsResponse] =
      await Promise.allSettled([
        fetchOpenF1("session_result", {
          session_key: sessionKey
        }),

        fetchOpenF1("drivers", {
          session_key: sessionKey
        }),

        fetchOpenF1("laps", {
          session_key: sessionKey
        })
      ]);

    if (requestId !== sessionRequest) return;

    const officialResults =
      resultsResponse.status === "fulfilled"
        ? resultsResponse.value
        : [];

    let drivers =
      driversResponse.status === "fulfilled"
        ? driversResponse.value
        : [];

    const laps =
      lapsResponse.status === "fulfilled"
        ? lapsResponse.value
        : [];

    /* Driver fallback using meeting_key */

    if (!drivers.length) {
      try {
        drivers = await fetchOpenF1("drivers", {
          meeting_key: matched.meeting_key
        });
      } catch (error) {
        console.warn("Driver fallback failed:", error);
      }
    }

    if (requestId !== sessionRequest) return;

    const driverMap = createDriverMap(drivers);

    let rows = [];

    /* =================================
       QUALIFYING Q1 / Q2 / Q3
       ================================= */

    if (["Q1", "Q2", "Q3"].includes(type)) {
      rows = buildQualifyingRows(
        officialResults,
        driverMap,
        type
      );
    }

    /* =================================
       OTHER OFFICIAL CLASSIFICATIONS
       ================================= */

    else if (officialResults.length) {
      rows = officialResults.map(result => {
        const number = String(result.driver_number);
        const driver = driverMap[number] || {};

        return {
          position: result.position ?? "-",
          number,

          name: driver.full_name ||
            driver.broadcast_name ||
            driver.name_acronym ||
            `Driver ${number}`,

          team: driver.team_name || "-",

          time: formatSessionTime(result.duration),

          points: result.points ?? "-"
        };
      });

      rows.sort((a, b) => {
        if (a.position === "-") return 1;
        if (b.position === "-") return -1;

        return Number(a.position) - Number(b.position);
      });
    }

    /* =================================
       PRACTICE FASTEST LAP FALLBACK
       ================================= */

    if (
      !rows.length &&
      ["FP1", "FP2", "FP3"].includes(type)
    ) {
      rows = buildPracticeRows(laps, driverMap);
    }

    /* =================================
       NO RESULTS
       ================================= */

    if (!rows.length) {
      container.innerHTML = emptyState(
        "Session found, but its results are not available yet. Try again after the official classification is published."
      );
      return;
    }

    /* =================================
       DISPLAY RESULTS
       ================================= */

    const qualifyingMessage = {
      Q1: "Q1 fastest times",
      Q2: "Q2 fastest times",
      Q3: "Q3 fastest times"
    };

    container.innerHTML = `
      <h3>
        ${escapeHTML(
          matched.meeting_name ||
          currentSession.race.raceName
        )}
      </h3>

      <p class="status">
        ${escapeHTML(matched.session_name)}
        • ${escapeHTML(
          formatDate(matched.date_start?.slice(0, 10))
        )}
      </p>

      ${
        qualifyingMessage[type]
          ? `<p class="status">${qualifyingMessage[type]} — sorted by fastest lap.</p>`
          : ""
      }

      ${
        ["FP1", "FP2", "FP3"].includes(type) &&
        !officialResults.length
          ? `<p class="status">Practice classification calculated from fastest recorded laps.</p>`
          : ""
      }

      <div style="overflow-x:auto;">
        <table>
          <tr>
            <th>POS</th>
            <th>NO.</th>
            <th>DRIVER</th>
            <th>TEAM</th>
            <th>TIME</th>
            <th>PTS</th>
          </tr>

          ${rows.map(row => `
            <tr>
              <td class="position">
                ${escapeHTML(row.position)}
              </td>

              <td>${escapeHTML(row.number)}</td>

              <td>
                <strong>${escapeHTML(row.name)}</strong>
              </td>

              <td>${escapeHTML(row.team)}</td>

              <td>${escapeHTML(row.time)}</td>

              <td>${escapeHTML(row.points)}</td>
            </tr>
          `).join("")}
        </table>
      </div>

      <p class="status">
        Data provided by OpenF1.
      </p>
    `;

  } catch (error) {
    if (requestId !== sessionRequest) return;

    console.error("Session Centre error:", error);

    container.innerHTML = `
      <p class="error">
        Unable to load session data:
        ${escapeHTML(error.message)}
      </p>

      <p class="status">
        Please check your internet connection and try again.
      </p>
    `;
  }
}

/* =========================================
   END OF SESSION CENTRE REPAIR
   ========================================= */

/* =========================================
   F1 HUB — FERRARI STYLE INTRO ANIMATION
   Plays once on every app opening
   ========================================= */

(function launchF1Intro() {

  const style = document.createElement("style");

  style.textContent = `
    #f1Intro {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #080808;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
      animation: introFade 2.3s forwards;
    }

    #f1IntroCar {
      position: absolute;
      width: 150px;
      height: 300px;
      bottom: -350px;
      animation: ferrariLaunch 1.9s cubic-bezier(.45,0,.75,1) forwards;
    }

    #f1IntroText {
      position: absolute;
      bottom: 12%;
      color: white;
      font-size: 22px;
      font-weight: 900;
      letter-spacing: 5px;
      font-family: Arial, sans-serif;
      opacity: 0;
      animation: introText .8s 0.2s forwards;
    }

    @keyframes ferrariLaunch {
      0% {
        transform: translateY(0) scale(.8);
      }
      20% {
        transform: translateY(-20vh) scale(1);
      }
      100% {
        transform: translateY(-150vh) scale(1.15);
      }
    }

    @keyframes introText {
      to { opacity: 1; }
    }

    @keyframes introFade {
      0%, 75% { opacity: 1; }
      100% {
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
      }
    }
  `;

  document.head.appendChild(style);

  const intro = document.createElement("div");
  intro.id = "f1Intro";

  intro.innerHTML = `
    <div id="f1IntroCar">
      <svg viewBox="0 0 150 300"
           width="100%" height="100%"
           xmlns="http://www.w3.org/2000/svg">

        <!-- Rear wing -->
        <rect x="18" y="258" width="114" height="13"
              rx="3" fill="#222"/>
        <rect x="28" y="254" width="94" height="6"
              fill="#E10600"/>

        <!-- Rear wheels -->
        <rect x="5" y="211" width="25" height="59"
              rx="7" fill="#151515"/>
        <rect x="120" y="211" width="25" height="59"
              rx="7" fill="#151515"/>

        <!-- Main chassis -->
        <path d="M75 10
                 C55 40 48 85 48 130
                 L42 220
                 Q45 245 75 252
                 Q105 245 108 220
                 L102 130
                 C102 85 95 40 75 10Z"
              fill="#E10600"/>

        <!-- Side body details -->
        <path d="M48 140 L25 164 L42 205 L49 180Z"
              fill="#B00000"/>
        <path d="M102 140 L125 164 L108 205 L101 180Z"
              fill="#B00000"/>

        <!-- Front wheels -->
        <rect x="7" y="105" width="25" height="59"
              rx="7" fill="#151515"/>
        <rect x="118" y="105" width="25" height="59"
              rx="7" fill="#151515"/>

        <!-- Cockpit -->
        <path d="M75 75
                 C58 75 58 115 61 139
                 L89 139
                 C92 115 92 75 75 75Z"
              fill="#171717"/>

        <!-- Halo -->
        <path d="M58 91 Q75 66 92 91"
              fill="none" stroke="#C8C8C8"
              stroke-width="5"/>

        <!-- Front wing -->
        <path d="M12 40 L138 40 L146 51
                 L4 51Z" fill="#222"/>
        <path d="M30 31 L120 31 L138 39
                 L12 39Z" fill="#E10600"/>

        <!-- Nose -->
        <path d="M68 12 L82 12 L84 76
                 L66 76Z" fill="#F52222"/>

        <!-- Racing details -->
        <path d="M52 170 L75 180 L98 170"
              fill="none" stroke="#FFFFFF"
              stroke-width="3"/>
      </svg>
    </div>

    <div id="f1IntroText">F1 HUB</div>
  `;

  document.body.appendChild(intro);

  setTimeout(() => {
    intro.remove();
    style.remove();
  }, 2400);

})();

(function ferrariIntro() {
  if (document.getElementById("f1Intro")) return;

  const style = document.createElement("style");
  style.textContent = `
    #f1Intro {
      position: fixed;
      inset: 0;
      z-index: 999999;
      background: #050505;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      animation: introFade 0.35s ease 2.15s forwards;
    }

    #f1Intro img {
      position: absolute;
      width: min(90vw, 520px);
      height: auto;
      object-fit: contain;
      transform: translateY(120vh) scale(.75);
      animation: f1Launch 2.5s cubic-bezier(.15,.75,.25,1) forwards;
    }

    #f1Intro span {
      position: absolute;
      bottom: 12%;
      color: white;
      font: 800 28px Arial, sans-serif;
      letter-spacing: 8px;
      opacity: 0;
      animation: titleAppear .5s ease 1.5s forwards;
    }

    @keyframes f1Launch {
      0% { transform: translateY(120vh) scale(.65); }
      25% { transform: translateY(55vh) scale(.8); }
      65% { transform: translateY(-10vh) scale(1); }
      100% { transform: translateY(-125vh) scale(1.15); }
    }

    @keyframes titleAppear {
      to { opacity: 1; }
    }

    @keyframes introFade {
      to { opacity: 0; visibility: hidden; }
    }
  `;
  document.head.appendChild(style);

  const intro = document.createElement("div");
  intro.id = "f1Intro";
  intro.innerHTML = `
    <img src="f1-car.png" alt="Red Formula racing car">
    <span>F1 HUB</span>
  `;
  document.body.appendChild(intro);

  setTimeout(() => intro.remove(), 2550);
})();
