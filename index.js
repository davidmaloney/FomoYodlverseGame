```javascript
/**
* =========================================================
* 🌌 FOMO YODELVERSE — ULTIMATE HUB EDITION
* =========================================================
*
* INCLUDED:
* - Stable debug engine
* - Telegram topic/forum support
* - Private hub sessions
* - Session persistence
* - Session validation
* - Session cleanup
* - Session security
* - Deep-link gameplay
* - Full market system
* - Daily rewards
* - Admin commands
* - Boss raids
* - World chaos engine
* - Market shifts
* - Inventory system
* - Safe persistence
* - Cooldowns
* - Broadcast system
* - Write queue
* - State normalization
* - Unified entry gate
*
* =========================================================
*/

const fs = require("fs");
require("dotenv").config();
const crypto = require("crypto");
const { Telegraf, Markup } = require("telegraf");

/* =========================================================
BOT CORE
========================================================= */

if (!process.env.BOT_TOKEN) {
console.log("❌ Missing BOT_TOKEN");
process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("🌌 FOMO YODELVERSE ENGINE BOOTING...");
/* =========================================================
🚪 UNIFIED ENTRY GATE (ALL PATHS CONSOLIDATED)
========================================================= */

/**
 * Single source of truth for ALL entry paths.
 * No half-states — a user is either fully admitted or fully rejected.
 */
function resolveEntryIntent(ctx) {
  const text = ctx.message?.text || "";
  const payload = ctx.startPayload || "";
  const callbackData = ctx.callbackQuery?.data || "";

  // Command-based entry
  if (text === "/start") return "start";
  if (text === "/game") return "game";

  // Deep-link session entry
  if (typeof payload === "string" && payload.startsWith("session_")) return "session";

  // Hub deep link (from groups)
  if (typeof payload === "string" && payload === "hub") return "hub";

  // Start button from inline keyboard
  if (callbackData === "start_game") return "button";

  return null;
}

function isValidGameEntry(ctx) {
  return resolveEntryIntent(ctx) !== null;
}

function blockInvalidGameAccess(ctx) {
  if (!ctx.from) return true;

  if (!isValidGameEntry(ctx)) {
    if (ctx.chat?.type === "private") {
      reply(
        ctx,
        "🌌 Yodelverse is idle.\n\nUse /start or press START to enter."
      );
    }
    return true;
  }

  return false;
}

/**
 * Apply entry intent to user. Called exactly once during admission.
 * After this, _entryIntent is cleared and the user is fully inside the game.
 */
function applyEntryIntent(user, intent) {
  if (!user) return;
  user._entryIntent = intent;
}

function consumeEntryIntent(user) {
  if (!user || !user._entryIntent) return null;
  const intent = user._entryIntent;
  user._entryIntent = null;
  return intent;
}

/* =========================================================
CONFIG
========================================================= */

const CONFIG = {
SAVE_INTERVAL: 15000,
WRITE_QUEUE_INTERVAL: 5000,

COOLDOWN: 5000,

MAX_HP: 100,
MAX_ENERGY: 100,

START_CREDITS: 100,

DAILY_COOLDOWN: 86400000,

ADMIN_IDS:
  (process.env.ADMIN_IDS || "")
    .split(",")
    .filter(Boolean),

HUB_MODE: true,

SESSION_TTL:
  1000 * 60 * 60 * 24,

SESSION_SECRET:
  process.env.SESSION_SECRET ||
  "CHANGE_THIS_SECRET",

BOSS_MIN_HP: 1000,
BOSS_MAX_HP: 2500,

CHAOS_BOSS_TRIGGER: 15,
MAX_CHAOS: 100,

BROADCAST_LIMIT: 300,

ENERGY_COSTS: {
 event: 5,
 mine: 4,
 crime: 8,
 war: 10,
 boss: 6
},

// BALANCE PATCH: Slightly widened reward ranges for viability diversity
BALANCE: {
  MINE_BASE_MIN: 12,
  MINE_BASE_MAX: 38,
  MINE_XP: 8,
  CRIME_SUCCESS_MIN: 35,
  CRIME_SUCCESS_MAX: 95,
  CRIME_FAIL_LOSS_MIN: 15,
  CRIME_FAIL_LOSS_MAX: 45,
  WAR_REWARD_MIN: 18,
  WAR_REWARD_MAX: 52,
  BOSS_DMG_MIN: 20,
  BOSS_DMG_MAX: 55,
  BOSS_XP: 12,
  DAILY_CREDITS: 100,
  DAILY_XP: 30,
  EVENT_BASE_RISK_MOD: 0.008
},

};

/* =========================================================
STORAGE
========================================================= */

const DB_FILE = "./data.json";
const WORLD_FILE = "./world.json";
const SESSION_FILE = "./sessions.json";

/* =========================================================
WRITE QUEUE (SERIALIZED SAFE PERSISTENCE)
========================================================= */

let writeQueue = [];
let writeTimer = null;

function enqueueWrite(file, data) {
  // Replace any pending write for the same file
  writeQueue = writeQueue.filter(w => w.file !== file);
  writeQueue.push({ file, data });
  
  if (!writeTimer) {
    writeTimer = setTimeout(flushWriteQueue, CONFIG.WRITE_QUEUE_INTERVAL);
  }
}

function flushWriteQueue() {
  clearTimeout(writeTimer);
  writeTimer = null;

  const writes = writeQueue.splice(0);
  
  for (const { file, data } of writes) {
    try {
      atomicWrite(file, data);
    } catch (err) {
      console.log("❌ QUEUED WRITE FAILED:", file, err.message);
    }
  }
}

function queueSaveAll() {
  enqueueWrite(DB_FILE, DB);
  enqueueWrite(WORLD_FILE, WORLD);
  enqueueWrite(SESSION_FILE, SESSIONS);
}

// Flush on exit
function emergencyFlush() {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
  }
  flushWriteQueue();
  forceSave();
}

/* =========================================================
LOAD (SAFE)
========================================================= */

function load(path, fallback) {
  try {
    if (!fs.existsSync(path)) return fallback;

    const raw = fs.readFileSync(path, "utf8");

    if (!raw || !raw.trim()) return fallback;

    const parsed = JSON.parse(raw);

    if (typeof parsed !== "object" || parsed === null) {
      return fallback;
    }

    return parsed;

  } catch (err) {
    console.log("❌ LOAD ERROR:", path, err.message);
    return fallback;
  }
}

/* =========================================================
IN-MEMORY STATE
========================================================= */

let DB = load(DB_FILE, {});
let WORLD = load(WORLD_FILE, {
  season: 1,
  chaos: 1,
  marketState: "stable",
  boss: null,
  factions: {
    HODL: 0,
    FOMO: 0,
    SCAM: 0,
    WHALE: 0
  }
});

let SESSIONS = load(SESSION_FILE, {});

/* =========================================================
STATE NORMALIZATION (CONSISTENCY REPAIR PASS)
========================================================= */

function normalizeWorld() {
  if (typeof WORLD.chaos !== "number" || WORLD.chaos < 1) WORLD.chaos = 1;
  WORLD.chaos = clamp(WORLD.chaos, 1, CONFIG.MAX_CHAOS);

  if (!WORLD.factions || typeof WORLD.factions !== "object") {
    WORLD.factions = { HODL: 0, FOMO: 0, SCAM: 0, WHALE: 0 };
  }

  for (const f of FACTIONS) {
    if (typeof WORLD.factions[f] !== "number") WORLD.factions[f] = 0;
  }

  if (!WORLD.marketState || !["stable", "bullish", "volatile", "crashing"].includes(WORLD.marketState)) {
    WORLD.marketState = "stable";
  }

  // Boss recovery: ensure no stuck active boss with 0 HP
  if (WORLD.boss) {
    if (WORLD.boss.active && WORLD.boss.hp <= 0) {
      WORLD.boss.active = false;
      WORLD.boss = null;
    }
    if (!WORLD.boss.active) {
      WORLD.boss = null;
    }
  }

  if (!WORLD.season) WORLD.season = 1;
}

function normalizeUser(u) {
  if (!u) return;

  if (!u.cooldowns || typeof u.cooldowns !== "object") u.cooldowns = {};
  if (!Array.isArray(u.inventory)) u.inventory = [];

  u.xp = safeNumber(u.xp);
  u.credits = safeNumber(u.credits, CONFIG.START_CREDITS);
  u.hp = safeNumber(u.hp, CONFIG.MAX_HP);
  u.energy = safeNumber(u.energy, CONFIG.MAX_ENERGY);
  u.wins = safeNumber(u.wins);
  u.losses = safeNumber(u.losses);
  u.reputation = safeNumber(u.reputation);
  u.prestige = safeNumber(u.prestige);
  u.miningLevel = safeNumber(u.miningLevel, 1);
  u.hackingLevel = safeNumber(u.hackingLevel, 1);

  if (typeof u.dead !== "boolean") u.dead = false;
  if (u.hp <= 0 && !u.dead) u.dead = true;
  if (u.dead && u.hp > 0) u.hp = 0;
  if (u.dead && !u.deathTime) u.deathTime = now();

  u.energy = clamp(u.energy, 0, CONFIG.MAX_ENERGY);
  u.hp = clamp(u.hp, 0, CONFIG.MAX_HP);
}

function normalizeAllState() {
  normalizeWorld();
  for (const id in DB) {
    normalizeUser(DB[id]);
  }
}

// Run normalization on startup
normalizeAllState();

/* =========================================================
SAVE FLAG + QUEUED SAVE
========================================================= */

let dirty = false;

function save() {
  dirty = true;
}

function markDirty() {
  dirty = true;
}

/* =========================================================
ATOMIC WRITE (HARDENED)
========================================================= */

function atomicWrite(file, data) {
  const temp = `${file}.tmp`;
  const backup = `${file}.bak`;

  try {
    if (fs.existsSync(file)) {
      fs.copyFileSync(file, backup);
    }

    fs.writeFileSync(temp, JSON.stringify(data, null, 2));

    const check = JSON.parse(fs.readFileSync(temp, "utf8"));

    if (!check || typeof check !== "object") {
      throw new Error("Validation failed");
    }

    fs.renameSync(temp, file);

  } catch (err) {
    console.log("❌ ATOMIC WRITE FAILED:", file, err.message);

    try {
      if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, file);
        console.log("♻️ Restored backup:", file);
      }
    } catch (restoreErr) {
      console.log("❌ BACKUP RESTORE FAILED:", restoreErr.message);
    }
  }
}

/* =========================================================
FORCE SAVE (COMBINED: QUEUE FLUSH + DIRECT WRITE)
========================================================= */

function forceSave() {
  if (!dirty && writeQueue.length === 0) return;
  
  try {
    emergencyFlush();
    dirty = false;
    console.log("💾 Saved safely");
  } catch (err) {
    console.log("❌ SAVE ERROR:", err.message);
  }
}

/* =========================================================
AUTO SAVE LOOP
========================================================= */

setInterval(() => {
  if (!dirty && writeQueue.length === 0) return;
  forceSave();
}, CONFIG.SAVE_INTERVAL);

/* =========================================================
SAFETY
========================================================= */

process.on("uncaughtException", (err) => {
  console.log("❌ UNCAUGHT ERROR");
  console.log(err);
  emergencyFlush();
});

process.on("unhandledRejection", (err) => {
  console.log("❌ REJECTION");
  console.log(err);
});

process.on("SIGINT", () => {
  forceSave();
  process.exit(0);
});

process.on("SIGTERM", () => {
  forceSave();
  process.exit(0);
});

/* =========================================================
UTILITIES
========================================================= */

const rand = (arr) =>
arr[Math.floor(Math.random() * arr.length)];

const now = () => Date.now();

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function level(xp) {
  return Math.floor(xp / 100) + 1;
}

function isAdmin(id) {
  return CONFIG.ADMIN_IDS.includes(String(id));
}

function safeNumber(n, fallback = 0) {
  return typeof n === "number" && !isNaN(n) ? n : fallback;
}

/* =========================================================
DEATH HELPERS
========================================================= */

function isDead(user) {
  return !!user?.dead;
}

function checkDeath(ctx, user) {
  if (!user) return false;
  if (!user.dead) return false;

  if (user.hp > 0) {
    user.hp = 0;
  }

  return true;
}

/* =========================================================
ANTISPAM + ATOMIC SAFETY
========================================================= */

const ACTION_SPAM = {};
const CALLBACK_SPAM = {};

function antiSpam(userId, ms = 1200) {
 const last = ACTION_SPAM[userId] || 0;

 if (now() - last < ms) {
   return false;
 }

 ACTION_SPAM[userId] = now();
 return true;
}

function antiSpamCallback(userId, ms = 800) {
 const last = CALLBACK_SPAM[userId] || 0;

 if (now() - last < ms) {
   return false;
 }

 CALLBACK_SPAM[userId] = now();
 return true;
}

/* =========================================================
SECURITY + ROUTING HELPERS
========================================================= */

function isPrivateChat(ctx) {
 return ctx.chat && ctx.chat.type === "private";
}

function requirePrivate(ctx) {
 if (!isPrivateChat(ctx)) {
   reply(
     ctx,
`🚫 Gameplay is only available in private chat.

Use the private game button to continue.`
   );
   return false;
 }
 return true;
}

function requireRegistered(user, ctx) {
  if (!user) {
    reply(ctx, "❌ User data not found. Please restart with /start.");
    return false;
  }

  if (user.registered) {
    return true;
  }

  reply(ctx, "❌ You must complete registration first.");
  return false;
}

function spendEnergy(user, amount) {
 if (!user || user.energy < amount) {
   return false;
 }
 user.energy -= amount;
 return true;
}

function restoreEnergy(user) {
 if (!user) return;
 user.energy = clamp(user.energy + 1, 0, CONFIG.MAX_ENERGY);
}

function transaction(callback) {
 try {
   callback();
   save();
   return true;
 } catch (err) {
   console.log("❌ TRANSACTION ERROR:", err.message);
   return false;
 }
}

/* =========================================================
DEATH SYSTEM (AUTHORITATIVE)
========================================================= */

function killPlayer(ctx, user) {
  if (!user) return;
  if (user.dead === true) return;

  user.hp = 0;
  user.dead = true;
  user.deathTime = now();

  user.xp = Math.max(0, Math.floor(user.xp * 0.5));

  if (Array.isArray(user.inventory) && user.inventory.length > 0) {
    const lossCount = Math.floor(user.inventory.length * 0.5);

    for (let i = 0; i < lossCount; i++) {
      const idx = Math.floor(Math.random() * user.inventory.length);
      user.inventory.splice(idx, 1);
    }
  }

  save();

  reply(
    ctx,
`💀 YOU HAVE BEEN ELIMINATED

☠ XP reduced by 50%
🎒 50% of your inventory was lost

Use /respawn to return to the Yodelverse.`
  );
}

/* =========================================================
REBIRTH SYSTEM
========================================================= */

const REBIRTH_CONFIG = {
  xpKeepRatio: 0.25,
  creditBonus: 100,
  energyRestore: true,
  hpReset: true,
  rebirthCooldown: 1000 * 60 * 10
};

function canRebirth(user) {
  if (!user || !user.dead) return false;
  if (!user.deathTime) return true;

  const elapsed = now() - user.deathTime;
  return elapsed > REBIRTH_CONFIG.rebirthCooldown;
}

function rebirthPlayer(user) {
  if (!user || !user.dead) return user;
  if (!canRebirth(user)) return null;

  user.dead = false;

  if (REBIRTH_CONFIG.hpReset) {
    user.hp = CONFIG.MAX_HP;
  }

  user.xp = Math.floor(user.xp * REBIRTH_CONFIG.xpKeepRatio);
  user.credits += REBIRTH_CONFIG.creditBonus;

  if (REBIRTH_CONFIG.energyRestore) {
    user.energy = CONFIG.MAX_ENERGY;
  }

  user.prestige = (user.prestige || 0) + 1;
  user.deathTime = null;

  return user;
}

/* =========================================================
SESSION SYSTEM
========================================================= */

function signSession(id) {
  return crypto
    .createHmac("sha256", CONFIG.SESSION_SECRET)
    .update(id)
    .digest("hex");
}

function createSession(userId, topicId) {
  const id = crypto.randomBytes(16).toString("hex");
  const sig = signSession(id);

  SESSIONS[id] = {
    userId,
    topicId: topicId ?? null,
    created: now(),
    sig
  };

  save();

  return `${id}.${sig}`;
}

function validateSession(token) {
  try {
    if (!token) return null;

    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [id, sig] = parts;

    if (signSession(id) !== sig) return null;

    const session = SESSIONS[id];
    if (!session) return null;

    if (session.sig !== sig) return null;

    if (now() - session.created > CONFIG.SESSION_TTL) {
      delete SESSIONS[id];
      save();
      return null;
    }

    return session;
  } catch {
    return null;
  }
}

function validateSessionForUser(token, userId) {
  if (!token || !userId) return null;
  
  const session = validateSession(token);
  if (!session) return null;
  
  if (String(session.userId) !== String(userId)) return null;
  
  return session;
}

function cleanupSessions() {
  let changed = false;

  for (const id in SESSIONS) {
    const s = SESSIONS[id];

    if (now() - s.created > CONFIG.SESSION_TTL) {
      delete SESSIONS[id];
      changed = true;
    }
  }

  if (changed) save();
}

setInterval(cleanupSessions, 3600000);

function resolveSessionFromCtx(ctx) {
  const payload = ctx.startPayload;

  if (typeof payload === "string" && payload.startsWith("session_")) {
    const token = payload.slice("session_".length);
    return validateSessionForUser(token, ctx.from?.id);
  }

  return null;
}

function hubPrivateLink(userId, ctx) {
  const topicId =
    ctx.message?.message_thread_id ||
    ctx.callbackQuery?.message?.message_thread_id ||
    null;

  const token = createSession(userId, topicId);

  const botUsername =
    process.env.BOT_USERNAME ||
    "FOMOYODELverseBot";

  return `https://t.me/${botUsername}?start=session_${token}`;
}

/* =========================================================
GAME DATA
========================================================= */

const CHARACTERS = [
  "R2D5",
  "Darth Fader",
  "Fan Solo",
  "Princess Liquidia",
  "Jabba the Whale"
];

const FACTIONS = [
  "HODL",
  "FOMO",
  "SCAM",
  "WHALE"
];

const EVENTS = [
  {
    title: "Whale Manipulation",
    text: "Massive liquidity distortion detected.",
    xp: 20,
    credits: 15,
    chaos: 2,
    risk: 0.25
  },
  {
    title: "Meme Coin Frenzy",
    text: "Speculators flood the markets.",
    xp: 15,
    credits: 20,
    chaos: 1,
    risk: 0.15
  },
  {
    title: "Shadow Rugpull",
    text: "Entire sectors collapse instantly.",
    xp: 35,
    credits: 30,
    chaos: 3,
    risk: 0.40
  },
  {
    title: "Quantum Pump",
    text: "Unknown forces trigger hypergrowth.",
    xp: 50,
    credits: 40,
    chaos: 4,
    risk: 0.50
  }
];

/* =========================================================
ITEM SYSTEM
========================================================= */

const ITEMS = [
  {
    id: "scrap_token",
    name: "Scrap Token",
    rarity: "common",
    power: 1,
    type: "resource"
  },
  {
    id: "glitch_shard",
    name: "Glitch Shard",
    rarity: "common",
    power: 2,
    type: "resource"
  },
  {
    id: "dark_token",
    name: "Dark Token",
    rarity: "rare",
    power: 4,
    type: "resource"
  },
  {
    id: "quantum_ore",
    name: "Quantum Ore",
    rarity: "rare",
    power: 6,
    type: "resource"
  },
  {
    id: "meme_crystal",
    name: "Meme Crystal",
    rarity: "epic",
    power: 10,
    type: "boost"
  },
  {
    id: "whale_fragment",
    name: "Whale Fragment",
    rarity: "epic",
    power: 12,
    type: "boost"
  },
  {
    id: "forbidden_ledger",
    name: "Forbidden Ledger",
    rarity: "legendary",
    power: 25,
    type: "relic"
  },
  {
    id: "void_core",
    name: "Void Core",
    rarity: "legendary",
    power: 30,
    type: "relic"
  }
];

/* =========================================================
REPLY SYSTEM
========================================================= */

async function reply(ctx, text, extra = {}) {
  try {
    const threadId =
      ctx.message?.message_thread_id ||
      ctx.callbackQuery?.message?.message_thread_id;

    const options = { ...extra };

    if (threadId !== undefined && threadId !== null) {
      options.message_thread_id = threadId;
    }

    return await ctx.reply(text, options);

  } catch (err) {
    console.log("❌ REPLY ERROR:", err.message);
  }
}

async function ack(ctx) {
  try {
    await ctx.answerCbQuery();
  } catch {}
}

/* =========================================================
USER SYSTEM
========================================================= */

function createUser(id, ctx = null) {
  return {
    id,
    name: ctx?.from?.first_name || "Player",
    username: ctx?.from?.username || "",
    registered: false,
    character: null,
    faction: null,
    xp: 0,
    credits: CONFIG.START_CREDITS,
    hp: CONFIG.MAX_HP,
    energy: CONFIG.MAX_ENERGY,
    wins: 0,
    losses: 0,
    reputation: 0,
    prestige: 0,
    inventory: [],
    apartment: "Container Unit",
    ship: "Rust Bucket",
    miningLevel: 1,
    hackingLevel: 1,
    cooldowns: {},
    lastDaily: 0,
    wanted: false,
    dead: false
  };
}

function getUser(id, ctx = null) {
  if (!DB[id]) {
    DB[id] = createUser(id, ctx);
    save();
  }

  normalizeUser(DB[id]);
  return DB[id];
}

/* =========================================================
COOLDOWNS
========================================================= */

function cooldownOk(user, key, ms = CONFIG.COOLDOWN) {
  if (!user) return false;

  if (!user.cooldowns || typeof user.cooldowns !== "object") {
    user.cooldowns = {};
  }

  const nowTime = now();
  const last = user.cooldowns[key] || 0;

  if (nowTime - last < ms) {
    return false;
  }

  user.cooldowns[key] = nowTime;
  return true;
}

/* =========================================================
WORLD ENGINE (WITH STUCK-STATE RECOVERY)
========================================================= */

function addChaos(amount) {
  WORLD.chaos = clamp(WORLD.chaos + amount, 1, CONFIG.MAX_CHAOS);

  if (
    WORLD.chaos >= CONFIG.CHAOS_BOSS_TRIGGER &&
    (!WORLD.boss || !WORLD.boss.active)
  ) {
    spawnBoss();
  }

  save();
}

function addFactionPower(faction, amount) {
  if (!faction) return;

  if (WORLD.factions[faction] === undefined) {
    WORLD.factions[faction] = 0;
  }

  WORLD.factions[faction] += amount;
  save();
}

/* =========================================================
BROADCAST
========================================================= */

async function broadcast(message) {
  const ids = Object.keys(DB).slice(0, CONFIG.BROADCAST_LIMIT);

  for (const id of ids) {
    try {
      await bot.telegram.sendMessage(id, message);
      await new Promise(resolve => setTimeout(resolve, 40));
    } catch (err) {
      console.log(`❌ BROADCAST FAILED ${id}:`, err.message);
    }
  }
}

/* =========================================================
BOSS SYSTEM (GUARANTEED RECOVERY)
========================================================= */

let bossLock = false;
let bossLockTime = 0;
const BOSS_LOCK_TIMEOUT = 30000; // Auto-unlock after 30s

function spawnBoss() {
 // Recovery: force unlock if stuck
 if (bossLock && (now() - bossLockTime) > BOSS_LOCK_TIMEOUT) {
   bossLock = false;
 }

 if (bossLock) return;
 if (WORLD.boss && WORLD.boss.active) return;

 bossLock = true;
 bossLockTime = now();

 WORLD.boss = {
   active: true,
   id: crypto.randomBytes(8).toString("hex"),
   name: rand([
     "VOID LEVIATHAN",
     "MEGA WHALE",
     "THE RUG EMPEROR",
     "CHAIN DEVOURER"
   ]),
   hp: CONFIG.BOSS_MIN_HP +
     Math.floor(Math.random() * (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP))
 };

 broadcast(
`🐋 WORLD BOSS SPAWNED

${WORLD.boss.name}

HP: ${WORLD.boss.hp}`
 );

 bossLock = false;
 save();
}

function damageBoss(dmg) {
  if (!WORLD.boss || !WORLD.boss.active) return 0;

  WORLD.boss.hp = Math.max(0, WORLD.boss.hp - dmg);

  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;
    const bossName = WORLD.boss.name;
    broadcast(`🎉 WORLD BOSS DEFEATED! The ${bossName} has fallen.`);
    WORLD.boss = null;
  }
  save();
  return WORLD.boss?.hp || 0;
}

/* =========================================================
MENU
========================================================= */

function homeMenu(userId, ctx) {
  const rows = [
    [
      Markup.button.callback("⚡ EVENT", "event"),
      Markup.button.callback("⛏ MINE", "mine")
    ],
    [
      Markup.button.callback("🕶 CRIME", "crime"),
      Markup.button.callback("⚔ WAR", "war")
    ],
    [
      Markup.button.callback("🐋 BOSS", "boss"),
      Markup.button.callback("📊 PROFILE", "profile")
    ],
    [
      Markup.button.callback("🎒 INVENTORY", "inventory"),
      Markup.button.callback("🏪 MARKET", "market")
    ],
    [
      Markup.button.callback("🏆 LEADERBOARD", "leaderboard"),
      Markup.button.callback("🎁 DAILY", "daily")
    ]
  ];

  if (CONFIG.HUB_MODE) {
    rows.push([
      Markup.button.url(
        "🚀 OPEN PRIVATE GAME",
        hubPrivateLink(userId, ctx)
      )
    ]);
  }

  return Markup.inlineKeyboard(rows);
}

function homeText(u) {
  return `🌌 FOMO YODELVERSE

👤 ${u.name}

🧬 ${u.character || "UNSET"}

⚔ ${u.faction || "UNSET"}

⭐ Level: ${level(u.xp)}

💰 Credits: ${u.credits}

❤️ HP: ${u.hp}

⚡ Energy: ${u.energy}

🔥 Chaos Level: ${WORLD.chaos}

🌍 Market: ${WORLD.marketState}`;
}

async function home(ctx, u) {
  const session = resolveSessionFromCtx(ctx);
  const hasValidSession = !!session;
  const hasStartedGame = u.registered === true;

  if (!hasValidSession && !hasStartedGame) {
    return reply(
      ctx,
      "🚫 You are not in an active game session.\n\nPlease press START to begin the game."
    );
  }

  if (checkDeath(ctx, u)) {
    return reply(ctx, "💀 You are dead. Use /respawn to continue.");
  }

  return reply(ctx, homeText(u), homeMenu(u.id, ctx));
}

/* =========================================================
DEATH COMMANDS
========================================================= */

bot.command("respawn", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!isDead(u)) {
    return reply(ctx, "✅ You are not dead.");
  }

  const revived = rebirthPlayer(u);

  if (!revived) {
    const deathTime = u.deathTime || now();
    const waitTime = REBIRTH_CONFIG.rebirthCooldown - (now() - deathTime);
    const seconds = Math.max(0, Math.ceil(waitTime / 1000));

    return reply(
      ctx,
      `⏳ Rebirth not ready yet.\n\nTry again in ${seconds}s`
    );
  }

  save();
  return home(ctx, u);
});

bot.command("status", (ctx) => {
 const users = Object.keys(DB).length;

 return reply(
   ctx,
`🌌 SERVER STATUS

👥 Players: ${users}

🔥 Chaos: ${WORLD.chaos}

🌍 Market: ${WORLD.marketState}

🐋 Boss: ${WORLD.boss?.active ? "ACTIVE" : "NONE"}

💾 Save State: ${dirty ? "PENDING" : "SYNCED"}`
 );
});

/* =========================================================
CHARACTER FLOW
========================================================= */

bot.action(/char_(.+)/, async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  u.character = ctx.match[1];
  save();

  return reply(
    ctx,
`⚔ Choose Your Faction

HODL → Stability
FOMO → Aggression
SCAM → Manipulation
WHALE → Wealth`,
    Markup.inlineKeyboard(
      FACTIONS.map((f) => [
        Markup.button.callback(f, "faction_" + f)
      ])
    )
  );
});

bot.action(/faction_(.+)/, async (ctx) => {
  await ack(ctx);

  const faction = ctx.match[1];

  if (!FACTIONS.includes(faction)) {
    return;
  }

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  u.faction = faction;
  u.registered = true;

  save();

  broadcast(`🌌 ${u.name} joined ${u.faction}`);

  return home(ctx, u);
});

/* =========================================================
PROFILE
========================================================= */

function profileText(u) {
  return `📊 PROFILE

👤 ${u.name}

🧬 ${u.character}

⚔ ${u.faction}

⭐ Level: ${level(u.xp)}

XP: ${u.xp}

💰 Credits: ${u.credits}

❤️ HP: ${u.hp} ${u.dead ? "(DEAD)" : ""}

🏆 Wins: ${u.wins}

💀 Losses: ${u.losses}

🌟 Reputation: ${u.reputation}

👑 Prestige: ${u.prestige}

⛏ Mining: ${u.miningLevel}

🕶 Hacking: ${u.hackingLevel}

🏠 ${u.apartment}

🚀 ${u.ship}

🚨 Wanted: ${u.wanted ? "YES" : "NO"}`;
}

bot.command("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  return reply(ctx, profileText(u));
});

bot.action("profile", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  return reply(ctx, profileText(u));
});

/* =========================================================
EVENTS
========================================================= */

bot.action("event", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!cooldownOk(u, "event")) {
    return reply(ctx, "⏳ Event cooldown active");
  }

  const e = rand(EVENTS);
  const risk = e.risk + (WORLD.chaos * CONFIG.BALANCE.EVENT_BASE_RISK_MOD);

  if (Math.random() < risk) {
    const loss = 15 + Math.floor(Math.random() * 25);
    u.credits = clamp(u.credits - loss, 0, 999999);
    u.hp = Math.max(0, u.hp - 10);
    addChaos(1);
    save();

    if (checkDeath(ctx, u)) return;

    return reply(
      ctx,
`💥 EVENT FAILED

${e.title}

-${loss} Credits

🔥 Chaos Increased`
    );
  }

  u.xp += e.xp;
  u.credits += e.credits;

  addFactionPower(u.faction, e.xp);
  addChaos(e.chaos);

  save();

  return reply(
    ctx,
`⚡ ${e.title}

${e.text}

+${e.xp} XP

+${e.credits} Credits

🔥 Chaos: ${WORLD.chaos}`
  );
});

/* =========================================================
MINE
========================================================= */

bot.action("mine", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (!cooldownOk(u, "mine")) {
    return reply(ctx, "⏳ Mining cooldown active");
  }

  const gain =
    CONFIG.BALANCE.MINE_BASE_MIN +
    Math.floor(Math.random() * (CONFIG.BALANCE.MINE_BASE_MAX - CONFIG.BALANCE.MINE_BASE_MIN)) +
    (u.miningLevel * 5);

  u.credits += gain;
  u.xp += CONFIG.BALANCE.MINE_XP;

  let msg = `⛏ Mining Operation Successful\n\n+${gain} Credits`;

  if (Math.random() > 0.82) {
    const item = rand(ITEMS);

    const loot = typeof item === "string"
      ? {
          id: item.toLowerCase().replace(/\s+/g, "_"),
          name: item,
          rarity: "common",
          power: 1,
          type: "legacy"
        }
      : item;

    u.inventory.push(loot);

    msg += `\n\n🎁 Rare Item Found:\n${loot.name} (${loot.rarity})`;
  }

  save();

  return reply(ctx, msg);
});

/* =========================================================
CRIME
========================================================= */

bot.action("crime", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!cooldownOk(u, "crime")) {
    return reply(ctx, "⏳ Crime cooldown active");
  }

  if (Math.random() < 0.45) {
    const loss =
      CONFIG.BALANCE.CRIME_FAIL_LOSS_MIN +
      Math.floor(
        Math.random() * (CONFIG.BALANCE.CRIME_FAIL_LOSS_MAX - CONFIG.BALANCE.CRIME_FAIL_LOSS_MIN)
      );

    u.credits = clamp(u.credits - loss, 0, 999999);
    u.hp = Math.max(0, u.hp - 15);
    u.wanted = true;

    save();

    if (checkDeath(ctx, u)) return;

    return reply(
      ctx,
`🚔 CRIME FAILED

-${loss} Credits

🚨 You are now WANTED`
    );
  }

  const gain =
    CONFIG.BALANCE.CRIME_SUCCESS_MIN +
    Math.floor(
      Math.random() * (CONFIG.BALANCE.CRIME_SUCCESS_MAX - CONFIG.BALANCE.CRIME_SUCCESS_MIN)
    );

  u.credits += gain;
  u.reputation += 1;

  addChaos(1);

  save();

  return reply(
    ctx,
`🕶 BLACK MARKET SUCCESS

+${gain} Credits

+1 Reputation`
  );
});

/* =========================================================
WAR
========================================================= */

bot.action("war", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!cooldownOk(u, "war", 8000)) {
    return reply(ctx, "⏳ War cooldown active");
  }

  const reward =
    CONFIG.BALANCE.WAR_REWARD_MIN +
    Math.floor(
      Math.random() * (CONFIG.BALANCE.WAR_REWARD_MAX - CONFIG.BALANCE.WAR_REWARD_MIN)
    );

  u.xp += reward;
  u.hp = Math.max(0, u.hp - 8);

  addFactionPower(u.faction, reward);
  addChaos(2);

  save();

  if (checkDeath(ctx, u)) return;

  return reply(
    ctx,
`⚔ FACTION CONFLICT

${u.name} fought for ${u.faction}

+${reward} XP

🔥 Chaos Increased`
  );
});

/* =========================================================
BOSS
========================================================= */

bot.action("boss", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (!WORLD.boss || !WORLD.boss.active) {
    spawnBoss();
  }

  const dmg =
    CONFIG.BALANCE.BOSS_DMG_MIN +
    Math.floor(
      Math.random() * (CONFIG.BALANCE.BOSS_DMG_MAX - CONFIG.BALANCE.BOSS_DMG_MIN)
    );

  damageBoss(dmg);

  u.xp += CONFIG.BALANCE.BOSS_XP;
  u.hp = Math.max(0, u.hp - 12);

  save();

  if (checkDeath(ctx, u)) return;

  const hp = WORLD.boss?.hp || 0;

  return reply(
    ctx,
`🐋 RAID ATTACK

💥 Damage: ${dmg}

❤️ Remaining HP: ${hp}`
  );
});

/* =========================================================
INVENTORY
========================================================= */

bot.action("inventory", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (!u.inventory.length) {
    return reply(ctx, "🎒 Inventory Empty");
  }

  let msg = "🎒 INVENTORY\n\n";

  u.inventory.forEach((item, i) => {
    if (typeof item === "string") {
      msg += `${i + 1}. ${item}\n`;
      return;
    }

    const name = item?.name || "Unknown Item";
    const rarity = item?.rarity ? ` (${item.rarity})` : "";
    const power = item?.power ? ` [PWR ${item.power}]` : "";

    msg += `${i + 1}. ${name}${rarity}${power}\n`;
  });

  return reply(ctx, msg);
});

/* =========================================================
MARKET
========================================================= */

bot.action("market", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  return reply(
    ctx,
`🏪 BLACK MARKET

⚡ Energy Cell — 50
🛡 Nano Armor — 100
⛏ Quantum Drill — 250
🏠 Luxury Apartment — 500`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Buy Energy", "buy_energy")],
      [Markup.button.callback("🛡 Buy Armor", "buy_armor")],
      [Markup.button.callback("⛏ Buy Drill", "buy_drill")],
      [Markup.button.callback("🏠 Buy Apartment", "buy_home")]
    ])
  );
});

bot.action("buy_energy", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (u.credits < 50) {
    return reply(ctx, "❌ Not enough credits");
  }

  u.credits -= 50;
  u.energy = clamp(u.energy + 25, 0, CONFIG.MAX_ENERGY);

  save();

  return reply(ctx, "⚡ Energy restored");
});

bot.action("buy_armor", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (u.credits < 100) {
    return reply(ctx, "❌ Not enough credits");
  }

  u.credits -= 100;
  u.hp = clamp(u.hp + 25, 0, CONFIG.MAX_HP);

  save();

  return reply(ctx, "🛡 Armor equipped");
});

bot.action("buy_drill", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (u.credits < 250) {
    return reply(ctx, "❌ Not enough credits");
  }

  u.credits -= 250;
  u.miningLevel += 1;

  save();

  return reply(ctx, `⛏ Mining upgraded\n\nLevel ${u.miningLevel}`);
});

bot.action("buy_home", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (u.credits < 500) {
    return reply(ctx, "❌ Not enough credits");
  }

  u.credits -= 500;
  u.apartment = "Luxury Sky Apartment";

  save();

  return reply(ctx, "🏠 Apartment upgraded");
});

/* =========================================================
DAILY
========================================================= */

bot.action("daily", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;

  if (now() - u.lastDaily < CONFIG.DAILY_COOLDOWN) {
    return reply(ctx, "⏳ Daily already claimed");
  }

  u.lastDaily = now();
  u.credits += CONFIG.BALANCE.DAILY_CREDITS;
  u.xp += CONFIG.BALANCE.DAILY_XP;

  save();

  return reply(
    ctx,
`🎁 DAILY REWARD

+${CONFIG.BALANCE.DAILY_CREDITS} Credits

+${CONFIG.BALANCE.DAILY_XP} XP`
  );
});

/* =========================================================
LEADERBOARD
========================================================= */

function leaderboardText() {
  const top = Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  let msg = "🏆 LEADERBOARD\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name}\n${u.xp} XP\n\n`;
  });

  msg += "⚔ FACTION POWER\n\n";

  for (const f in WORLD.factions) {
    msg += `${f}: ${WORLD.factions[f]}\n`;
  }

  msg += `\n🔥 Chaos: ${WORLD.chaos}`;

  return msg;
}

bot.action("leaderboard", async (ctx) => {
  await ack(ctx);
  return reply(ctx, leaderboardText());
});

bot.command("leaderboard", (ctx) => {
  return reply(ctx, leaderboardText());
});

/* =========================================================
MENU
========================================================= */

bot.command("menu", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;
  return home(ctx, u);
});

/* =========================================================
ADMIN
========================================================= */

bot.command("broadcast", (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  const msg = ctx.message.text.replace("/broadcast", "").trim();

  if (!msg) {
    return reply(ctx, "Usage: /broadcast message");
  }

  broadcast(`📢 ADMIN ALERT\n\n${msg}`);

  return reply(ctx, "✅ Broadcast sent");
});

bot.command("spawnboss", (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  spawnBoss();

  return reply(ctx, "🐋 Boss spawned");
});

bot.command("chaos", (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  const amount = parseInt(ctx.message.text.split(" ")[1]);

  if (isNaN(amount)) {
    return reply(ctx, "Usage: /chaos number");
  }

  WORLD.chaos = clamp(amount, 1, CONFIG.MAX_CHAOS);
  save();

  return reply(ctx, `🔥 Chaos set to ${amount}`);
});

bot.command("normalize", (ctx) => {
  if (!isAdmin(ctx.from.id)) {
    return;
  }

  normalizeAllState();
  save();

  return reply(ctx, "✅ State normalized");
});

/* =========================================================
RANDOM EVENTS
========================================================= */

setInterval(() => {
  if (Math.random() > 0.90) {
    addChaos(1);

    const msg = rand([
      "🌌 Market instability detected.",
      "📉 A major token collapsed.",
      "🐋 Whale fleets moving through sectors.",
      "⚠ Illegal mining activity rising.",
      "💀 Shadow hackers breached the chain."
    ]);

    broadcast(msg);
  }
}, 120000);

/* =========================================================
MARKET SHIFTS
========================================================= */

setInterval(() => {
  WORLD.marketState = rand(["stable", "bullish", "volatile", "crashing"]);
  normalizeWorld();
  save();
}, 300000);

/* =========================================================
PERIODIC STATE NORMALIZATION
========================================================= */

setInterval(() => {
  normalizeAllState();
  if (dirty) {
    queueSaveAll();
  }
}, 600000);

/* =========================================================
GLOBAL MIDDLEWARE (ANTISPAM + DEATH GUARD)
========================================================= */

bot.use((ctx, next) => {
  if (!ctx.from) return;

  if (ctx.callbackQuery) {
    const allowed = antiSpamCallback(ctx.from.id);
    if (!allowed) {
      try {
        ctx.answerCbQuery("⏳ Slow down a bit").catch(() => {});
      } catch (err) {
        console.log("❌ ANTI-SPAM FEEDBACK ERROR:", err.message);
      }
      return;
    }
  } else {
    const allowed = antiSpam(ctx.from.id);
    if (!allowed) {
      try {
        ctx.reply("⏳ Slow down a bit").catch(() => {});
      } catch (err) {
        console.log("❌ ANTI-SPAM FEEDBACK ERROR:", err.message);
      }
      return;
    }
  }

  return next();
});

/* =========================================================
FALLBACK (CLEAN + SAFE ROUTING)
========================================================= */

bot.on("message", async (ctx) => {
  if (!ctx.from) return;

  const text = ctx.message?.text || "";
  const isPrivate = ctx.chat?.type === "private";

  if (!isPrivate) {
    const botUsername = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME_HERE";

    const mentioned = ctx.message?.entities?.some(
      (e) => e.type === "mention"
    );

    const isCommandTrigger =
      text.startsWith("/start") ||
      text.startsWith("/game");

    if (!mentioned && !isCommandTrigger) {
      return;
    }

    return reply(
      ctx,
      "🌌 FOMO YODELVERSE\n\nEnter your private game:",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "🚀 START GAME",
            `https://t.me/${process.env.BOT_USERNAME || "YOUR_BOT_USERNAME_HERE"}?start=hub`
          )
        ]
      ])
    );
  }

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;

  const allowedPrivateEntry =
    text.startsWith("/game") ||
    text.startsWith("/start");

  if (!allowedPrivateEntry) return;

  return reply(
    ctx,
    `🌌 FOMO YODELVERSE

Use /game to enter the Yodelverse properly.

Press START to begin your journey.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🚀 START", "start_game")]
    ])
  );
});

/* =========================================================
START ENGINE (UNIFIED ENTRY)
========================================================= */

bot.start(async (ctx) => {
  if (ctx.chat?.type !== "private") {
    const botUsername = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME_HERE";

    return reply(
      ctx,
      "🌌 FOMO YODELVERSE\n\nEnter your private game:",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "🚀 START GAME",
            `https://t.me/${botUsername}?start=hub`
          )
        ]
      ])
    );
  }

  const u = getUser(ctx.from.id, ctx);
  const intent = resolveEntryIntent(ctx);

  // Unified admission: only allow valid entry intents
  if (!intent) {
    return reply(ctx, "❌ Invalid entry. Please use /start or /game.");
  }

  applyEntryIntent(u, intent);

  if (checkDeath(ctx, u)) {
    return reply(
      ctx,
      "💀 You are dead.\n\nUse /respawn to return to the Yodelverse."
    );
  }

  return reply(
    ctx,
    `🌌 FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.

Press START to enter the Yodelverse.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🚀 START", "start_game")]
    ])
  );
});

bot.command("game", async (ctx) => {
  if (ctx.chat?.type !== "private") {
    const botUsername = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME_HERE";

    return reply(
      ctx,
      "🌌 FOMO YODELVERSE\n\nEnter your private game:",
      Markup.inlineKeyboard([
        [
          Markup.button.url(
            "🚀 START GAME",
            `https://t.me/${botUsername}?start=hub`
          )
        ]
      ])
    );
  }

  const u = getUser(ctx.from.id, ctx);
  const intent = resolveEntryIntent(ctx);

  if (!intent) {
    return reply(ctx, "❌ Invalid entry. Please use /start or /game.");
  }

  applyEntryIntent(u, intent);

  if (checkDeath(ctx, u)) return;

  return reply(
    ctx,
    `🌌 FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.

Press START to enter the Yodelverse.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🚀 START", "start_game")]
    ])
  );
});

bot.action("start_game", async (ctx) => {
  await ack(ctx);

  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) return;

  const intent = consumeEntryIntent(u);

  if (!intent) {
    return reply(ctx, "❌ Please use /start or /game first to enter the Yodelverse.");
  }

  u.registered = true;

  if (!u.character) {
    u.character = rand(CHARACTERS);
  }

  if (!u.faction) {
    u.faction = rand(FACTIONS);
  }

  normalizeUser(u);
  save();

  return home(ctx, u);
});

bot.launch()
  .then(() => console.log("🌌 FOMO YODELVERSE ONLINE"))
  .catch((err) => console.error("❌ Launch error:", err));
```
