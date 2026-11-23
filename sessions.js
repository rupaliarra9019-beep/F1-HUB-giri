
"use strict";

/* ==========================================
   F1 HUB 2.0 — SESSION CENTRE
   Data: OpenF1 API
   Historical data: 2023 onwards
   ========================================== */

(() => {
  const API = "https://api.openf1.org/v1";
  const appView = document.getElementById("appView");

  let isActive = false;
  let currentYear = 2026;
  let meetings = [];
  let sessions = [];
  let selectedMeeting = null;
  let selectedSession = null;
  let requestId = 0;

  const years = [];
  for (let year = 2026; year >= 2023; year--) {
    years.push(year);
  }

  const escapeHTML = value =>
    String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);

  async function getData(endpoint) {
    const response = await fetch(API + endpoint, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error("API error: " + response.status);
    }

    return response.json();
  }

  function formatTime(value) {
    if (value === null || value === undefined || value === "") return "—";
    if (Array.isArray(value)) return value.map(formatTime).join(" / ");
    if (typeof value === "string") return value;

    const minutes = Math.floor(value / 60);
    const seconds = (value % 60).toFixed(3);

    return minutes > 0
      ? `${minutes}:${seconds.padStart(6, "0")}`
      : `${seconds}s`;
  }

  function formatGap(value) {
    if (value === null || value === undefined) return "—";
    if (Array.isArray(value)) return value.map(formatGap).join(" / ");
    if (typeof value === "string") return value;

    return value === 0 ? "LEADER" : "+" + value.toFixed(3);
  }

  function getSessionLabel(session) {
    const name = session.session_name || "Session";

    const labels = {
      "Practice 1": "FP1",
      "Practice 2": "FP2",
      "Practice 3": "FP3",
      "Qualifying": "QUALIFYING",
      "Sprint": "SPRINT",
      "Sprint Qualifying": "SPRINT QUALIFYING",
      "Sprint Shootout": "SPRINT QUALIFYING",
      "Race": "RACE"
    };

    return labels[name] || name.toUpperCase();
  }

  function showLoading(message) {
    appView.innerHTML = `
      <div class="panel">
        <p class="status">${escapeHTML(message)}</p>
      </div>`;
  }

  function showError(error) {
    appView.innerHTML = `
      <div class="panel">
        <h2>SESSION CENTRE UNAVAILABLE</h2>
        <p class="status">${escapeHTML(error.message)}</p>
        <button id="sessionRetry" class="refresh-btn">TRY AGAIN</button>
      </div>`;

    document.getElementById("sessionRetry")
      ?.addEventListener("click", loadMeetings);
  }

  function renderShell() {
    appView.innerHTML = `
      <style>
        .sc-heading{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px}
        .sc-controls{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin:16px 0}
        .sc-controls label{display:block;font-size:11px;margin-bottom:7px;color:#aaa;letter-spacing:1px}
        .sc-controls select{width:100%;padding:12px;border-radius:8px;border:1px solid #444;background:#17171d;color:white;font-size:14px}
        .sc-session-list{display:flex;flex-wrap:wrap;gap:8px;margin:14px 0}
        .sc-session-list button{background:#202027;color:#ddd;border:1px solid #444;padding:10px 13px;border-radius:7px;cursor:pointer}
        .sc-session-list button.active{background:#e10600;border-color:#e10600;color:white}
        .sc-table-wrap{overflow-x:auto;width:100%}
        .sc-table{width:100%;min-width:650px;border-collapse:collapse;font-size:13px}
        .sc-table th{color:#aaa;font-size:11px;text-align:left;padding:12px 9px;border-bottom:1px solid #444}
        .sc-table td{padding:12px 9px;border-bottom:1px solid #303038}
        .sc-table tr:first-child .sc-position{color:#f5c542;font-weight:bold}
        .sc-position,.sc-driver{font-weight:bold}
        .sc-team,.sc-note{color:#aaa}
        .sc-note{font-size:12px;line-height:1.6}
        .sc-refresh{background:#e10600;color:white;border:0;border-radius:7px;padding:11px 15px;cursor:pointer}
      </style>

      <div class="panel">
        <div class="sc-heading">
          <div>
            <h2>SESSION CENTRE</h2>
            <p class="status">GRAND PRIX ARCHIVE & SESSION RESULTS</p>
          </div>
          <button class="sc-refresh" id="scRefresh">↻ REFRESH</button>
        </div>

        <div class="sc-controls">
          <div>
            <label for="scYear">SEASON</label>
            <select id="scYear">
              ${years.map(year => `
                <option value="${year}" ${year === currentYear ? "selected" : ""}>${year}</option>
              `).join("")}
            </select>
          </div>

          <div>
            <label for="scMeeting">GRAND PRIX</label>
            <select id="scMeeting">
              <option>Loading...</option>
            </select>
          </div>
        </div>

        <div id="scSessionButtons" class="sc-session-list"></div>
        <div id="scResults">
          <p class="status">Select a Grand Prix and session.</p>
        </div>
      </div>

      <p class="sc-note">
        Historical session data from OpenF1. Results may take a few minutes
        to become available after a session ends.
      </p>`;

    document.getElementById("scYear").addEventListener("change", event => {
      currentYear = Number(event.target.value);
      selectedMeeting = null;
      selectedSession = null;
      loadMeetings();
    });

    document.getElementById("scMeeting").addEventListener("change", event => {
      selectedMeeting = Number(event.target.value);
      selectedSession = null;
      loadSessions();
    });

    document.getElementById("scRefresh").addEventListener("click", () => {
      if (selectedMeeting) loadSessions();
      else loadMeetings();
    });
  }

  async function loadMeetings() {
    if (!isActive) return;

    const id = ++requestId;
    showLoading("Loading Grand Prix calendar...");

    try {
      const data = await getData(`/meetings?year=${currentYear}`);

      if (!isActive || id !== requestId) return;

      meetings = data
        .filter(meeting => !meeting.is_cancelled)
        .sort((a, b) => new Date(a.date_start) - new Date(b.date_start));

      renderShell();

      const meetingSelect = document.getElementById("scMeeting");

      if (!meetings.length) {
        meetingSelect.innerHTML = `<option value="">No Grand Prix data available</option>`;
        return;
      }

      meetingSelect.innerHTML = meetings.map(meeting => `
        <option value="${meeting.meeting_key}">
          ${escapeHTML(meeting.meeting_name)}
        </option>
      `).join("");

      const now = Date.now();
      const latestMeeting = [...meetings].reverse().find(meeting =>
        new Date(meeting.date_start).getTime() <= now
      );

      selectedMeeting = latestMeeting
        ? latestMeeting.meeting_key
        : meetings[0].meeting_key;

      meetingSelect.value = String(selectedMeeting);
      await loadSessions();

    } catch (error) {
      if (isActive && id === requestId) showError(error);
    }
  }

  async function loadSessions() {
    if (!isActive || !selectedMeeting) return;

    const id = ++requestId;
    showLoading("Loading session schedule...");

    try {
      const data = await getData(`/sessions?meeting_key=${selectedMeeting}`);

      if (!isActive || id !== requestId) return;

      sessions = data.sort((a, b) =>
        new Date(a.date_start) - new Date(b.date_start)
      );

      renderShell();

      const meetingSelect = document.getElementById("scMeeting");
      meetingSelect.innerHTML = meetings.map(meeting => `
        <option value="${meeting.meeting_key}">
          ${escapeHTML(meeting.meeting_name)}
        </option>
      `).join("");

      meetingSelect.value = String(selectedMeeting);

      renderSessionButtons();

      if (sessions.length) {
        const now = Date.now();
        const latestSession = [...sessions].reverse().find(session =>
          new Date(session.date_start).getTime() <= now
        );

        selectedSession = latestSession
          ? latestSession.session_key
          : sessions[0].session_key;

        renderSessionButtons();
        await loadResults();
      } else {
        document.getElementById("scResults").innerHTML =
          `<p class="status">No sessions are listed for this Grand Prix.</p>`;
      }

    } catch (error) {
      if (isActive && id === requestId) showError(error);
    }
  }

  function renderSessionButtons() {
    const container = document.getElementById("scSessionButtons");

    container.innerHTML = sessions.map(session => `
      <button type="button"
        data-session="${session.session_key}"
        class="${Number(session.session_key) === Number(selectedSession) ? "active" : ""}">
        ${escapeHTML(getSessionLabel(session))}
      </button>
    `).join("");

    container.querySelectorAll("button").forEach(button => {
      button.addEventListener("click", () => {
        selectedSession = Number(button.dataset.session);
        renderSessionButtons();
        loadResults();
      });
    });
  }

  async function loadResults() {
    if (!isActive || !selectedSession) return;

    const id = ++requestId;
    const session = sessions.find(item =>
      Number(item.session_key) === Number(selectedSession)
    );

    if (!session) return;

    const resultBox = document.getElementById("scResults");
    resultBox.innerHTML =
      `<p class="status">Loading ${escapeHTML(session.session_name)} results...</p>`;

    try {
      const [results, drivers, grid] = await Promise.all([
        getData(`/session_result?session_key=${selectedSession}`),
        getData(`/drivers?session_key=${selectedSession}`),
        getData(`/starting_grid?session_key=${selectedSession}`).catch(() => [])
      ]);

      if (!isActive || id !== requestId) return;

      renderResults(session, results, drivers, grid);

    } catch (error) {
      if (!isActive || id !== requestId) return;

      resultBox.innerHTML =
        `<p class="status">Could not load session results: ${escapeHTML(error.message)}</p>`;
    }
  }

  function renderResults(session, results, drivers, grid) {
    const resultBox = document.getElementById("scResults");
    const now = Date.now();

    const start = new Date(session.date_start).getTime();
    const end = new Date(session.date_end).getTime();

    const isFuture = now < start;
    const isRunning = now >= start && now <= end;

    if (isFuture) {
      resultBox.innerHTML = `
        <div class="panel">
          <h3>${escapeHTML(session.session_name)}</h3>
          <p class="status">SESSION NOT STARTED</p>
          <p class="sc-note">Scheduled start: ${escapeHTML(new Date(session.date_start).toLocaleString())}</p>
        </div>`;
      return;
    }

    if (!results.length) {
      resultBox.innerHTML = `
        <div class="panel">
          <h3>${escapeHTML(session.session_name)}</h3>
          <p class="status">
            ${isRunning
              ? "SESSION IN PROGRESS — FINAL RESULTS NOT AVAILABLE YET."
              : "OFFICIAL SESSION RESULTS HAVE NOT BEEN PUBLISHED YET."}
          </p>
        </div>`;
      return;
    }

    const driverMap = new Map();
    drivers.forEach(driver => {
      driverMap.set(Number(driver.driver_number), driver);
    });

    const gridMap = new Map();
    grid.forEach(item => {
      gridMap.set(Number(item.driver_number), item.position);
    });

    const sorted = [...results].sort((a, b) =>
      (Number(a.position) || 999) - (Number(b.position) || 999)
    );

    const isQualifying = session.session_name.toLowerCase().includes("qualifying");

    resultBox.innerHTML = `
      <div class="panel">
        <h3>${escapeHTML(session.session_name.toUpperCase())}</h3>
        <p class="status">
          ${escapeHTML(session.meeting_name || "")}
          · ${escapeHTML(session.year || currentYear)}
        </p>

        <div class="sc-table-wrap">
          <table class="sc-table">
            <thead>
              <tr>
                <th>POS</th><th>DRIVER</th><th>TEAM</th>
                <th>GRID</th><th>LAPS</th>
                <th>${isQualifying ? "SESSION TIME" : "TIME / GAP"}</th>
                <th>PTS</th>
              </tr>
            </thead>
            <tbody>
              ${sorted.map(item => {
                const driver = driverMap.get(Number(item.driver_number)) || {};
                const name = driver.full_name || `Driver ${item.driver_number}`;
                const team = driver.team_name || "—";
                const duration = formatTime(item.duration);
                const gap = formatGap(item.gap_to_leader);

                const timeDisplay = isQualifying
                  ? duration
                  : (Number(item.position) === 1 ? duration : gap);

                const status = item.dsq ? "DSQ"
                  : item.dnf ? "DNF"
                  : item.dns ? "DNS" : "";

                return `
                  <tr>
                    <td class="sc-position">${escapeHTML(item.position ?? status ?? "—")}</td>
                    <td>
                      <span class="sc-driver">${escapeHTML(name)}</span><br>
                      <small>${escapeHTML(driver.name_acronym || "")} · #${escapeHTML(item.driver_number)}</small>
                    </td>
                    <td class="sc-team">${escapeHTML(team)}</td>
                    <td>${escapeHTML(gridMap.get(Number(item.driver_number)) ?? "—")}</td>
                    <td>${escapeHTML(item.number_of_laps ?? "—")}</td>
                    <td>${escapeHTML(timeDisplay)}</td>
                    <td>—</td>
                  </tr>`;
              }).join("")}
            </tbody>
          </table>
        </div>

        <p class="sc-note">
          PTS are not included in OpenF1's session-result endpoint.
          Grid positions are shown when available.
        </p>
      </div>`;
  }

  // Public function called by app.js
  window.loadSessionCentre = function() {
    isActive = true;
    loadMeetings();
  };

})();
