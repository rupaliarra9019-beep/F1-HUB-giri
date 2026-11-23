
"use strict";

/* ==========================================
   F1 HUB 2.0 — COMPLETE HOME ENGINE
   Data source: OpenF1 API
   Season: 2026
   ========================================== */

const API = "https://api.openf1.org/v1";
const SEASON = 2026;
const appView = document.getElementById("appView");

let selectedPage = "home";
let loading = false;
let pageVersion = 0;

/* ==========================================
   HELPERS
   ========================================== */

function createElement(tag, text, parent, className) {
  const element = document.createElement(tag);

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  if (className) element.className = className;
  if (parent) parent.appendChild(element);

  return element;
}

async function getData(endpoint) {
  const response = await fetch(API + endpoint, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("OpenF1 API error: " + response.status);
  }

  return response.json();
}

function formatDate(date) {
  if (!date) return "Not available";

  const parsed = new Date(date);

  return Number.isNaN(parsed.getTime())
    ? "Not available"
    : parsed.toLocaleString();
}

function showMessage(message) {
  appView.replaceChildren();

  const panel = createElement("div", null, appView, "panel");
  createElement("p", message, panel, "status");
}

function isCurrentPage(version) {
  return selectedPage === "home" &&
    version === pageVersion;
}

function makePanel(title, parent) {
  const panel = createElement(
    "div",
    null,
    parent || appView,
    "panel"
  );

  createElement("h2", title, panel);

  return panel;
}

function driverKey(number) {
  return String(number ?? "").trim();
}

/* IMPORTANT:
   Null, empty, zero and invalid positions must
   never be treated as P1 or placed above P1.
*/

function getPositionSortValue(position) {
  if (
    position === null ||
    position === undefined ||
    String(position).trim() === ""
  ) {
    return Infinity;
  }

  const value = Number(position);

  return Number.isFinite(value) && value > 0
    ? value
    : Infinity;
}

function sortByPosition(items) {
  return items.slice().sort((a, b) => {
    const posA = getPositionSortValue(a.position);
    const posB = getPositionSortValue(b.position);

    if (posA !== posB) {
      return posA - posB;
    }

    const driverA = Number(a.driver_number);
    const driverB = Number(b.driver_number);

    return (
      (Number.isFinite(driverA) ? driverA : 999) -
      (Number.isFinite(driverB) ? driverB : 999)
    );
  });
}

function formatTime(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  const seconds = Number(value);

  if (!Number.isFinite(seconds)) return "—";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remaining = seconds % 60;

  const formattedSeconds = remaining.toFixed(3).padStart(6, "0");

  if (hours > 0) {
    return hours + ":" +
      String(minutes).padStart(2, "0") + ":" +
      formattedSeconds;
  }

  return minutes + ":" + formattedSeconds;
}

function formatGap(value) {
  if (value === null || value === undefined || value === "") {
    return "—";
  }

  if (typeof value === "string") {
    return value;
  }

  const seconds = Number(value);

  if (!Number.isFinite(seconds)) return "—";
  if (seconds === 0) return "LEADER";

  return "+" + seconds.toFixed(3) + "s";
}

function formatPoints(value) {
  return value === null || value === undefined || value === ""
    ? "—"
    : value;
}

/* ==========================================
   NAVIGATION
   ========================================== */

function showDashboard(page, button) {
  selectedPage = page;
  pageVersion++;

  // Allow a fresh home request after navigating back.
  loading = false;

  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  if (button) button.classList.add("active");

  if (page === "home") {
    loadHome();
    return;
  }

  appView.replaceChildren();

  const titles = {
    championship: "CHAMPIONSHIP STANDINGS",
    sessions: "SESSION CENTRE",
    live: "LIVE TIMING"
  };
  if (page === "sessions") {
  if (window.loadSessionCentre) {
    window.loadSessionCentre();
  } else {
    appView.innerHTML = `
      <div class="panel">
        <p class="status">Session Centre is loading...</p>
      </div>`;
  }
  return;
  }

  
if (page === "sessions") {
  if (window.loadSessionCentre) {
    window.loadSessionCentre();
  } else {
    appView.innerHTML = `
      <div class="panel">
        <p class="status">Session Centre is loading...</p>
      </div>`;
  }
  return;
}

if (page === "live") {
  const panel = createElement("div", "", appView, "panel");

  createElement("h2", " HEY ! HE IS LION YOU DON'T NEED TO          WATCH JUST SAY ", panel);
  createElement("h2", "           🦁 SIMPLY LOVELY 🦁", panel);

  return;
}

/* Keep your existing championship code below this point */


  
}

/* ==========================================
   SESSION NAMES
   ========================================== */

function getSessionTitle(name) {
  const value = (name || "").toLowerCase().trim();

  const titles = {
    "practice 1": "FREE PRACTICE 1 (FP1)",
    "practice 2": "FREE PRACTICE 2 (FP2)",
    "practice 3": "FREE PRACTICE 3 (FP3)",
    "qualifying": "QUALIFYING",
    "sprint qualifying": "SPRINT QUALIFYING",
    "sprint shootout": "SPRINT SHOOTOUT",
    "sprint": "SPRINT RACE",
    "race": "GRAND PRIX RACE"
  };

  return titles[value] || (name || "SESSION").toUpperCase();
}

function isPractice(name) {
  return /^Practice/i.test(name || "");
}

function isMainQualifying(name) {
  return /^Qualifying$/i.test(name || "");
}

function isRace(name) {
  return /^Race$/i.test(name || "");
}

/* ==========================================
   DRIVER DATA
   ========================================== */

function buildDriverMap(drivers) {
  const map = new Map();

  if (!Array.isArray(drivers)) return map;

  drivers.forEach(driver => {
    if (driver.driver_number == null) return;

    map.set(driverKey(driver.driver_number), driver);
  });

  return map;
}

function getDriverName(driver) {
  if (!driver) return null;

  return driver.full_name ||
    driver.broadcast_name ||
    [driver.first_name, driver.last_name]
      .filter(Boolean)
      .join(" ") ||
    driver.name_acronym ||
    null;
}

/* ==========================================
   LATEST GRAND PRIX
   ========================================== */

async function getLatestMeeting(now) {
  const meetings = await getData(
    "/meetings?year=" + SEASON
  );

  if (!Array.isArray(meetings) || meetings.length === 0) {
    throw new Error("No " + SEASON + " meetings found.");
  }

  const validMeetings = meetings
    .filter(meeting =>
      meeting.meeting_key != null &&
      meeting.date_start &&
      !Number.isNaN(new Date(meeting.date_start).getTime())
    )
    .sort((a, b) =>
      new Date(a.date_start) - new Date(b.date_start)
    );

  if (!validMeetings.length) {
    throw new Error("No valid Grand Prix dates found.");
  }

  // Keep the latest weekend that has started.
  // Switch to the next weekend only when it starts.
  const startedMeetings = validMeetings.filter(meeting =>
    new Date(meeting.date_start) <= now
  );

  const meeting =
    startedMeetings[startedMeetings.length - 1] ||
    validMeetings[0];

  const sessions = await getData(
    "/sessions?meeting_key=" +
    encodeURIComponent(meeting.meeting_key)
  );

  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new Error(
      "No sessions found for " + meeting.meeting_name
    );
  }

  sessions.sort((a, b) =>
    new Date(a.date_start) - new Date(b.date_start)
  );

  return { meeting, sessions };
}

/* ==========================================
   FETCH WEEKEND DRIVERS
   ========================================== */

async function fetchMeetingDrivers(meetingKey) {
  try {
    const drivers = await getData(
      "/drivers?meeting_key=" +
      encodeURIComponent(meetingKey)
    );

    return Array.isArray(drivers) ? drivers : [];

  } catch (error) {
    console.warn("Weekend driver request failed:", error);
    return [];
  }
}

/* ==========================================
   FETCH SESSION RESULTS
   ========================================== */

async function fetchSessionData(session, meetingDriverMap) {
  const key = session.session_key;

  const requests = await Promise.allSettled([
    getData(
      "/session_result?session_key=" +
      encodeURIComponent(key)
    ),
    getData(
      "/drivers?session_key=" +
      encodeURIComponent(key)
    )
  ]);

  const results =
    requests[0].status === "fulfilled" &&
    Array.isArray(requests[0].value)
      ? requests[0].value
      : [];

  const sessionDrivers =
    requests[1].status === "fulfilled" &&
    Array.isArray(requests[1].value)
      ? requests[1].value
      : [];

  // Session-specific driver data takes priority.
  const combinedDrivers = new Map(meetingDriverMap);

  sessionDrivers.forEach(driver => {
    if (driver.driver_number != null) {
      combinedDrivers.set(
        driverKey(driver.driver_number),
        driver
      );
    }
  });

  return {
    session,
    results,
    drivers: combinedDrivers,
    error: requests[0].status === "rejected"
  };
}

/* ==========================================
   RESULT TABLE
   ========================================== */

function makeResultsTable(bundle, parent, now, gridMap) {
  const session = bundle.session;
  const results = bundle.results;
  const drivers = bundle.drivers;
  const name = session.session_name || "";

  const panel = makePanel(
    getSessionTitle(name),
    parent
  );

  createElement(
    "p",
    "Session date: " + formatDate(session.date_start),
    panel,
    "status"
  );

  const start = new Date(session.date_start);
  const end = new Date(session.date_end);

  if (start > now) {
    createElement(
      "p",
      "UPCOMING SESSION",
      panel,
      "status"
    );

    createElement(
      "p",
      "Results will appear after the session.",
      panel,
      "status"
    );

    return;
  }

  if (end > now) {
    createElement(
      "p",
      "SESSION IN PROGRESS",
      panel,
      "status"
    );
  }

  if (!results.length) {
    createElement(
      "p",
      bundle.error
        ? "Results temporarily unavailable. They will be checked again automatically."
        : "Official results have not been published yet.",
      panel,
      "status"
    );

    return;
  }

  const sorted = sortByPosition(results);

  // Practice: only show the actual classified top three.
  if (isPractice(name)) {
    const classified = sorted.filter(result =>
      Number.isFinite(getPositionSortValue(result.position))
    );

    if (!classified.length) {
      createElement(
        "p",
        "Practice classification is not available yet.",
        panel,
        "status"
      );

      return;
    }
  }

  const displayed = isPractice(name)
    ? sorted.filter(result =>
        Number.isFinite(getPositionSortValue(result.position))
      ).slice(0, 3)
    : sorted;

  const qualifying = isMainQualifying(name);
  const race = isRace(name);

  const table = createElement("table", null, panel);
  const header = createElement("tr", null, table);

  let headings;

  if (qualifying) {
    headings = [
      "POS",
      "DRIVER",
      "TEAM",
      "Q1",
      "Q2",
      "Q3",
      "LAPS",
      "PTS"
    ];
  } else {
    headings = [
      "POS",
      "DRIVER",
      "TEAM",
      "GRID",
      "LAPS",
      race ? "TIME / GAP" : "BEST TIME",
      "PTS"
    ];
  }

  headings.forEach(heading => {
    createElement("th", heading, header);
  });

  displayed.forEach(result => {
    const driver = drivers.get(
      driverKey(result.driver_number)
    );

    const driverName = getDriverName(driver) ||
      (result.driver_number != null
        ? "Name unavailable (#" + result.driver_number + ")"
        : "Name unavailable");

    const teamName = driver?.team_name || "Unavailable";

    const gridPosition = gridMap
      ? gridMap.get(driverKey(result.driver_number))
      : null;

    const row = createElement("tr", null, table);

    let values;

    if (qualifying) {
      const durations = Array.isArray(result.duration)
        ? result.duration
        : [];

      values = [
        result.position ?? "—",
        driverName,
        teamName,
        formatTime(durations[0]),
        formatTime(durations[1]),
        formatTime(durations[2]),
        result.number_of_laps ?? "—",
        formatPoints(result.points)
      ];

    } else {
      const timeValue = result.duration ??
        result.gap_to_leader;

      values = [
        result.position ?? "—",
        driverName,
        teamName,
        gridPosition ?? "—",
        result.number_of_laps ?? "—",
        result.duration != null
          ? formatTime(timeValue)
          : formatGap(timeValue),
        formatPoints(result.points)
      ];
    }

    values.forEach((value, index) => {
      const cell = createElement("td", value, row);

      if (index === 0) {
        cell.className = "position";
      }
    });
  });

  createElement(
    "p",
    isPractice(name)
      ? "TOP 3 PRACTICE RESULTS"
      : qualifying
        ? "FULL QUALIFYING CLASSIFICATION — Q1 / Q2 / Q3"
        : "FULL SESSION CLASSIFICATION",
    panel,
    "status"
  );
}

/* ==========================================
   STARTING GRID
   ========================================== */

async function fetchStartingGrid(raceSession) {
  try {
    const grid = await getData(
      "/starting_grid?session_key=" +
      encodeURIComponent(raceSession.session_key)
    );

    return Array.isArray(grid) ? grid : [];

  } catch (error) {
    console.warn("Starting grid unavailable:", error);
    return [];
  }
}

function buildGridMap(grid) {
  const map = new Map();

  sortByPosition(grid).forEach(item => {
    if (item.driver_number == null) return;

    map.set(
      driverKey(item.driver_number),
      item.position
    );
  });

  return map;
}

function renderStartingGrid(grid, driverMap, parent) {
  if (!grid.length) {
    const panel = makePanel(
      "OFFICIAL STARTING GRID",
      parent
    );

    createElement(
      "p",
      "The official starting grid has not been published yet.",
      panel,
      "status"
    );

    return;
  }

  const panel = makePanel(
    "OFFICIAL STARTING GRID",
    parent
  );

  const sorted = sortByPosition(grid);

  const table = createElement("table", null, panel);
  const header = createElement("tr", null, table);

  ["GRID", "DRIVER", "TEAM", "QUALIFYING LAP"].forEach(value => {
    createElement("th", value, header);
  });

  sorted.forEach(item => {
    const driver = driverMap.get(
      driverKey(item.driver_number)
    );

    const row = createElement("tr", null, table);

    const values = [
      item.position != null ? "P" + item.position : "—",
      getDriverName(driver) ||
        "Name unavailable (#" + item.driver_number + ")",
      driver?.team_name || "Unavailable",
      formatTime(item.lap_duration)
    ];

    values.forEach(value => {
      createElement("td", value, row);
    });
  });
}

/* ==========================================
   HOME PAGE
   ========================================== */

async function loadHome() {
  if (loading || selectedPage !== "home") return;

  loading = true;

  const version = ++pageVersion;

  showMessage("LOADING F1 HUB...");

  try {
    const now = new Date();

    // 1. Find the latest/current Grand Prix.
    const data = await getLatestMeeting(now);

    if (!isCurrentPage(version)) return;

    const meeting = data.meeting;
    const sessions = data.sessions;

    // 2. Fetch weekend driver information.
    const weekendDrivers = await fetchMeetingDrivers(
      meeting.meeting_key
    );

    if (!isCurrentPage(version)) return;

    const meetingDriverMap = buildDriverMap(weekendDrivers);

    // 3. Identify current and upcoming sessions.
    const current = sessions.find(session =>
      new Date(session.date_start) <= now &&
      new Date(session.date_end) >= now
    );

    const upcoming = sessions.find(session =>
      new Date(session.date_start) > now
    );

    // 4. Fetch results only for sessions that have started.
    const startedSessions = sessions.filter(session =>
      new Date(session.date_start) <= now
    );

    const resultBundles = await Promise.all(
      startedSessions.map(session =>
        fetchSessionData(session, meetingDriverMap)
      )
    );

    if (!isCurrentPage(version)) return;

    const resultMap = new Map();

    resultBundles.forEach(bundle => {
      resultMap.set(
        String(bundle.session.session_key),
        bundle
      );
    });

    // 5. Find the race and qualifying sessions.
    const raceSession = sessions.find(session =>
      isRace(session.session_name)
    );

    const qualifying = sessions.find(session =>
      isMainQualifying(session.session_name)
    );

    let grid = [];
    let gridMap = new Map();

    // Show the official starting grid only after qualifying
    // has ended and before the Grand Prix race begins.
    const shouldShowGrid =
      raceSession &&
      qualifying &&
      new Date(qualifying.date_end) <= now &&
      new Date(raceSession.date_start) > now;

    if (shouldShowGrid) {
      grid = await fetchStartingGrid(raceSession);
      gridMap = buildGridMap(grid);
    }

    if (!isCurrentPage(version)) return;

    // 6. Build the home page.
    const fragment = document.createDocumentFragment();

    const hero = createElement(
      "div",
      null,
      fragment,
      "hero"
    );

    createElement(
      "p",
      "LATEST GRAND PRIX",
      hero,
      "section-label"
    );

    createElement(
      "h2",
      meeting.meeting_name || "FORMULA 1 GRAND PRIX",
      hero
    );

    createElement(
      "p",
      meeting.country_name || meeting.location || "",
      hero
    );

    // Weekend status.
    if (current) {
      const panel = makePanel("CURRENT SESSION", fragment);

      createElement(
        "h3",
        getSessionTitle(current.session_name),
        panel
      );

      createElement(
        "p",
        "SESSION IN PROGRESS",
        panel,
        "status"
      );

    } else if (upcoming) {
      const panel = makePanel("UP NEXT", fragment);

      createElement(
        "h3",
        getSessionTitle(upcoming.session_name),
        panel
      );

      createElement(
        "p",
        formatDate(upcoming.date_start),
        panel
      );

    } else {
      const panel = makePanel("WEEKEND STATUS", fragment);

      createElement(
        "p",
        "Latest Grand Prix weekend completed.",
        panel,
        "status"
      );
    }

    // 7. Display every session in its scheduled order.
    makePanel("GRAND PRIX WEEKEND RESULTS", fragment);

    sessions.forEach(session => {
      const key = String(session.session_key);
      const bundle = resultMap.get(key);

      if (bundle) {
        makeResultsTable(
          bundle,
          fragment,
          now,
          isRace(session.session_name) ? gridMap : null
        );

      } else {
        // Future sessions get an upcoming card.
        // Never show fake empty result tables.
        const panel = makePanel(
          getSessionTitle(session.session_name),
          fragment
        );

        createElement(
          "p",
          "Session date: " + formatDate(session.date_start),
          panel,
          "status"
        );

        createElement(
          "p",
          "UPCOMING SESSION",
          panel,
          "status" 
        );
      }

      // Insert starting grid after qualifying and before the race.
      if (
        shouldShowGrid &&
        session.session_key === qualifying.session_key
      ) {
        renderStartingGrid(
          grid,
          meetingDriverMap,
          fragment
        );
      }
    });

    // 8. Data information and manual refresh.
    const footer = makePanel("F1 HUB DATA", fragment);

    createElement(
      "p",
      "Season: " + SEASON,
      footer,
      "status"
    );

    createElement(
      "p",
      "Grand Prix: " + (meeting.meeting_name || "Unavailable"),
      footer,
      "status"
    );

    createElement(
      "p",
      "Last updated: " + now.toLocaleTimeString(),
      footer,
      "status"
    );

    const refresh = createElement(
      "button",
      "↻ REFRESH HOME",
      footer,
      "action-btn"
    );
refresh.addEventListener("click", () => {
      loadHome();
    });

    // 9. Display everything together.
    if (!isCurrentPage(version)) return;

    appView.replaceChildren(fragment);

  } catch (error) {
    console.error("F1 HUB Home Error:", error);

    if (isCurrentPage(version)) {
      showMessage(
        "Unable to load F1 data. Please refresh and try again."
      );
    }

  } finally {
    loading = false;
  }
}

/*
==========================================
   START APPLICATION
   ========================================== */

window.showDashboard = showDashboard;

loadHome();

// Refresh the home page every five minutes.
window.setInterval(() => {
  if (selectedPage === "home" && !loading) {
    loadHome();
  }
}, 300000);








"use strict";

/* ==========================================
   F1 HUB 2.0 — STANDINGS ENGINE
   Data: Jolpica F1 API
   Season: 2026
   ========================================== */

(() => {
  const API = "https://api.jolpi.ca/ergast/f1/2026";
  const appView = document.getElementById("appView");

  let activeTab = "drivers";
  let isStandingsPage = false;
  let refreshTimer = null;

  const escapeHTML = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  async function fetchData(type) {
    const response = await fetch(
      `${API}/${type}Standings/`,
      { cache: "no-store" }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const json = await response.json();

    return json?.MRData?.StandingsTable
      ?.StandingsLists?.[0]?.[type === "driver"
        ? "DriverStandings"
        : "ConstructorStandings"] || [];
  }

  function showLoading() {
    appView.innerHTML = `
      <div class="panel">
        <p class="status">Loading championship standings...</p>
      </div>`;
  }

  function showError(error) {
    appView.innerHTML = `
      <div class="panel">
        <h2>STANDINGS UNAVAILABLE</h2>
        <p class="status">
          ${escapeHTML(error.message)}
        </p>
        <button class="refresh-btn" id="standingsRetry">
          TRY AGAIN
        </button>
      </div>`;

    document.getElementById("standingsRetry")
      ?.addEventListener("click", loadStandings);
  }

  function renderHeader() {
    return `
      <div class="panel standings-header">
        <div>
          <h2>CHAMPIONSHIP</h2>
          <p class="status">2026 FIA FORMULA ONE WORLD CHAMPIONSHIP</p>
        </div>

        <button class="refresh-btn" id="standingsRefresh">
          ↻ REFRESH
        </button>
      </div>

      <div class="standings-tabs">
        <button class="${activeTab === "drivers" ? "active" : ""}"
          data-tab="drivers">DRIVERS</button>

        <button class="${activeTab === "constructors" ? "active" : ""}"
          data-tab="constructors">CONSTRUCTORS</button>
      </div>

      <div id="standingsTable"></div>

      <p class="status standings-footer">
        Data provided by Jolpica API · Automatically refreshes every 5 minutes
      </p>`;
  }

  function renderDrivers(data) {
    if (!data.length) {
      return `<div class="panel"><p class="status">
        No driver standings are available yet.
      </p></div>`;
    }

    return `
      <div class="panel standings-table-wrap">
        <h3>DRIVER STANDINGS</h3>
        <div class="table-scroll">
          <table class="standings-table">
            <thead>
              <tr>
                <th>POS</th>
                <th>DRIVER</th>
                <th>TEAM</th>
                <th>PTS</th>
                <th>WINS</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => {
                const driver = item.Driver || {};
                const constructor = item.Constructors?.[0] || {};
                const name = `${driver.givenName || ""} ${driver.familyName || ""}`.trim();

                return `
                  <tr>
                    <td class="position">${escapeHTML(item.position)}</td>
                    <td>
                      <strong>${escapeHTML(name || driver.driverId)}</strong>
                      <small>${escapeHTML(driver.code || driver.permanentNumber || "")}</small>
                    </td>
                    <td>${escapeHTML(constructor.name || "—")}</td>
                    <td class="points">${escapeHTML(item.points)}</td>
                    <td>${escapeHTML(item.wins)}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function renderConstructors(data) {
    if (!data.length) {
      return `<div class="panel"><p class="status">
        No constructor standings are available yet.
      </p></div>`;
    }

    return `
      <div class="panel standings-table-wrap">
        <h3>CONSTRUCTOR STANDINGS</h3>
        <div class="table-scroll">
          <table class="standings-table">
            <thead>
              <tr>
                <th>POS</th>
                <th>CONSTRUCTOR</th>
                <th>NATIONALITY</th>
                <th>PTS</th>
                <th>WINS</th>
              </tr>
            </thead>
            <tbody>
              ${data.map(item => {
                const team = item.Constructor || {};

                return `
                  <tr>
                    <td class="position">${escapeHTML(item.position)}</td>
                    <td><strong>${escapeHTML(team.name || team.constructorId)}</strong></td>
                    <td>${escapeHTML(team.nationality || "—")}</td>
                    <td class="points">${escapeHTML(item.points)}</td>
                    <td>${escapeHTML(item.wins)}</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  async function loadStandings() {
    if (!isStandingsPage) return;

    showLoading();

    try {
      const [drivers, constructors] = await Promise.all([
        fetchData("driver"),
        fetchData("constructor")
      ]);

      if (!isStandingsPage) return;

      appView.innerHTML = renderHeader();

      const table = document.getElementById("standingsTable");

      table.innerHTML = activeTab === "drivers"
        ? renderDrivers(drivers)
        : renderConstructors(constructors);

      document.getElementById("standingsRefresh")
        ?.addEventListener("click", loadStandings);

      document.querySelectorAll(".standings-tabs button")
        .forEach(button => {
          button.addEventListener("click", () => {
            activeTab = button.dataset.tab;

            document.querySelectorAll(".standings-tabs button")
              .forEach(tab => tab.classList.toggle(
                "active",
                tab.dataset.tab === activeTab
              ));

            table.innerHTML = activeTab === "drivers"
              ? renderDrivers(drivers)
              : renderConstructors(constructors);
          });
        });

    } catch (error) {
      if (isStandingsPage) showError(error);
    }
  }

  // Connect to the existing F1 HUB navigation.
  const originalShowDashboard = window.showDashboard;

  if (typeof originalShowDashboard !== "function") {
    console.error("F1 HUB: showDashboard was not found.");
    return;
  }

  window.showDashboard = function(page, button) {
    isStandingsPage = page === "championship";

    originalShowDashboard.apply(this, arguments);

    if (isStandingsPage) {
      loadStandings();
    }
  };

  refreshTimer = setInterval(() => {
    if (isStandingsPage) loadStandings();
  }, 5 * 60 * 1000);

})();


