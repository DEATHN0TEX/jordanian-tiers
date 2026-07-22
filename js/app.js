// Jordanian MCTiers Main Application Logic

// --- STATE MANAGEMENT ---
let players = [];
let testers = [];
let activeGamemode = "overall";
let searchQuery = "";
let editorSearchQuery = "";
let isEditorModeActive = false;
let databaseFileHandle = null;

// --- INITIALIZATION ---
async function initApp() {
  await loadDatabase();
  initializeNavbar();
  renderTierList();
  setupEventListeners();
  updateLiveStats();
  // show a small badge so users can confirm where data came from
  try { window.__mctiers_players_count = players ? players.length : 0; } catch (e) {}
  try { console.log('MCTiers loaded:', window.__mctiers_data_source, 'players=', window.__mctiers_players_count); } catch (e) {}
  try { showDataSourceBadge(); } catch (e) {}
}

// Visual indicator for data source (small badge)
function showDataSourceBadge() {
  try {
    const existing = document.getElementById('mctiers-data-badge');
    if (existing) existing.remove();

    const badge = document.createElement('div');
    badge.id = 'mctiers-data-badge';
    badge.style.position = 'fixed';
    badge.style.right = '12px';
    badge.style.bottom = '12px';
    badge.style.zIndex = 9999;
    badge.style.padding = '6px 10px';
    badge.style.background = 'rgba(0,0,0,0.75)';
    badge.style.color = '#fff';
    badge.style.fontSize = '12px';
    badge.style.borderRadius = '8px';
    badge.style.boxShadow = '0 4px 12px rgba(0,0,0,0.25)';
    badge.style.opacity = '0';
    const src = window.__mctiers_data_source || 'unknown';
    const count = (typeof window.__mctiers_players_count !== 'undefined') ? window.__mctiers_players_count : (players ? players.length : 0);
    badge.textContent = `Data: ${src} · Players: ${count}`;
    document.body.appendChild(badge);
    // fade in
    setTimeout(() => { badge.style.transition = 'opacity 240ms'; badge.style.opacity = '0.97'; }, 10);
    // auto-hide after 6s
    setTimeout(() => { if (badge.parentNode) badge.parentNode.removeChild(badge); }, 6000);
  } catch (e) {
    // ignore
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  // If the script was loaded after DOMContentLoaded (dynamic loader), initialize immediately
  initApp();
}

// Load players & testers from LocalStorage or fall back to INITIAL_PLAYERS & INITIAL_TESTERS
async function loadDatabase() {
  // Prefer the embedded `js/database.js` globals when available (this is the
  // authoritative stored player data the admin panel writes).
  if (typeof INITIAL_PLAYERS !== 'undefined' && Array.isArray(INITIAL_PLAYERS) && INITIAL_PLAYERS.length > 0) {
    players = JSON.parse(JSON.stringify(INITIAL_PLAYERS));
    testers = (typeof INITIAL_TESTERS !== 'undefined' && Array.isArray(INITIAL_TESTERS)) ? JSON.parse(JSON.stringify(INITIAL_TESTERS)) : [];
    // Persist to LocalStorage for offline use
    localStorage.setItem('jordan_mctiers_players', JSON.stringify(players));
    localStorage.setItem('jordan_mctiers_testers', JSON.stringify(testers));
    // record data source
    try { window.__mctiers_data_source = 'database.js'; } catch (e) {}
  } else {
    // Try to load authoritative JSON from the server when served via HTTP(S).
    if (window.location.protocol !== 'file:') {
      try {
        const apiUrl = `${window.location.origin}/api/database`;
        const res = await fetch(apiUrl, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          if (data && data.players) {
            players = data.players;
            testers = data.testers || [];
            // Persist to LocalStorage for offline use
            localStorage.setItem('jordan_mctiers_players', JSON.stringify(players));
            localStorage.setItem('jordan_mctiers_testers', JSON.stringify(testers));
            try { window.__mctiers_data_source = 'api'; } catch (e) {}
          }
        }
      } catch (err) {
        console.warn('Could not fetch remote database, falling back to local copy.', err);
      }
    }
  }

  // If players/testers not populated from server, fall back to LocalStorage or bundled file
  if (!players || players.length === 0) {
    const localPlayers = localStorage.getItem('jordan_mctiers_players');
    if (localPlayers) {
      try {
        players = JSON.parse(localPlayers);
        try { window.__mctiers_data_source = 'localStorage'; } catch (e) {}
      } catch (e) {
        console.error('Error parsing local player database, resetting.', e);
        players = (typeof INITIAL_PLAYERS !== 'undefined' && Array.isArray(INITIAL_PLAYERS)) ? JSON.parse(JSON.stringify(INITIAL_PLAYERS)) : [];
        try { window.__mctiers_data_source = (typeof INITIAL_PLAYERS !== 'undefined' && Array.isArray(INITIAL_PLAYERS)) ? 'database.js' : 'none'; } catch (e) {}
        saveDatabase();
      }
    } else {
      players = (typeof INITIAL_PLAYERS !== 'undefined' && Array.isArray(INITIAL_PLAYERS)) ? JSON.parse(JSON.stringify(INITIAL_PLAYERS)) : [];
      try { window.__mctiers_data_source = (players && players.length > 0) ? 'database.js' : 'none'; } catch (e) {}
      saveDatabase();
    }
  }

  // Normalize overall tiers on startup based on the updated point system thresholds
  let playersUpdated = false;
  players.forEach(p => {
    const computedOverall = calculateOverallTier(p.tiers);
    if (p.tiers.overall !== computedOverall) {
      p.tiers.overall = computedOverall;
      playersUpdated = true;
    }
  });
  if (playersUpdated) {
    saveDatabase();
  }

  if (!testers || testers.length === 0) {
    const localTesters = localStorage.getItem('jordan_mctiers_testers');
    if (localTesters) {
      try {
        testers = JSON.parse(localTesters);
      } catch (e) {
        console.error('Error parsing local testers database, resetting.', e);
        testers = [...INITIAL_TESTERS];
        saveTesters();
      }
    } else {
      testers = (typeof INITIAL_TESTERS !== 'undefined' && Array.isArray(INITIAL_TESTERS)) ? JSON.parse(JSON.stringify(INITIAL_TESTERS)) : [];
      saveTesters();
    }
  }
}

// Save players database to LocalStorage
function saveDatabase() {
  localStorage.setItem("jordan_mctiers_players", JSON.stringify(players));
  updateLiveStats();
  syncDatabaseFile();
  // Send to server for auto-sync
  syncToServer();
}

// Save testers database to LocalStorage
function saveTesters() {
  localStorage.setItem("jordan_mctiers_testers", JSON.stringify(testers));
  updateLiveStats();
  syncDatabaseFile();
  // Send to server for auto-sync
  syncToServer();
}

// Sync data to server (if running locally)
function syncToServer() {
  const apiUrl = window.location.protocol === 'file:'
    ? 'http://localhost:3000/api/save-database'
    : `${window.location.origin}/api/save-database`;

  try {
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ players, testers })
    })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Database sync failed');
      }

      if (data.success) {
        console.log('✅ Data synced to server');
      }
    })
    .catch(async (err) => {
      console.warn('⚠️ Could not sync to the Node server. Trying to save the database file directly instead.', err);
      await saveDatabaseFileToDisk({ silent: true });
      if (!window.__mctiers_sync_warned) {
        window.__mctiers_sync_warned = true;
        showToast('Saved a local database.js file. Choose the project file to overwrite it.');
      }
    });
  } catch (err) {
    console.warn('⚠️ Sync failed before request was sent.', err);
  }
}

async function saveDatabaseFileToDisk({ silent = false } = {}) {
  const jsContent = syncDatabaseFile();

  if (databaseFileHandle) {
    try {
      const writable = await databaseFileHandle.createWritable();
      await writable.write(jsContent);
      await writable.close();
      if (!silent) {
        showToast('Saved database.js');
      }
      return true;
    } catch (err) {
      console.warn('⚠️ Reusing saved file handle failed, prompting again.', err);
      databaseFileHandle = null;
    }
  }

  if (window.showSaveFilePicker) {
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'database.js',
        types: [{
          description: 'JavaScript files',
          accept: { 'text/javascript': ['.js'] }
        }]
      });

      databaseFileHandle = handle;
      const writable = await handle.createWritable();
      await writable.write(jsContent);
      await writable.close();

      if (!silent) {
        showToast('Saved database.js');
      }
      return true;
    } catch (err) {
      if (err && err.name !== 'AbortError') {
        console.warn('⚠️ File picker save failed, falling back to download.', err);
      }
    }
  }

  const blob = new Blob([jsContent], { type: 'text/javascript;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'database.js';
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);

  if (!silent) {
    showToast('Downloaded database.js');
  }
  return true;
}

// Auto-sync the current state back to database.js format
function syncDatabaseFile() {
  const jsContent = `// Player & Tester Database for Jordanian MCTiers
// This file is auto-generated by the Admin Panel. Do not edit manually.

const INITIAL_PLAYERS = ${JSON.stringify(players, null, 2)};

const INITIAL_TESTERS = ${JSON.stringify(testers, null, 2)};
`;
  
  // Store in localStorage for public site to access
  localStorage.setItem("jordan_mctiers_sync_export", jsContent);
  return jsContent;
}

// --- POINT SYSTEM (Exact MCTiers values) ---
// Source: MCTiers official point distribution
// Tier 5 & 4 (Base): LT5=1, HT5=2, LT4=3, HT4=5
// Tier 3 & 2 (Intermediate): LT3=10, HT3=16, LT2=24, HT2=32
// Tier 1 (Elite): LT1=48, HT1=60
const TIER_POINTS = {
  "HT1": 60, "LT1": 48,
  "HT2": 32, "LT2": 24,
  "HT3": 16, "LT3": 10,
  "HT4":  5, "LT4":  3,
  "HT5":  2, "LT5":  1,
  "None": 0, "":    0
};

// Returns total points for a player across all gamemodes (excluding overall key)
// Max possible: 9 gamemodes × 60 pts = 540 pts
function calculateTotalPoints(playerTiers) {
  let total = 0;
  for (const gmId in playerTiers) {
    if (gmId !== "overall") {
      total += TIER_POINTS[playerTiers[gmId]] || 0;
    }
  }
  return total;
}

// Derives the Overall tier badge from total point score
// Thresholds scaled against 9-gamemode max of 540 pts
function calculateOverallTier(playerTiers) {
  const total = calculateTotalPoints(playerTiers);
  if (total === 0)   return "None";
  if (total >= 450)  return "HT1";
  if (total >= 350)  return "LT1";
  if (total >= 250)  return "HT2";
  if (total >= 180)  return "LT2";
  if (total >= 110)  return "HT3";
  if (total >= 70)   return "LT3";
  if (total >= 35)   return "HT4";
  if (total >= 18)   return "LT4";
  if (total >= 6)    return "HT5";
  return "LT5";
}

// Update stats in the header
function updateLiveStats() {
  const countSpan = document.getElementById("total-players-count");
  if (countSpan) countSpan.textContent = players.length;

  const testersSpan = document.getElementById("total-testers-count");
  if (testersSpan) testersSpan.textContent = testers.length;

  const editorCountSpan = document.getElementById("editor-players-count");
  if (editorCountSpan) editorCountSpan.textContent = players.length;

  const editorTestersSpan = document.getElementById("editor-testers-count");
  if (editorTestersSpan) editorTestersSpan.textContent = testers.length;
}

// --- NAVBAR RENDERING ---
function initializeNavbar() {
  const navbar = document.getElementById("gamemode-nav");
  navbar.innerHTML = "";

  INITIAL_GAMEMODES.forEach((gm) => {
    const tabButton = document.createElement("button");
    tabButton.className = `nav-tab ${gm.id === activeGamemode ? "active" : ""}`;
    tabButton.dataset.gamemode = gm.id;
    tabButton.title = gm.description;
    
    tabButton.innerHTML = `
      <div class="nav-tab-icon">${gm.icon}</div>
      <span>${gm.name}</span>
    `;

    tabButton.addEventListener("click", () => {
      document.querySelectorAll(".nav-tab").forEach(tab => tab.classList.remove("active"));
      tabButton.classList.add("active");
      activeGamemode = gm.id;
      renderTierList();
    });

    navbar.appendChild(tabButton);
  });
}

// --- PLAYER TITLE HELPER ---
function getPlayerTitle(overallTier) {
  const titles = {
    "HT1": "Combat Legend",
    "LT1": "Combat Master",
    "HT2": "Elite Fighter",
    "LT2": "Expert Fighter",
    "HT3": "Advanced Player",
    "LT3": "Skilled Player",
    "HT4": "Intermediate",
    "LT4": "Developing",
    "HT5": "Beginner",
    "LT5": "Newcomer",
    "None": "Unranked"
  };
  return titles[overallTier] || "Unranked";
}

// --- TIERLIST RENDERING ---
const TIER_ORDER = ["HT1", "LT1", "HT2", "LT2", "HT3", "LT3", "HT4", "LT4", "HT5", "LT5"];

function renderTierList() {
  const container = document.getElementById("tierlist-rows");
  container.innerHTML = "";

  const noResultsCard = document.getElementById("no-results");

  const filteredPlayers = players.filter(player => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const nameMatch = player.username.toLowerCase().includes(query);
    const nickMatch = player.nickname && player.nickname.toLowerCase().includes(query);
    const cityMatch = player.city && player.city.toLowerCase().includes(query);
    const playerTier = player.tiers[activeGamemode] || "None";
    const tierMatch = playerTier.toLowerCase().includes(query);
    const badgeMatch = player.badges && player.badges.some(b => b.toLowerCase().includes(query));
    return nameMatch || nickMatch || cityMatch || tierMatch || badgeMatch;
  });

  if (activeGamemode === "overall") {
    // ---- OVERALL: Flat ranked leaderboard (MCTiers style) ----
    const ranked = filteredPlayers
      .map(p => ({ player: p, pts: calculateTotalPoints(p.tiers) }))
      .filter(({ pts }) => pts > 0)
      .sort((a, b) => b.pts - a.pts);

    if (ranked.length === 0) {
      noResultsCard.classList.remove("hidden");
      return;
    }
    noResultsCard.classList.add("hidden");

    // Header row
    const header = document.createElement("div");
    header.className = "overall-leaderboard-header";
    header.innerHTML = `
      <span class="lb-col-rank">#</span>
      <span class="lb-col-player">PLAYER</span>
      <span class="lb-col-region">REGION</span>
      <span class="lb-col-tiers">TIERS</span>
    `;
    container.appendChild(header);

    ranked.forEach(({ player, pts }, index) => {
      const row = createOverallRankRow(player, pts, index + 1);
      container.appendChild(row);
    });

  } else {
    // ---- OTHER GAMEMODES: 5 columns vertical list (MCTiers style) ----
    const MAIN_TIERS = [
      { level: 1, name: "Tier 1", class: "gold" },
      { level: 2, name: "Tier 2", class: "silver" },
      { level: 3, name: "Tier 3", class: "bronze" },
      { level: 4, name: "Tier 4", class: "dark" },
      { level: 5, name: "Tier 5", class: "dark" }
    ];

    const playersByMainTier = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    let totalVisible = 0;

    filteredPlayers.forEach(player => {
      const t = player.tiers[activeGamemode] || "None";
      if (t !== "None") {
        const level = parseInt(t.charAt(2)); // e.g. HT1 -> 1, LT3 -> 3
        if (level >= 1 && level <= 5) {
          playersByMainTier[level].push({ player, tier: t });
          totalVisible++;
        }
      }
    });

    if (totalVisible === 0) {
      noResultsCard.classList.remove("hidden");
      return;
    }
    noResultsCard.classList.add("hidden");

    // Sort players in each main tier: HT first, then LT, then alphabetical
    for (let level = 1; level <= 5; level++) {
      playersByMainTier[level].sort((a, b) => {
        const aIsHigh = a.tier.startsWith("HT");
        const bIsHigh = b.tier.startsWith("HT");
        if (aIsHigh && !bIsHigh) return -1;
        if (!aIsHigh && bIsHigh) return 1;
        return a.player.username.localeCompare(b.player.username);
      });
    }

    const grid = document.createElement("div");
    grid.className = "gamemode-columns-grid";

    MAIN_TIERS.forEach(tierInfo => {
      const column = document.createElement("div");
      column.className = "tier-column";
      
      const columnPlayers = playersByMainTier[tierInfo.level];
      
      let trophyColor = "var(--text-muted)";
      if (tierInfo.level === 1) trophyColor = "#f5c518";
      else if (tierInfo.level === 2) trophyColor = "#adb5bd";
      else if (tierInfo.level === 3) trophyColor = "#cd7f32";

      column.innerHTML = `
        <div class="tier-column-header header-${tierInfo.class}">
          <svg class="tier-column-trophy" style="color: ${trophyColor}" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2a5 5 0 0 0-5 5v3c0 2.2 1.8 4 4 4h2c2.2 0 4-1.8 4-4V7a5 5 0 0 0-5-5z"/>
            <path d="M19 6H17V8H19a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1z"/>
            <path d="M5 6H7V8H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1z"/>
            <path d="M12 16c-2.2 0-4-1.8-4-4h8c0 2.2-1.8 4-4 4z"/>
            <rect x="10" y="16" width="4" height="5" rx="1"/>
            <rect x="8" y="21" width="8" height="2" rx="1"/>
          </svg>
          <span class="tier-column-title">${tierInfo.name}</span>
        </div>
        <div class="tier-column-list" id="col-list-${tierInfo.level}">
          <!-- Player items -->
        </div>
      `;

      grid.appendChild(column);

      // Populate list items safely
      setTimeout(() => {
        const listContainer = document.getElementById(`col-list-${tierInfo.level}`);
        if (listContainer) {
          if (columnPlayers.length === 0) {
            listContainer.innerHTML = `<div class="tier-column-empty">No players ranked</div>`;
          } else {
            columnPlayers.forEach(({ player, tier }) => {
              const item = createColumnPlayerCard(player, tier);
              listContainer.appendChild(item);
            });
          }
        }
      }, 0);
    });

    container.appendChild(grid);
  }
}

// Creates a column player card for vertical columns
function createColumnPlayerCard(player, tier) {
  const card = document.createElement("div");
  const isHigh = tier.startsWith("HT");
  card.className = `column-player-card ${isHigh ? "high-tier" : "low-tier"}`;
  
  const cleanName = (player.username||"").trim();
  const avatarUrl = `https://visage.surgeplay.com/bust/64/${encodeURIComponent(cleanName)}`;

  const chevronSVG = isHigh 
    ? `<svg class="tier-chevron-icon high" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="17 11 12 6 7 11"></polyline>
        <polyline points="17 18 12 13 7 18"></polyline>
       </svg>`
    : `<svg class="tier-chevron-icon low" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="17 15 12 10 7 15"></polyline>
       </svg>`;

  card.innerHTML = `
    <img class="column-player-avatar" src="${avatarUrl}" alt="${player.username}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanName)}?size=64&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/avatars/MHF_Steve?size=64'; } })(this)">
    <span class="column-player-name">${player.username}</span>
    <div class="column-player-right">
      ${chevronSVG}
    </div>
  `;

  card.addEventListener("click", () => openPlayerModal(player));
  return card;
}

// Creates a flat leaderboard row for the Overall tab
function createOverallRankRow(player, pts, rank) {
  const row = document.createElement("div");
  const overallTier = player.tiers["overall"] || "None";
  const title = getPlayerTitle(overallTier);
  row.className = `overall-rank-row top-three rank-${rank}`;

  const cleanName = (player.username||"").trim();
  const bustUrl = `https://visage.surgeplay.com/bust/256/${encodeURIComponent(cleanName)}`;
  const badgeColorClass = rank <= 3 ? `badge-rank-${rank}` : "badge-rank-default";

  const badgeHTML = `
    <div class="lb-top3-badge ${badgeColorClass}">
      <span class="lb-top3-num">${rank}.</span>
    </div>
    <img class="lb-top3-body" src="${bustUrl}" alt="${player.username}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanName)}?size=256&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/avatars/MHF_Steve?size=256'; } })(this)">
  `;

  // Per-gamemode tier chips (skip overall)
  const gamemodeChips = INITIAL_GAMEMODES
    .filter(gm => gm.id !== "overall")
    .map(gm => {
      const t = player.tiers[gm.id] || "None";
      if (t === "None") return ``;
      return `
        <div class="lb-tier-chip" title="${gm.name}: ${t}">
          <div class="lb-tier-chip-icon">${gm.icon}</div>
          <span class="lb-tier-chip-label badge-${t.toLowerCase()}">${t}</span>
        </div>
      `;
    }).join("");

  row.innerHTML = `
    ${badgeHTML}
    <div class="lb-player-cell no-avatar">
      <div class="lb-player-info">
        <span class="lb-player-name">${player.username}</span>
        <span class="lb-player-title">
          <svg class="lb-title-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
            <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
            <path d="M4 22h16"/>
            <path d="M10 14.66V17c0 .55-.45 1-1 1H4v2h16v-2h-5c-.55 0-1-.45-1-1v-2.34"/>
            <path d="M12 2a6 6 0 0 1 6 6v5a6 6 0 0 1-6 6 6 6 0 0 1-6-6V8a6 6 0 0 1 6-6z"/>
          </svg>
          ${title} <span class="lb-points">(${pts} points)</span>
        </span>
      </div>
    </div>
    <div class="lb-region-cell">
      <span class="lb-region-badge">JO</span>
    </div>
    <div class="lb-tiers-cell">
      ${gamemodeChips || '<span style="font-size:0.75rem;color:var(--text-muted)">No active tiers</span>'}
    </div>
  `;

  row.addEventListener("click", () => openPlayerModal(player));
  return row;
}

function createPlayerCard(player) {
  const card = document.createElement("div");
  const tier = player.tiers[activeGamemode] || "None";
  card.className = `player-card ${tier.toLowerCase()}-edge`;
  card.dataset.username = player.username;

  const cleanNameCard = (player.username||"").trim();
  const avatarUrl = `https://visage.surgeplay.com/bust/128/${encodeURIComponent(cleanNameCard)}`;
  const totalPts = calculateTotalPoints(player.tiers);
  const isOverall = activeGamemode === "overall";

  let detailsHTML = `
    <div class="player-avatar-wrapper">
      <img class="player-avatar" src="${avatarUrl}" alt="${player.username}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanNameCard)}?size=128&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/avatars/MHF_Steve?size=128'; } })(this)">
    </div>
    <div class="player-info">
      <span class="player-name">${player.username}</span>
      <span class="player-subtext">
        <span>${player.nickname || "Player"}</span>
        <span class="player-city-dot">•</span>
        <span>${player.city}</span>
      </span>
    </div>
  `;

  if (isOverall) {
    detailsHTML += `
      <div class="player-overall-right">
        <div class="player-mini-badge badge-${tier.toLowerCase()}">${tier}</div>
        <div class="player-points-chip">${totalPts.toLocaleString()} <span>pts</span></div>
      </div>
    `;
  }

  card.innerHTML = detailsHTML;

  card.addEventListener("click", () => {
    openPlayerModal(player);
  });

  return card;
}

// --- PLAYER DETAILS MODAL ---
function openPlayerModal(player) {
  const modal = document.getElementById("player-modal");
  
  const skinImg = document.getElementById("profile-skin-img");
  if (!skinImg) return;

  const cleanModalName = (player.username||"").trim();
  const sources = [
    `https://visage.surgeplay.com/body/512/${encodeURIComponent(cleanModalName)}`,
    `https://crafatar.com/renders/body/${encodeURIComponent(cleanModalName)}?size=512&default=MHF_Steve`,
    `https://minotar.net/armor/body/${encodeURIComponent(cleanModalName)}/512.png`,
    `https://visage.surgeplay.com/bust/512/${encodeURIComponent(cleanModalName)}`,
    `https://crafatar.com/renders/bust/${encodeURIComponent(cleanModalName)}?size=512&default=MHF_Steve`,
    `https://crafatar.com/avatars/MHF_Steve?size=512`
  ];

  let currentSourceIndex = 0;
  skinImg.alt = `${player.username} Skin`;
  skinImg.style.visibility = "visible";
  skinImg.dataset.currentSource = currentSourceIndex;

  const trySource = index => {
    if (index >= sources.length) {
      skinImg.onerror = null;
      return;
    }
    currentSourceIndex = index;
    skinImg.dataset.currentSource = index;
    skinImg.src = sources[index];
  };

  skinImg.onerror = function() {
    const idx = parseInt(this.dataset.currentSource || "0", 10);
    trySource(idx + 1);
  };

  skinImg.onload = function() {
    if (this.naturalWidth === 0 || this.naturalHeight === 0) {
      this.onerror && this.onerror();
    }
  };

  trySource(0);

  document.getElementById("profile-username").textContent = player.username;
  document.getElementById("profile-nickname").textContent = player.nickname ? `"${player.nickname}"` : "";
  document.getElementById("profile-city").textContent = `${player.city}, Jordan`;

  const badgesContainer = document.getElementById("profile-badges");
  badgesContainer.innerHTML = "";
  if (player.badges && player.badges.length > 0) {
    player.badges.forEach(b => {
      const badge = document.createElement("span");
      badge.className = "profile-badge-item";
      badge.textContent = b;
      badgesContainer.appendChild(badge);
    });
  }

  const discordLink = document.getElementById("profile-social-discord");
  const youtubeLink = document.getElementById("profile-social-youtube");

  if (player.socials && player.socials.discord) {
    discordLink.classList.remove("hidden");
    discordLink.href = "javascript:void(0)";
    discordLink.title = `Discord: ${player.socials.discord}`;
    discordLink.onclick = () => {
      navigator.clipboard.writeText(player.socials.discord);
      showToast(`Copied Discord: ${player.socials.discord}`);
    };
  } else {
    discordLink.classList.add("hidden");
  }

  if (player.socials && player.socials.youtube) {
    youtubeLink.classList.remove("hidden");
    youtubeLink.href = player.socials.youtube;
    youtubeLink.title = "View YouTube Channel";
    youtubeLink.onclick = null;
  } else {
    youtubeLink.classList.add("hidden");
  }

  const namemcLink = document.getElementById("profile-social-namemc");
  if (namemcLink) {
    namemcLink.href = `https://namemc.com/profile/${player.username}`;
    namemcLink.title = `View NameMC Profile for ${player.username}`;
  }

  const tiersGrid = document.getElementById("profile-tiers-grid");
  tiersGrid.innerHTML = "";

  INITIAL_GAMEMODES.forEach(gm => {
    const pTier = player.tiers[gm.id] || "None";
    const tierCard = document.createElement("div");
    tierCard.className = "modal-tier-card";
    
    let badgeHTML = `<span class="modal-tier-val badge-${pTier.toLowerCase()}">${pTier}</span>`;
    if (gm.id === "overall") {
      const totalPts = calculateTotalPoints(player.tiers);
      badgeHTML = `
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:2px;">
          <span class="modal-tier-val badge-${pTier.toLowerCase()}">${pTier}</span>
          <span style="font-size:0.7rem; color:var(--text-muted); font-weight:600;">${totalPts} pts</span>
        </div>
      `;
    }
    
    tierCard.innerHTML = `
      <div class="modal-tier-gm">
        <div style="width:18px; height:18px; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
          ${gm.icon}
        </div>
        <span style="margin-left:8px;">${gm.name}</span>
      </div>
      ${badgeHTML}
    `;
    
    tiersGrid.appendChild(tierCard);
  });

  const historyContainer = document.getElementById("profile-history");
  historyContainer.innerHTML = "";

  if (player.history && player.history.length > 0) {
    player.history.forEach(hist => {
      const isDemotion = hist.change.toLowerCase().includes("demot") || hist.change.toLowerCase().includes("down");

      const timelineItem = document.createElement("div");
      timelineItem.className = "timeline-item";

      timelineItem.innerHTML = `
        <div class="timeline-dot ${isDemotion ? "demotion" : "promotion"}"></div>
        <div class="timeline-content">
          <span class="timeline-meta">${hist.date} • <strong>${hist.gamemode}</strong></span>
          <span class="timeline-desc">${hist.change}</span>
          ${hist.note ? `<span class="timeline-note">"${hist.note}"</span>` : ""}
        </div>
      `;

      historyContainer.appendChild(timelineItem);
    });
  } else {
    historyContainer.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); font-style:italic;">No recorded history events.</p>`;
  }

  modal.classList.remove("hidden");
}

// --- INFO MODAL & RULES VIEW ---
function openInfoModal() {
  const modal = document.getElementById("info-modal");
  const testersGrid = document.getElementById("testers-grid");
  testersGrid.innerHTML = "";

  if (testers.length === 0) {
    testersGrid.innerHTML = `<p style="font-size:0.85rem; color:var(--text-muted); font-style:italic; grid-column: 1/-1; text-align:center;">No active testers assigned yet.</p>`;
  } else {
    testers.forEach(tester => {
      const card = document.createElement("div");
      card.className = "tester-card";
      const cleanTester = (tester.avatar||"").trim();
      const headUrl = `https://visage.surgeplay.com/bust/64/${encodeURIComponent(cleanTester)}`;
      const isOnline = tester.online === true;

      card.innerHTML = `
        <div class="tester-avatar-wrapper">
          <img class="tester-avatar" src="${headUrl}" alt="${tester.name}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanTester)}?size=64&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/renders/bust/MHF_Steve?size=64'; } })(this)">
        </div>
        <div class="tester-info">
          <span class="tester-name">${tester.name}</span>
          <span class="tester-role">${tester.role}</span>
          <span class="tester-status">Tests: ${tester.gamemodes.join(", ")}</span>
          <div class="tester-status-wrapper">
            <span class="status-dot ${isOnline ? "online" : "offline"}"></span>
            <span class="status-text ${isOnline ? "online" : "offline"}">${isOnline ? "Online" : "Offline"}</span>
          </div>
        </div>
      `;

      testersGrid.appendChild(card);
    });
  }

  modal.classList.remove("hidden");
}



// --- DATABASE EDITOR MODAL ---
function openEditorModal() {
  const modal = document.getElementById("editor-modal");
  
  // 1. Populate the player tiers assignment grid
  const assignGrid = document.getElementById("form-tiers-grid");
  assignGrid.innerHTML = "";

  INITIAL_GAMEMODES.filter(gm => gm.id !== "overall").forEach(gm => {
    const row = document.createElement("div");
    row.className = "form-tier-row";
    row.innerHTML = `
      <label for="assign-${gm.id}">${gm.name}</label>
      <select id="assign-${gm.id}" name="${gm.id}" class="editor-gm-select">
        <option value="None">None</option>
        ${TIER_ORDER.map(t => `<option value="${t}">${t}</option>`).join("")}
      </select>
    `;
    assignGrid.appendChild(row);
  });

  // 2. Populate tester form checkboxes
  populateTesterGamemodeCheckboxes();

  // Reset forms & render
  resetPlayerForm();
  resetTesterForm();
  renderEditorPlayersList();
  renderEditorTestersList();

  modal.classList.remove("hidden");
}

// Players Form Actions
function resetPlayerForm() {
  document.getElementById("player-form").reset();
  document.getElementById("edit-player-index").value = "-1";
  document.getElementById("form-title").textContent = "Add New Player";
  document.getElementById("btn-cancel-edit").classList.add("hidden");
  document.getElementById("btn-submit-player").textContent = "Save Player";
  document.getElementById("form-username").readOnly = false;
  document.getElementById("form-username").disabled = false;
  document.getElementById("btn-fetch-uuid").disabled = false;
}

function renderEditorPlayersList() {
  const list = document.getElementById("editor-players-list");
  list.innerHTML = "";

  const filtered = players.filter(p => {
    if (!editorSearchQuery) return true;
    const q = editorSearchQuery.toLowerCase();
    return p.username.toLowerCase().includes(q) || (p.nickname && p.nickname.toLowerCase().includes(q));
  });

  filtered.sort((a, b) => a.username.localeCompare(b.username));

  if (filtered.length === 0) {
    list.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:12px;">No players found.</p>`;
    return;
  }

  filtered.forEach(player => {
    const item = document.createElement("div");
    item.className = "editor-player-item";
    const cleanEditorName = (player.username||"").trim();
    const avatarUrl = `https://visage.surgeplay.com/bust/48/${encodeURIComponent(cleanEditorName)}`;

    item.innerHTML = `
      <img class="editor-player-avatar" src="${avatarUrl}" alt="${player.username}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanEditorName)}?size=48&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/renders/bust/MHF_Steve?size=48'; } })(this)">
      <span class="editor-player-name">${player.username} ${player.nickname ? `(${player.nickname})` : ""}</span>
      <div class="editor-player-actions">
        <button class="btn-edit-action" data-username="${player.username}">Edit</button>
        <button class="btn-delete-action" data-username="${player.username}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll(".btn-edit-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.username;
      const playerIndex = players.findIndex(p => p.username === username);
      if (playerIndex !== -1) {
        startPlayerEdit(playerIndex);
      }
    });
  });

  list.querySelectorAll(".btn-delete-action").forEach(btn => {
    btn.addEventListener("click", () => {
      const username = btn.dataset.username;
      if (confirm(`Are you sure you want to permanently delete player "${username}"?`)) {
        deletePlayer(username);
      }
    });
  });
}

function startPlayerEdit(index) {
  const player = players[index];
  
  document.getElementById("edit-player-index").value = index;
  document.getElementById("edit-player-username").value = player.username;
  document.getElementById("form-username").value = player.username;
  document.getElementById("form-username").readOnly = true;
  document.getElementById("btn-fetch-uuid").disabled = true;
  document.getElementById("form-nickname").value = player.nickname || "";
  document.getElementById("form-city").value = player.city;
  document.getElementById("form-discord").value = (player.socials && player.socials.discord) || "";
  document.getElementById("form-youtube").value = (player.socials && player.socials.youtube) || "";
  document.getElementById("form-badges").value = player.badges ? player.badges.join(", ") : "";
  document.getElementById("form-history-reason").value = "";

  INITIAL_GAMEMODES.filter(gm => gm.id !== "overall").forEach(gm => {
    const dropdown = document.getElementById(`assign-${gm.id}`);
    if (dropdown) {
      dropdown.value = player.tiers[gm.id] || "None";
    }
  });

  document.getElementById("form-title").textContent = `Edit Player: ${player.username}`;
  document.getElementById("btn-cancel-edit").classList.remove("hidden");
  document.getElementById("btn-submit-player").textContent = "Update Player";
}

function savePlayer(event) {
  event.preventDefault();
  
  try {
    const editIndex = parseInt(document.getElementById("edit-player-index").value);
    const username = document.getElementById("form-username").value.trim();
    const nickname = document.getElementById("form-nickname").value.trim();
    const city = document.getElementById("form-city").value;
    const discord = document.getElementById("form-discord").value.trim();
    const youtube = document.getElementById("form-youtube").value.trim();
    const badgesInput = document.getElementById("form-badges").value.trim();
    const historyReason = document.getElementById("form-history-reason").value.trim();

    if (!username) {
      alert("Minecraft Username is required.");
      return;
    }

    const badges = badgesInput ? badgesInput.split(",").map(b => b.trim()).filter(b => b !== "") : [];

    const newTiers = {};
    INITIAL_GAMEMODES.filter(gm => gm.id !== "overall").forEach(gm => {
      const select = document.getElementById(`assign-${gm.id}`);
      if (select) {
        newTiers[gm.id] = select.value;
      } else {
        newTiers[gm.id] = "None";
      }
    });

    newTiers["overall"] = calculateOverallTier(newTiers);
    let finalHistory = [];

    // If editIndex is valid (>= 0), we're editing an existing player
    if (editIndex >= 0) {
      const existingPlayer = players[editIndex];
      if (!existingPlayer) {
        throw new Error(`Player at index ${editIndex} not found in database.`);
      }
      finalHistory = [...(existingPlayer.history || [])];

      INITIAL_GAMEMODES.filter(gm => gm.id !== "overall").forEach(gm => {
        const oldTier = existingPlayer.tiers[gm.id] || "None";
        const newTier = newTiers[gm.id] || "None";

        if (oldTier !== newTier) {
          finalHistory.unshift({
            date: new Date().toISOString().split("T")[0],
            gamemode: gm.name,
            change: `${oldTier} → ${newTier}`,
            note: historyReason || "Tier updated via database manager"
          });
        }
      });

      existingPlayer.nickname = nickname;
      existingPlayer.city = city;
      existingPlayer.badges = badges;
      existingPlayer.socials = { discord, youtube };
      existingPlayer.tiers = newTiers;
      existingPlayer.history = finalHistory;

      showToast(`Player "${username}" updated successfully!`);
    } else {
      // New player
      if (players.some(p => p.username.toLowerCase() === username.toLowerCase())) {
        alert(`Player "${username}" already exists.`);
        return;
      }

      const initialTiersString = Object.entries(newTiers)
        .filter(([gm, tier]) => gm !== "overall" && tier !== "None")
        .map(([gm, tier]) => {
          const gmObj = INITIAL_GAMEMODES.find(g => g.id === gm);
          return `${gmObj ? gmObj.name : gm}: ${tier}`;
        })
        .join(", ");

      finalHistory = [{
        date: new Date().toISOString().split("T")[0],
        gamemode: "Overall",
        change: "None → Registered",
        note: historyReason || `Added with: ${initialTiersString || "No active tiers"}`
      }];

      const newPlayer = {
        username,
        nickname,
        city,
        badges,
        socials: { discord, youtube },
        tiers: newTiers,
        history: finalHistory
      };

      players.push(newPlayer);
      showToast(`Player "${username}" added successfully!`);
    }

    saveDatabase();
    resetPlayerForm();
    renderEditorPlayersList();
    renderTierList();
  } catch (err) {
    console.error("Error saving player:", err);
    alert("Failed to save player: " + err.message);
  }
}

function deletePlayer(username) {
  players = players.filter(p => p.username !== username);
  saveDatabase();
  renderEditorPlayersList();
  renderTierList();
  showToast(`Player "${username}" deleted.`);
}

// Testers Form Actions
function populateTesterGamemodeCheckboxes() {
  const container = document.getElementById("tester-gm-checkboxes");
  if (!container) return;
  container.innerHTML = "";

  INITIAL_GAMEMODES.filter(gm => gm.id !== "overall").forEach(gm => {
    const item = document.createElement("div");
    item.className = "checkbox-item";
    item.innerHTML = `
      <input type="checkbox" name="tester-gms" id="chk-tester-gm-${gm.id}" value="${gm.name}">
      <label for="chk-tester-gm-${gm.id}">${gm.name}</label>
    `;
    container.appendChild(item);
  });
}

function resetTesterForm() {
  document.getElementById("tester-form").reset();
  document.getElementById("edit-tester-index").value = "-1";
  document.getElementById("tester-form-title").textContent = "Add New Tester";
  document.getElementById("btn-cancel-tester-edit").classList.add("hidden");
  document.getElementById("btn-submit-tester").textContent = "Save Tester";
  document.getElementById("tester-name").disabled = false;
}

function renderEditorTestersList() {
  const list = document.getElementById("editor-testers-list");
  if (!list) return;
  list.innerHTML = "";

  if (testers.length === 0) {
    list.innerHTML = `<p style="font-size:0.8rem; color:var(--text-muted); text-align:center; padding:12px;">No testers registered.</p>`;
    return;
  }

  testers.forEach((tester, index) => {
    const item = document.createElement("div");
    item.className = "editor-player-item";
    const cleanTesterAvatar = (tester.avatar||"").trim();
    const avatarUrl = `https://visage.surgeplay.com/bust/48/${encodeURIComponent(cleanTesterAvatar)}`;
    const isOnline = tester.online === true;

    item.innerHTML = `
      <img class="editor-player-avatar" src="${avatarUrl}" alt="${tester.name}" onerror="(function(img){ if(!img.dataset._tried){ img.dataset._tried='1'; img.src='https://crafatar.com/renders/bust/${encodeURIComponent(cleanTesterAvatar)}?size=48&default=MHF_Steve'; } else { img.onerror=null; img.src='https://crafatar.com/renders/bust/MHF_Steve?size=48'; } })(this)">
      <div class="editor-player-name" style="display:flex; flex-direction:column;">
        <span style="font-weight:600; font-size:0.82rem;">${tester.name}</span>
        <span style="font-size:0.68rem; color:var(--text-muted);">${tester.role} (${isOnline ? "Online" : "Offline"})</span>
      </div>
      <div class="editor-player-actions">
        <button class="btn-edit-tester" data-index="${index}">Edit</button>
        <button class="btn-delete-tester" data-name="${tester.name}">Delete</button>
      </div>
    `;

    list.appendChild(item);
  });

  list.querySelectorAll(".btn-edit-tester").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.index);
      startTesterEdit(idx);
    });
  });

  list.querySelectorAll(".btn-delete-tester").forEach(btn => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.name;
      if (confirm(`Remove tester permissions for "${name}"?`)) {
        deleteTester(name);
      }
    });
  });
}

function startTesterEdit(index) {
  const tester = testers[index];

  document.getElementById("edit-tester-index").value = index;
  document.getElementById("tester-name").value = tester.name;
  document.getElementById("tester-name").disabled = true;
  document.getElementById("tester-role").value = tester.role;

  // Set checkboxes
  document.querySelectorAll("input[name='tester-gms']").forEach(chk => {
    chk.checked = tester.gamemodes.includes(chk.value);
  });

  // Set online status radio
  const onlineRadio = document.querySelector(`input[name="tester-status"][value="online"]`);
  const offlineRadio = document.querySelector(`input[name="tester-status"][value="offline"]`);
  if (tester.online) {
    onlineRadio.checked = true;
  } else {
    offlineRadio.checked = true;
  }

  document.getElementById("tester-form-title").textContent = `Edit Tester: ${tester.name}`;
  document.getElementById("btn-cancel-tester-edit").classList.remove("hidden");
  document.getElementById("btn-submit-tester").textContent = "Update Tester";
}

function saveTester(event) {
  event.preventDefault();

  const index = parseInt(document.getElementById("edit-tester-index").value);
  const name = document.getElementById("tester-name").value.trim();
  const role = document.getElementById("tester-role").value.trim();
  
  if (!name || !role) return;

  // Checked gamemodes
  const checkedGms = [];
  document.querySelectorAll("input[name='tester-gms']:checked").forEach(chk => {
    checkedGms.push(chk.value);
  });

  if (checkedGms.length === 0) {
    alert("Please select at least one gamemode this tester duels for.");
    return;
  }

  const isOnline = document.querySelector(`input[name="tester-status"]:checked`).value === "online";

  if (index === -1) {
    // Check duplication
    if (testers.some(t => t.name.toLowerCase() === name.toLowerCase())) {
      alert(`Tester "${name}" is already registered.`);
      return;
    }

    const newTester = {
      name,
      role,
      gamemodes: checkedGms,
      avatar: name,
      online: isOnline
    };

    testers.push(newTester);
    showToast(`Tester "${name}" added!`);
  } else {
    const existingTester = testers[index];
    existingTester.role = role;
    existingTester.gamemodes = checkedGms;
    existingTester.online = isOnline;
    showToast(`Tester "${name}" updated!`);
  }

  saveTesters();
  resetTesterForm();
  renderEditorTestersList();
}

function deleteTester(name) {
  testers = testers.filter(t => t.name !== name);
  saveTesters();
  renderEditorTestersList();
  showToast(`Tester "${name}" removed.`);
}

// Database Export/Import
function exportDatabase() {
  const exportData = {
    players: players,
    testers: testers
  };
  
  const jsonStr = JSON.stringify(exportData, null, 2);
  const dataStr = "data:application/json;charset=utf-8," + encodeURIComponent(jsonStr);
  const downloadAnchor = document.createElement("a");
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `mctiers_database.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
  showToast("✅ Exported mctiers_database.json - You can import this back anytime!");
}

async function saveDatabaseFile() {
  await saveDatabaseFileToDisk();
}

// Global variable to store pending import data
let pendingImportData = null;

function importDatabase(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (imported && typeof imported === 'object') {
        let dataToImport = null;

        if (Array.isArray(imported)) {
          // Old format: just an array of players
          dataToImport = { players: imported, testers: [] };
        } else if (imported.players && imported.testers) {
          // New format: object with players and testers
          dataToImport = imported;
        } else {
          alert("Invalid file format. Expected players and testers arrays.");
          event.target.value = "";
          return;
        }

        // Store the data and show confirmation modal
        pendingImportData = dataToImport;
        showImportConfirmation(dataToImport);
      }
    } catch (err) {
      alert("Error parsing JSON file: " + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = "";
}

function showImportConfirmation(data) {
  const modal = document.getElementById("import-confirm-modal");
  const preview = document.getElementById("import-preview");
  
  let previewHTML = `<strong>${data.players ? data.players.length : 0} Players:</strong><br>`;
  if (data.players && data.players.length > 0) {
    data.players.forEach(p => {
      previewHTML += `• ${p.username}<br>`;
    });
  } else {
    previewHTML += `(none)<br>`;
  }
  
  previewHTML += `<br><strong>${data.testers ? data.testers.length : 0} Testers:</strong><br>`;
  if (data.testers && data.testers.length > 0) {
    data.testers.forEach(t => {
      previewHTML += `• ${t.name} (${t.role})<br>`;
    });
  } else {
    previewHTML += `(none)<br>`;
  }
  
  preview.innerHTML = previewHTML;
  modal.classList.remove("hidden");
}

function confirmImport() {
  if (!pendingImportData) return;
  
  try {
    players = pendingImportData.players || [];
    testers = pendingImportData.testers || [];
    
    saveDatabase();
    saveTesters();
    
    renderEditorPlayersList();
    renderEditorTestersList();
    renderTierList();
    
    // Close modal
    document.getElementById("import-confirm-modal").classList.add("hidden");
    pendingImportData = null;
    
    showToast("✅ Database imported and saved successfully!");
  } catch (err) {
    alert("Error importing database: " + err.message);
    pendingImportData = null;
  }
}

function resetDatabase() {
  if (confirm("WARNING: This will delete all customized edits and restore the preloaded player list. Proceed?")) {
    localStorage.removeItem("jordan_mctiers_players");
    localStorage.removeItem("jordan_mctiers_testers");
    loadDatabase();
    renderEditorPlayersList();
    renderEditorTestersList();
    renderTierList();
    showToast("Database reset to factory default.");
  }
}

// --- UTILITY: TOAST NOTIFICATIONS ---
function showToast(message) {
  const toast = document.getElementById("toast");
  const toastMsg = document.getElementById("toast-message");
  
  toastMsg.textContent = message;
  toast.classList.remove("hidden");

  if (window.toastTimeout) {
    clearTimeout(window.toastTimeout);
  }

  window.toastTimeout = setTimeout(() => {
    toast.classList.add("hidden");
  }, 3000);
}

// --- EVENT LISTENERS ---
function setupEventListeners() {
  const mainSearch = document.getElementById("player-search");
  const clearBtn = document.getElementById("clear-search");

  mainSearch.addEventListener("input", (e) => {
    searchQuery = e.target.value;
    if (searchQuery) {
      clearBtn.classList.remove("hidden");
    } else {
      clearBtn.classList.add("hidden");
    }
    renderTierList();
  });

  clearBtn.addEventListener("click", () => {
    mainSearch.value = "";
    searchQuery = "";
    clearBtn.classList.add("hidden");
    renderTierList();
  });

  document.getElementById("player-modal-close").addEventListener("click", () => {
    document.getElementById("player-modal").classList.add("hidden");
  });
  
  document.getElementById("info-modal-close").addEventListener("click", () => {
    document.getElementById("info-modal").classList.add("hidden");
  });

  document.querySelectorAll(".modal-backdrop").forEach(backdrop => {
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) {
        backdrop.classList.add("hidden");
      }
    });
  });

  document.getElementById("btn-info").addEventListener("click", openInfoModal);
  
  const footerBtnInfo = document.getElementById("footer-btn-info");
  if (footerBtnInfo) {
    footerBtnInfo.addEventListener("click", (e) => {
      e.preventDefault();
      openInfoModal();
    });
  }

  // Info Modal Tab switching
  document.querySelectorAll(".info-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".info-tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".info-tab-content").forEach(content => content.classList.add("hidden"));
      
      btn.classList.add("active");
      const activeTabId = btn.dataset.tab;
      document.getElementById(activeTabId).classList.remove("hidden");
    });
  });

  // (Gamemode rules UI removed; no dropdown listener required)

  // Conditional bindings for Editor Panel elements (only loaded in admin.html)
  const btnEditorToggle = document.getElementById("btn-editor-toggle");
  if (btnEditorToggle) {
    btnEditorToggle.addEventListener("click", openEditorModal);
    
    // Editor Form binds
    document.getElementById("player-form").addEventListener("submit", savePlayer);
    document.getElementById("btn-cancel-edit").addEventListener("click", resetPlayerForm);
    document.getElementById("btn-export-db").addEventListener("click", saveDatabaseFile);
    document.getElementById("import-db-file").addEventListener("change", importDatabase);
    document.getElementById("btn-reset-db").addEventListener("click", resetDatabase);

    // Import Confirmation Modal
    document.getElementById("import-confirm-close").addEventListener("click", () => {
      document.getElementById("import-confirm-modal").classList.add("hidden");
      pendingImportData = null;
    });
    
    document.getElementById("import-confirm-cancel").addEventListener("click", () => {
      document.getElementById("import-confirm-modal").classList.add("hidden");
      pendingImportData = null;
    });
    
    document.getElementById("import-confirm-save").addEventListener("click", confirmImport);

    // Editor Sub-Tab switching
    const tabPlayers = document.getElementById("tab-edit-players");
    const tabTesters = document.getElementById("tab-edit-testers");
    const viewPlayers = document.getElementById("view-edit-players");
    const viewTesters = document.getElementById("view-edit-testers");

    tabPlayers.addEventListener("click", () => {
      tabPlayers.classList.add("active");
      tabTesters.classList.remove("active");
      viewPlayers.classList.remove("hidden");
      viewTesters.classList.add("hidden");
      resetPlayerForm();
    });

    tabTesters.addEventListener("click", () => {
      tabTesters.classList.add("active");
      tabPlayers.classList.remove("active");
      viewTesters.classList.remove("hidden");
      viewPlayers.classList.add("hidden");
      resetTesterForm();
      populateTesterGamemodeCheckboxes();
      renderEditorTestersList();
    });

    // Tester Form binds
    document.getElementById("tester-form").addEventListener("submit", saveTester);
    document.getElementById("btn-cancel-tester-edit").addEventListener("click", resetTesterForm);

    document.getElementById("editor-player-search").addEventListener("input", (e) => {
      editorSearchQuery = e.target.value;
      renderEditorPlayersList();
    });
    
    document.getElementById("editor-modal-close").addEventListener("click", () => {
      document.getElementById("editor-modal").classList.add("hidden");
    });

    const verifyAndCapitalizeUsername = async () => {
      const usernameInput = document.getElementById("form-username");
      const username = usernameInput.value.trim();
      if (!username) return;

      const helpText = document.querySelector(".form-help");
      helpText.innerHTML = `<span style="color: var(--text-muted); font-size: 0.72rem;">Verifying account name...</span>`;

      try {
        const res = await fetch(`https://playerdb.co/api/player/minecraft/${encodeURIComponent(username)}`);
        if (!res.ok) throw new Error("API response not OK");
        const data = await res.json();
        
        if (data.success && data.data && data.data.player) {
          const correctName = data.data.player.username;
          if (usernameInput.value !== correctName) {
            usernameInput.value = correctName;
            showToast(`NameMC name corrected to: ${correctName}`);
          }
          helpText.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px; color: var(--success-color); font-size: 0.72rem;">
              <img src="https://crafatar.com/renders/bust/${encodeURIComponent(correctName)}?size=24&default=MHF_Steve" style="border-radius:4px; width:16px; height:16px; image-rendering:pixelated;" alt="${correctName}" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/MHF_Steve?size=24'">
              <span>Verified Minecraft name: <strong>${correctName}</strong></span>
            </div>
          `;
        } else {
          helpText.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-top:8px; color: var(--text-muted); font-size: 0.72rem;">
              <span>No active Mojang account. Saving as-typed.</span>
            </div>
          `;
        }
      } catch (err) {
        console.error("Failed to verify username:", err);
        helpText.innerHTML = `
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px; color: var(--text-muted); font-size: 0.72rem;">
            <img src="https://crafatar.com/renders/bust/${encodeURIComponent(username)}?size=24&default=MHF_Steve" style="border-radius:4px; width:16px; height:16px; image-rendering:pixelated;" alt="${username}" onerror="this.onerror=null;this.src='https://crafatar.com/avatars/MHF_Steve?size=24'">
            <span>Skin loaded (Offline mode).</span>
          </div>
        `;
      }
    };

    document.getElementById("btn-fetch-uuid").addEventListener("click", verifyAndCapitalizeUsername);
    document.getElementById("form-username").addEventListener("blur", verifyAndCapitalizeUsername);
  }
}
