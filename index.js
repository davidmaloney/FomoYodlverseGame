/**
 * =========================================================
 * 🌌 FOMO YODLVERSE — ULTIMATE HUB EDITION v2.7.2
 * =========================================================
 *
 * CHANGES v2.7.2 — Remaining spinner/hang fixes
 *
 * All v2.7.1 fixes preserved. Zero gameplay changes.
 *
 * ROOT CAUSES (remaining after v2.7.1):
 *
 *   FIX M — addChaos() deferred spawnBoss()
 *     addChaos() was calling spawnBoss() synchronously inside
 *     every action handler (event, crime, war, hack, boss).
 *     spawnBoss() does non-trivial work (object construction,
 *     save(), setTimeout broadcast) all inline, potentially
 *     delaying the handler's reply() past Telegram's 3-second
 *     answerCbQuery window. spawnBoss() inside addChaos() is
 *     now deferred with setImmediate so it runs after the
 *     current handler completes its reply().
 *
 *   FIX N — faction_ handler: broadcastFire before reply()
 *     In the faction_(.+) action, broadcastFire() and
 *     addBulletin() were called BEFORE reply() and home().
 *     broadcastFire() is non-blocking (setImmediate) but
 *     addBulletin() called save() synchronously. Reordered
 *     so reply/home fire first, then side-effects.
 *
 *   FIX O — damageBoss() / checkBossTaunts() inline broadcast
 *     checkBossTaunts() called broadcastFire() synchronously
 *     from inside damageBoss(), which is called mid-handler
 *     in the boss action before reply(). broadcastFire()
 *     itself is already deferred, but the taunt array writes
 *     and save() call still ran inline. Moved the save()
 *     inside checkBossTaunts() to be deferred via setImmediate
 *     so it doesn't block the calling handler.
 *
 *   FIX P — inv_use / inv_sell / inv_page missing guardAction
 *     These handlers called getUser() directly, skipping the
 *     dead-check and registration guard. A dead or unregistered
 *     user clicking an inventory button would get no response
 *     at all (silent hang from Telegram's perspective).
 *     guardAction() added to all three handlers.
 *
 *   FIX Q — /forcesave admin command missing await
 *     forceSave() is async but was called without await,
 *     causing the "Force save complete" reply to fire before
 *     the save actually finished. Minor correctness fix.
 *
 * =========================================================
 */

"use strict";

const fs     = require("fs");
const fsp    = require("fs").promises;   // FIX J: async fs
const crypto = require("crypto");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

/* =========================================================
   BOT CORE
========================================================= */

if (!process.env.BOT_TOKEN) {
  console.error("❌ Missing BOT_TOKEN");
  process.exit(1);
}

const bot = new Telegraf(process.env.BOT_TOKEN);
console.log("🌌 FOMO YODLVERSE ENGINE BOOTING...");

/* =========================================================
   CONFIG
========================================================= */

const CONFIG = {
  SAVE_INTERVAL:       15_000,
  COOLDOWN:            5_000,
  MAX_HP:              100,
  MAX_ENERGY:          100,
  START_CREDITS:       100,
  DAILY_COOLDOWN:      86_400_000,
  ADMIN_IDS:           (process.env.ADMIN_IDS || "").split(",").filter(Boolean),
  HUB_MODE:            true,
  SESSION_TTL:         1000 * 60 * 60 * 24,
  SESSION_SECRET:      process.env.SESSION_SECRET || "CHANGE_THIS_SECRET",
  BOSS_MIN_HP:         1200,
  BOSS_MAX_HP:         3500,
  CHAOS_BOSS_TRIGGER:  15,
  MAX_CHAOS:           100,
  BROADCAST_LIMIT:     300,
  BROADCAST_DELAY_MS:  55,
  MSG_MENU_INTERVAL:   7,
  ENERGY_COSTS: {
    event: 5,
    mine:  4,
    crime: 8,
    war:   10,
    boss:  6,
    hack:  7
  }
};

/* =========================================================
   STORAGE
========================================================= */

const DB_FILE      = "./data.json";
const WORLD_FILE   = "./world.json";
const SESSION_FILE = "./sessions.json";

function loadFile(path, fallback) {
  try {
    if (!fs.existsSync(path)) return fallback;
    const raw = fs.readFileSync(path, "utf8").trim();
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
    return parsed;
  } catch (err) {
    console.error("❌ LOAD ERROR:", path, err.message);
    return fallback;
  }
}

/* =========================================================
   IN-MEMORY STATE
========================================================= */

let DB       = loadFile(DB_FILE, {});
let WORLD    = loadFile(WORLD_FILE, {
  season:      1,
  chaos:       1,
  marketState: "stable",
  boss:        null,
  factions:    { HODL: 0, FOMO: 0, SCAM: 0, WHALE: 0 },
  onboardSeen: {},
  bulletin:    []
});
let SESSIONS = loadFile(SESSION_FILE, {});
let dirty    = false;

/* =========================================================
   WORLD REPAIR
========================================================= */

function repairWorld() {
  if (!WORLD) WORLD = {};
  if (typeof WORLD.season      !== "number") WORLD.season      = 1;
  if (typeof WORLD.chaos       !== "number") WORLD.chaos       = 1;
  if (typeof WORLD.marketState !== "string") WORLD.marketState = "stable";
  if (WORLD.boss === undefined)              WORLD.boss        = null;
  if (!WORLD.factions || typeof WORLD.factions !== "object") {
    WORLD.factions = { HODL: 0, FOMO: 0, SCAM: 0, WHALE: 0 };
  }
  for (const f of ["HODL", "FOMO", "SCAM", "WHALE"]) {
    if (typeof WORLD.factions[f] !== "number") WORLD.factions[f] = 0;
  }
  if (!WORLD.onboardSeen || typeof WORLD.onboardSeen !== "object") WORLD.onboardSeen = {};
  if (!Array.isArray(WORLD.bulletin)) WORLD.bulletin = [];

  for (const k of Object.keys(WORLD.onboardSeen)) {
    const strKey = String(k);
    if (strKey !== k) {
      WORLD.onboardSeen[strKey] = WORLD.onboardSeen[k];
      delete WORLD.onboardSeen[k];
    }
  }
}

repairWorld();

/* =========================================================
   ONE-TIME STARTUP MIGRATION (v2.6.0 FIX C)
========================================================= */

function migrateDB() {
  let migrated = 0;
  for (const k of Object.keys(DB)) {
    if (!/^\d+$/.test(k)) continue;
    const strKey   = String(k);
    if (k === strKey) continue;
    const numRecord = DB[k];
    const strRecord = DB[strKey];
    if (!strRecord) {
      DB[strKey] = { ...numRecord, id: strKey };
    } else {
      const keep = (!strRecord.dead && strRecord.registered) ? strRecord
                 : (!numRecord.dead && numRecord.registered) ? numRecord
                 : strRecord;
      DB[strKey] = { ...keep, id: strKey };
    }
    delete DB[k];
    migrated++;
  }
  if (migrated > 0) {
    console.log(`♻️  migrateDB: cleaned ${migrated} legacy numeric-keyed record(s)`);
    dirty = true;
  }
}

migrateDB();

/* =========================================================
   ATOMIC SAVE — FIX J: fully async, non-blocking
   A per-file write queue serialises concurrent saves so two
   writes never race on the same path.
========================================================= */

// One pending-promise slot per file path
const writeQueues = {};

async function atomicWrite(file, data) {
  // Queue writes per file so they never overlap
  const prev = writeQueues[file] || Promise.resolve();
  const next = prev.then(() => _doAtomicWrite(file, data));
  writeQueues[file] = next.catch(() => {}); // don't let a failure block the queue
  return next;
}

async function _doAtomicWrite(file, data) {
  const temp   = `${file}.tmp`;
  const backup = `${file}.bak`;
  try {
    // All fs ops are now async — event loop is free between each step
    if (fs.existsSync(file)) await fsp.copyFile(file, backup);
    await fsp.writeFile(temp, JSON.stringify(data, null, 2));
    const raw   = await fsp.readFile(temp, "utf8");
    const check = JSON.parse(raw);
    if (!check || typeof check !== "object") throw new Error("Validation failed");
    await fsp.rename(temp, file);
  } catch (err) {
    console.error("❌ ATOMIC WRITE FAILED:", file, err.message);
    try {
      if (fs.existsSync(backup)) {
        await fsp.copyFile(backup, file);
        console.log("♻️  Restored backup:", file);
      }
    } catch (re) { console.error("❌ BACKUP RESTORE FAILED:", re.message); }
  }
}

function save() { dirty = true; }

// FIX K: forceSave is async so the setInterval never blocks the thread
async function forceSave() {
  if (!dirty) return;
  try {
    // Run all three writes in parallel — they're independent files
    await Promise.all([
      atomicWrite(DB_FILE,      DB),
      atomicWrite(WORLD_FILE,   WORLD),
      atomicWrite(SESSION_FILE, SESSIONS)
    ]);
    dirty = false;
    console.log("💾 Saved safely");
  } catch (err) { console.error("❌ SAVE ERROR:", err.message); }
}

// FIX K: interval calls async forceSave; no blocking on the event loop
setInterval(() => { if (dirty) forceSave(); }, CONFIG.SAVE_INTERVAL);

/* =========================================================
   PROCESS SAFETY
========================================================= */

process.on("uncaughtException",  err => console.error("❌ UNCAUGHT:",  err));
process.on("unhandledRejection", err => console.error("❌ REJECTION:", err));
process.on("SIGINT",  () => { forceSave().finally(() => process.exit(0)); });
process.on("SIGTERM", () => { forceSave().finally(() => process.exit(0)); });

/* =========================================================
   UTILITIES
========================================================= */

const rand       = arr  => arr[Math.floor(Math.random() * arr.length)];
const now        = ()   => Date.now();
const clamp      = (n, min, max) => Math.max(min, Math.min(max, n));
const level      = xp   => Math.floor(xp / 100) + 1;
const isAdmin    = id   => CONFIG.ADMIN_IDS.includes(String(id));
const safeNumber = (n, fallback = 0) =>
  typeof n === "number" && !isNaN(n) ? n : fallback;

/* =========================================================
   ANTISPAM
========================================================= */

const ACTION_SPAM   = {};
const CALLBACK_SPAM = {};

function antiSpam(userId, ms = 1200) {
  const last = ACTION_SPAM[userId] || 0;
  if (now() - last < ms) return false;
  ACTION_SPAM[userId] = now();
  return true;
}

function antiSpamCallback(userId, ms = 1200) {
  const last = CALLBACK_SPAM[userId] || 0;
  if (now() - last < ms) return false;
  CALLBACK_SPAM[userId] = now();
  return true;
}

bot.use(async (ctx, next) => {
  if (!ctx.from) return;
  try {
    if (ctx.callbackQuery) {
      if (!antiSpamCallback(ctx.from.id)) {
        try { await ctx.answerCbQuery("⏳ Slow down a bit"); } catch {}
        return;
      }
    } else {
      if (!antiSpam(ctx.from.id)) {
        try { await ctx.reply("⏳ Slow down a bit"); } catch {}
        return;
      }
    }
    return await next();
  } catch (err) {
    console.error("❌ MIDDLEWARE ERROR:", err.message);
  }
});

/* =========================================================
   MESSAGE COUNTER
========================================================= */

const MSG_COUNTER = {};

function tickMessageCounter(userId) {
  MSG_COUNTER[userId] = (MSG_COUNTER[userId] || 0) + 1;
  if (MSG_COUNTER[userId] >= CONFIG.MSG_MENU_INTERVAL) {
    MSG_COUNTER[userId] = 0;
    return true;
  }
  return false;
}

function resetMessageCounter(userId) {
  MSG_COUNTER[userId] = 0;
}

/* =========================================================
   REPLY HELPERS
========================================================= */

async function reply(ctx, text, extra = {}) {
  try {
    const threadId =
      ctx.message?.message_thread_id ||
      ctx.callbackQuery?.message?.message_thread_id;
    const options = { ...extra };
    if (threadId != null) options.message_thread_id = threadId;
    return await ctx.reply(text, options);
  } catch (err) {
    console.error("❌ REPLY ERROR:", err.message);
  }
}

async function ack(ctx) {
  try { await ctx.answerCbQuery(); } catch {}
}

/* =========================================================
   ONBOARDING GATE (group chat)
========================================================= */

const ONBOARDING = { enabled: true, cooldown: 1000 * 60 * 60 * 24 };

function hasSeenOnboarding(userId) {
  const last = WORLD.onboardSeen[String(userId)];
  return last ? (Date.now() - last) < ONBOARDING.cooldown : false;
}

function markOnboardingSeen(userId) {
  WORLD.onboardSeen[String(userId)] = Date.now();
  save();
}

bot.use(async (ctx, next) => {
  try {
    if (!ONBOARDING.enabled)         return next();
    if (!ctx.from || !ctx.chat)      return next();
    if (ctx.chat.type === "private") return next();

    const userId   = ctx.from.id;
    const existing = DB[String(userId)];

    if (existing?.registered)      return next();
    if (hasSeenOnboarding(userId)) return next();

    markOnboardingSeen(userId);

    const link = hubPrivateLink(userId, ctx);
    await reply(ctx,
`🌌 Welcome to FOMOYODLVERSE

The chain has collapsed.
Survivors now fight for credits, factions, and control of the Yodlverse.

Start your journey below.`,
      Markup.inlineKeyboard([[Markup.button.url("🎮 ENTER FOMOYODLVERSE", link)]])
    );
    return next();
  } catch (err) {
    console.error("❌ ONBOARDING ERROR:", err.message);
    return next();
  }
});

/* =========================================================
   SESSION SYSTEM
========================================================= */

function signSession(id) {
  return crypto.createHmac("sha256", CONFIG.SESSION_SECRET).update(id).digest("hex");
}

function createSession(userId, topicId) {
  const id  = crypto.randomBytes(16).toString("hex");
  const sig = signSession(id);
  SESSIONS[id] = { userId, topicId: topicId ?? null, created: now(), sig };
  save();
  return `${id}.${sig}`;
}

function validateSession(token) {
  try {
    if (!token) return null;
    const [id, sig] = token.split(".");
    if (!id || !sig || signSession(id) !== sig) return null;
    const session = SESSIONS[id];
    if (!session || session.sig !== sig) return null;
    if (now() - session.created > CONFIG.SESSION_TTL) {
      delete SESSIONS[id]; save(); return null;
    }
    return session;
  } catch { return null; }
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
    if (now() - SESSIONS[id].created > CONFIG.SESSION_TTL) {
      delete SESSIONS[id]; changed = true;
    }
  }
  if (changed) save();
}
setInterval(cleanupSessions, 3_600_000);

function resolveSessionFromCtx(ctx) {
  const payload = ctx.startPayload;
  if (typeof payload === "string" && payload.startsWith("session_")) {
    return validateSessionForUser(payload.slice("session_".length), ctx.from?.id);
  }
  return null;
}

function hubPrivateLink(userId, ctx) {
  const topicId =
    ctx.message?.message_thread_id ||
    ctx.callbackQuery?.message?.message_thread_id ||
    null;
  const token       = createSession(userId, topicId);
  const botUsername = process.env.BOT_USERNAME || "";
  if (!botUsername) console.warn("⚠️  BOT_USERNAME not set — deep links won't work!");
  return `https://t.me/${botUsername}?start=session_${token}`;
}

/* =========================================================
   USER SYSTEM
========================================================= */

function createUser(id, ctx = null) {
  return {
    id:              String(id),
    name:            ctx?.from?.first_name || "Player",
    username:        ctx?.from?.username   || "",
    registered:      false,
    character:       null,
    faction:         null,
    xp:              0,
    credits:         CONFIG.START_CREDITS,
    hp:              CONFIG.MAX_HP,
    energy:          CONFIG.MAX_ENERGY,
    wins:            0,
    losses:          0,
    reputation:      0,
    prestige:        0,
    inventory:       [],
    apartment:       "Container Unit",
    ship:            "Rust Bucket",
    miningLevel:     1,
    hackingLevel:    1,
    cooldowns:       {},
    lastDaily:       0,
    dailyStreak:     0,
    lastDailyDate:   "",
    wanted:          false,
    wantedLevel:     0,
    warStreak:       0,
    dead:            false,
    deathTime:       null,
    bossHits:        0,
    lastEnergyRegen: 0
  };
}

function repairUser(u) {
  if (!u) return u;
  u.id = String(u.id);
  if (!u.cooldowns || typeof u.cooldowns !== "object") u.cooldowns = {};
  if (!Array.isArray(u.inventory)) u.inventory = [];
  u.xp           = safeNumber(u.xp);
  u.credits      = safeNumber(u.credits);
  u.hp           = safeNumber(u.hp, CONFIG.MAX_HP);
  u.energy       = safeNumber(u.energy, CONFIG.MAX_ENERGY);
  u.wins         = safeNumber(u.wins);
  u.losses       = safeNumber(u.losses);
  u.reputation   = safeNumber(u.reputation);
  u.prestige     = safeNumber(u.prestige);
  u.miningLevel  = safeNumber(u.miningLevel, 1);
  u.hackingLevel = safeNumber(u.hackingLevel, 1);
  if (typeof u.dailyStreak     !== "number") u.dailyStreak     = 0;
  if (typeof u.lastDailyDate   !== "string") u.lastDailyDate   = "";
  if (typeof u.wantedLevel     !== "number") u.wantedLevel     = 0;
  if (typeof u.warStreak       !== "number") u.warStreak       = 0;
  if (typeof u.bossHits        !== "number") u.bossHits        = 0;
  if (typeof u.lastEnergyRegen !== "number") u.lastEnergyRegen = 0;
  if (typeof u.dead            !== "boolean") u.dead           = false;
  if (u.hp <= 0 && !u.dead) { u.dead = true; u.deathTime = u.deathTime || now(); }
  if (u.deathTime === undefined) u.deathTime = null;
  return u;
}

function getUser(id, ctx = null) {
  id = String(id);
  if (!DB[id]) { DB[id] = createUser(id, ctx); save(); }
  DB[id] = repairUser(DB[id]);
  DB[id].id = id;
  return DB[id];
}

/* =========================================================
   HARD RESET (respawn path)
========================================================= */

function hardResetPlayer(user) {
  const id       = String(user.id);
  const name     = user.name;
  const username = user.username;

  const numericId = Number(id);
  if (!isNaN(numericId) && DB[numericId] !== undefined) delete DB[numericId];

  DB[id]            = createUser(id);
  DB[id].name       = name     || "Player";
  DB[id].username   = username || "";
  DB[id].registered = false;

  if (WORLD.onboardSeen?.[id]) delete WORLD.onboardSeen[id];

  save();
  return getUser(id);
}

/* =========================================================
   PASSIVE ENERGY REGEN
========================================================= */

const ENERGY_REGEN_INTERVAL = 1000 * 60 * 3;

function applyEnergyRegen(user) {
  if (!user || user.dead) return;
  const t     = now();
  const last  = user.lastEnergyRegen || 0;
  const ticks = Math.floor((t - last) / ENERGY_REGEN_INTERVAL);
  if (ticks <= 0) return;
  user.energy          = clamp(user.energy + ticks, 0, CONFIG.MAX_ENERGY);
  user.lastEnergyRegen = last + (ticks * ENERGY_REGEN_INTERVAL);
}

/* =========================================================
   COOLDOWNS
========================================================= */

function cooldownOk(user, key, ms = CONFIG.COOLDOWN) {
  if (!user) return false;
  if (!user.cooldowns || typeof user.cooldowns !== "object") user.cooldowns = {};
  const t    = now();
  const last = user.cooldowns[key] || 0;
  if (t - last < ms) return false;
  user.cooldowns[key] = t;
  return true;
}

/* =========================================================
   DEATH HELPERS
========================================================= */

function isDead(user)        { return !!user?.dead; }
function checkDeath(ctx, u)  { if (!u || !u.dead) return false; if (u.hp > 0) u.hp = 0; return true; }

function deadMenuText(u) {
  const elapsed   = now() - (u.deathTime || now());
  const cooldown  = REBIRTH_CONFIG.rebirthCooldown;
  const remaining = Math.max(0, Math.ceil((cooldown - elapsed) / 1000));
  return `💀 YOU HAVE BEEN ELIMINATED

The Yodlverse did not survive contact with your portfolio.

♻️ REBIRTH
• Keeps 25% XP
• Keeps prestige + bonuses
• Start with ${CONFIG.START_CREDITS + 100} credits
${remaining > 0 ? `⏳ Rebirth available in: ${remaining}s` : "✅ REBIRTH READY"}

💥 RESPAWN (FULL RESET)
• Deletes everything
• Returns to absolute zero
• Only if you truly want a clean slate`;
}

function deadMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("♻️ REBIRTH",         "rebirth")],
    [Markup.button.callback("💥 RESPAWN (RESET)", "respawn_confirm_prompt")]
  ]);
}

async function showDeadMenu(ctx, u) {
  return reply(ctx, deadMenuText(u), deadMenuKeyboard());
}

/* =========================================================
   guardAction() — FIX F (v2.7.0)
========================================================= */

async function guardAction(ctx, { needsRegistered = true, applyRegen = false } = {}) {
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) { await showDeadMenu(ctx, u); return null; }
  if (needsRegistered && !requireRegistered(u, ctx)) return null;
  if (applyRegen) applyEnergyRegen(u);
  return u;
}

/* =========================================================
   ROUTING HELPERS
========================================================= */

function isPrivateChat(ctx) {
  return ctx.chat?.type === "private";
}

function requirePrivate(ctx) {
  if (!isPrivateChat(ctx)) {
    reply(ctx, "🚫 Gameplay is only available in private chat.\n\nUse the private game button to continue.");
    return false;
  }
  return true;
}

function requireRegistered(user, ctx) {
  if (!user) {
    reply(ctx, "❌ User data not found. Please restart with /start.");
    return false;
  }
  if (user.registered) return true;
  const session = resolveSessionFromCtx(ctx);
  if (session) return true;
  reply(ctx,
    "❌ You are not registered yet.\n\nUse /start or tap 🚀 START to begin.",
    Markup.inlineKeyboard([[Markup.button.callback("🚀 START", "start_game")]])
  );
  return false;
}

function spendEnergy(user, amount, ctx = null) {
  if (user.energy < amount) {
    if (ctx) reply(ctx,
      `⚡ Not enough energy (need ${amount}, have ${user.energy}).\n\nBuy an Energy Cell at 🏪 MARKET or wait for regen.\n\n_YODEL-BOT: "Touch grass. Your energy bar isn't the only thing depleted."_`
    );
    return false;
  }
  user.energy -= amount;
  return true;
}

/* =========================================================
   REBIRTH SYSTEM
========================================================= */

const REBIRTH_CONFIG = {
  xpKeepRatio:     0.25,
  creditBonus:     100,
  energyRestore:   true,
  hpReset:         true,
  rebirthCooldown: 1000 * 60 * 10
};

function canRebirth(user) {
  if (!user || !user.dead) return false;
  if (!user.deathTime)     return true;
  return (now() - user.deathTime) > REBIRTH_CONFIG.rebirthCooldown;
}

function rebirthPlayer(user) {
  if (!user || !user.dead) return user;
  if (!canRebirth(user))   return null;
  user.dead        = false;
  user.deathTime   = null;
  if (REBIRTH_CONFIG.hpReset)       user.hp     = CONFIG.MAX_HP;
  if (REBIRTH_CONFIG.energyRestore) user.energy = CONFIG.MAX_ENERGY;
  user.xp          = Math.floor(user.xp * REBIRTH_CONFIG.xpKeepRatio);
  user.credits    += REBIRTH_CONFIG.creditBonus;
  user.prestige    = (user.prestige || 0) + 1;
  user.wanted      = false;
  user.wantedLevel = 0;
  user.warStreak   = 0;
  return user;
}

/* =========================================================
   BROADCAST
========================================================= */

function broadcastFire(message) {
  setImmediate(async () => {
    const ids = Object.keys(DB).slice(0, CONFIG.BROADCAST_LIMIT);
    for (const id of ids) {
      try { await bot.telegram.sendMessage(id, message); } catch {}
      await new Promise(r => setTimeout(r, CONFIG.BROADCAST_DELAY_MS));
    }
  });
}

/* =========================================================
   WORLD ENGINE
========================================================= */

// FIX M: spawnBoss() deferred inside addChaos() so it never runs
// synchronously inside an action handler before reply() is called.
function addChaos(amount) {
  const bossMods = getBossWorldModifiers();
  WORLD.chaos    = clamp(WORLD.chaos + amount + bossMods.chaosAdd * 0.1, 1, CONFIG.MAX_CHAOS);
  if (WORLD.chaos >= CONFIG.CHAOS_BOSS_TRIGGER && (!WORLD.boss || !WORLD.boss.active)) {
    // Defer boss spawn so the calling handler can reply() first
    setImmediate(() => spawnBoss());
  }
  if      (WORLD.chaos >= 80) WORLD.marketState = "crashing";
  else if (WORLD.chaos >= 50) WORLD.marketState = "volatile";
  save();
}

function addFactionPower(faction, amount) {
  if (!faction) return;
  if (WORLD.factions[faction] === undefined) WORLD.factions[faction] = 0;
  WORLD.factions[faction] += amount;
  save();
}

function getDominantFaction() {
  let top = null, topVal = -1;
  for (const [f, p] of Object.entries(WORLD.factions)) {
    if (p > topVal) { topVal = p; top = f; }
  }
  return top;
}

function getDominanceBonus(userFaction) {
  return (getDominantFaction() === userFaction) ? 0.10 : 0;
}

function softCapMultiplier(totalBonus) {
  if (totalBonus <= 0.30) return totalBonus;
  if (totalBonus <= 0.60) return 0.30 + (totalBonus - 0.30) * 0.7;
  return 0.30 + 0.21 + (totalBonus - 0.60) * 0.4;
}

function marketMultiplier() {
  const base = { stable: 1.0, bullish: 0.9, volatile: 1.15, crashing: 1.3 }[WORLD.marketState] || 1.0;
  return base * (1 + WORLD.chaos / 200);
}

function marketPrice(basePrice) {
  return Math.ceil(basePrice * marketMultiplier());
}

/* =========================================================
   BULLETIN
========================================================= */

function addBulletin(entry) {
  if (!Array.isArray(WORLD.bulletin)) WORLD.bulletin = [];
  WORLD.bulletin.unshift({ text: entry, ts: now() });
  if (WORLD.bulletin.length > 20) WORLD.bulletin.length = 20;
  save();
}

/* =========================================================
   GAME DATA
========================================================= */

const CHARACTERS = [
  "FOMO Yodl", "LFG Skytalker", "Fan SOLo", "OBi FOMO-WannaBe",
  "Princess Liquidia", "ChewStacka", "Web3PO", "R2-DeFi",
  "Admiral Growbar", "Darth F.A.D.E.R.", "Jabba the Whale",
  "Discount Duco", "Darth Scamious"
];

const FACTIONS = ["HODL", "FOMO", "SCAM", "WHALE"];

const FACTION_BONUSES = {
  HODL:  { mineBonus: 0.15, warBonus: 0,    crimeBonus: 0,    eventBonus: 0.05, hackBonus: 0    },
  FOMO:  { mineBonus: 0,    warBonus: 0.20, crimeBonus: 0,    eventBonus: 0.10, hackBonus: 0.05 },
  SCAM:  { mineBonus: 0,    warBonus: 0,    crimeBonus: 0.25, eventBonus: 0,    hackBonus: 0.20 },
  WHALE: { mineBonus: 0.10, warBonus: 0.10, crimeBonus: 0.10, eventBonus: 0.10, hackBonus: 0.10 }
};

const FACTION_FLAVOUR = {
  HODL:  ["📈 HODL dominates. The market breathes slowly.", "🧊 HODL discipline steadies the chain.", "📊 Diamond hands control the flow today."],
  FOMO:  ["🚀 FOMO surges. Everyone's buying highs.", "📣 FOMO energy floods the sectors.", "⚡ The crowd is unhinged. Perfect conditions."],
  SCAM:  ["🎭 SCAM faction thrives in the shadows.", "🕶 Someone's running a honeypot. Classic.", "💀 Trust nobody. Especially yourself."],
  WHALE: ["🐋 Whales move markets. The rest follow.", "💰 Deep wallets pull all the strings.", "🌊 Liquidity shifts. WHALE dominates."]
};

function getFactionFlavour(faction) {
  const dominant = getDominantFaction();
  if (dominant && dominant === faction) {
    const lines = FACTION_FLAVOUR[dominant];
    return lines ? `\n_${rand(lines)}_` : "";
  }
  return "";
}

const YODELBOT_LINES = {
  win:          ["_YODEL-BOT: 'Congrats. You didn't lose everything. Yet.'_", "_YODEL-BOT: 'Profit confirmed. Hubris incoming.'_", "_YODEL-BOT: 'Number go up. Don't get used to it.'_", "_YODEL-BOT: 'Well done. The chain acknowledges your greed.'_"],
  lose:         ["_YODEL-BOT: 'Rekt. As predicted by everyone.'_", "_YODEL-BOT: 'This is fine. Everything is fine.'_", "_YODEL-BOT: 'Have you tried not losing?'_", "_YODEL-BOT: 'Your ancestors are embarrassed.'_"],
  chaos_high:   ["_YODEL-BOT: 'Chaos at ${c}. Pure entropy. Beautiful.'_", "_YODEL-BOT: 'Markets unhinged. Ideal conditions for gambling.'_", "_YODEL-BOT: 'Maximum chaos reached. Welcome home.'_"],
  boss_active:  ["_YODEL-BOT: 'A boss walks the chain. Rewards are... complicated.'_", "_YODEL-BOT: 'Boss event active. Good luck. You'll need it.'_"],
  market_crash: ["_YODEL-BOT: 'Market crashing. Who could have predicted this? Everyone.'_", "_YODEL-BOT: 'Everything is down. Except your self-loathing.'_"]
};

function getYodelBot(type, chaosVal) {
  const lines = YODELBOT_LINES[type];
  if (!lines?.length) return "";
  let line = rand(lines);
  if (chaosVal !== undefined) line = line.replace("${c}", chaosVal);
  return `\n\n${line}`;
}

function contextualYodelBot(u, won) {
  if (WORLD.chaos >= 70)                return getYodelBot("chaos_high", WORLD.chaos);
  if (WORLD.marketState === "crashing") return getYodelBot("market_crash");
  if (WORLD.boss?.active)              return getYodelBot("boss_active");
  return won ? getYodelBot("win") : getYodelBot("lose");
}

const EVENTS = [
  { title: "Whale Manipulation",  text: "Massive liquidity distortion detected.",    xp: 20, credits: 15, chaos: 2, risk: 0.30 },
  { title: "Meme Coin Frenzy",    text: "Speculators flood the markets.",             xp: 15, credits: 20, chaos: 1, risk: 0.25 },
  { title: "Shadow Rugpull",      text: "Entire sectors collapse instantly.",         xp: 35, credits: 30, chaos: 3, risk: 0.45 },
  { title: "Quantum Pump",        text: "Unknown forces trigger hypergrowth.",        xp: 50, credits: 40, chaos: 4, risk: 0.50 },
  { title: "Flash Loan Attack",   text: "Someone drained three protocols at once.",   xp: 40, credits: 35, chaos: 3, risk: 0.40 },
  { title: "Airdrop Frenzy",      text: "Free tokens rain from the void.",            xp: 10, credits: 50, chaos: 1, risk: 0.15 },
  { title: "Protocol Breach",     text: "A rogue actor exposed the chain's core.",   xp: 45, credits: 38, chaos: 4, risk: 0.48 },
  { title: "Liquidity Crisis",    text: "All pools drained simultaneously.",          xp: 30, credits: 25, chaos: 3, risk: 0.42 }
];

const HACK_TARGETS = [
  { name: "Imperial Payroll Wallet",   xp: 20, credits: 35,  chaos: 1, risk: 0.35, hackReq: 1 },
  { name: "Death Star Exchange",       xp: 30, credits: 55,  chaos: 2, risk: 0.42, hackReq: 2 },
  { name: "Galactic Senate Treasury",  xp: 45, credits: 80,  chaos: 2, risk: 0.50, hackReq: 3 },
  { name: "Sith Lord Protocol",        xp: 60, credits: 110, chaos: 3, risk: 0.58, hackReq: 4 },
  { name: "The Force Vault",           xp: 80, credits: 150, chaos: 4, risk: 0.65, hackReq: 5 }
];

/* =========================================================
   ITEM SYSTEM
========================================================= */

const ITEMS = [
  { id: "scrap_token",      name: "Scrap Droid Parts",         rarity: "common",    power: 1,  type: "resource", hpBonus: 0,  energyBonus: 5  },
  { id: "glitch_shard",     name: "Glitched Holocron",         rarity: "common",    power: 2,  type: "resource", hpBonus: 0,  energyBonus: 8  },
  { id: "dark_token",       name: "Dark Side Token",           rarity: "rare",      power: 4,  type: "resource", hpBonus: 5,  energyBonus: 0  },
  { id: "quantum_ore",      name: "Kyber Crystal Shard",       rarity: "rare",      power: 6,  type: "resource", hpBonus: 8,  energyBonus: 0  },
  { id: "meme_crystal",     name: "Meme Crystal (Corrupted)",  rarity: "epic",      power: 10, type: "boost",    hpBonus: 15, energyBonus: 10 },
  { id: "whale_fragment",   name: "Sarlacc Pit Bond",          rarity: "epic",      power: 12, type: "boost",    hpBonus: 20, energyBonus: 0  },
  { id: "forbidden_ledger", name: "Palpatine's Secret Ledger", rarity: "legendary", power: 25, type: "relic",    hpBonus: 30, energyBonus: 25 },
  { id: "void_core",        name: "Void Core (Force-Imbued)",  rarity: "legendary", power: 30, type: "relic",    hpBonus: 40, energyBonus: 30 },
  { id: "rug_shard",        name: "Rug Shard (Still Warm)",    rarity: "common",    power: 1,  type: "resource", hpBonus: 0,  energyBonus: 3  },
  { id: "defi_key",         name: "Jedi Order Access Key",     rarity: "rare",      power: 5,  type: "resource", hpBonus: 10, energyBonus: 5  },
  { id: "satoshi_relic",    name: "Satoshi's Lightsaber",      rarity: "legendary", power: 35, type: "relic",    hpBonus: 50, energyBonus: 40 },
  { id: "zero_day",         name: "Zero-Day Force Exploit",    rarity: "rare",      power: 7,  type: "resource", hpBonus: 0,  energyBonus: 12 },
  { id: "cipher_key",       name: "Cipher Key (Mandalorian)",  rarity: "epic",      power: 14, type: "boost",    hpBonus: 10, energyBonus: 15 },
  { id: "ghost_protocol",   name: "Ghost Protocol Relic",      rarity: "legendary", power: 28, type: "relic",    hpBonus: 35, energyBonus: 35 }
];

const ITEM_SELL_VALUES  = { common: 15, rare: 45, epic: 120, legendary: 350 };
const ITEM_RARITY_STARS = { common: "⚪", rare: "🔵", epic: "🟣", legendary: "🟡" };

const DROP_TABLE = {
  mine:  [0.25, 0.10, 0.03, 0.005],
  event: [0.20, 0.08, 0.02, 0.003],
  crime: [0.30, 0.12, 0.04, 0.008],
  war:   [0.22, 0.09, 0.03, 0.005],
  boss:  [0.40, 0.20, 0.10, 0.030],
  hack:  [0.28, 0.14, 0.05, 0.010]
};

function rollDrop(activity, chaosBonus = 0) {
  const [c, r, e, l] = DROP_TABLE[activity] || [0.15, 0.05, 0.01, 0.001];
  const boost = chaosBonus * 0.002;
  const roll  = Math.random();
  let rarity;
  if      (roll < l + boost * 0.1)             rarity = "legendary";
  else if (roll < l + e + boost * 0.3)         rarity = "epic";
  else if (roll < l + e + r + boost * 0.6)     rarity = "rare";
  else if (roll < l + e + r + c + boost)       rarity = "common";
  else return null;
  const pool = ITEMS.filter(i => i.rarity === rarity);
  return pool.length ? rand(pool) : null;
}

function tryDrop(user, activity) {
  const item = rollDrop(activity, WORLD.chaos);
  if (!item) return "";
  user.inventory.push({ ...item });
  return `\n\n${ITEM_RARITY_STARS[item.rarity] || "⚪"} ITEM DROP: ${item.name} (${item.rarity}) [PWR ${item.power}]`;
}

/* =========================================================
   BOSS SYSTEM
========================================================= */

const BOSS_ROSTER = [
  { name: "DARTH RUGPULLUS",         tier: 1, hpMult: 1.0, reward: 80,  lore: "Promises 100x returns. Delivers 0." },
  { name: "VAPORWARE SPECTER",       tier: 1, hpMult: 1.0, reward: 80,  lore: "Ships products in the next quarter. Always next quarter." },
  { name: "LORD PAPER HANDS",        tier: 1, hpMult: 1.1, reward: 90,  lore: "Sells every dip. His midi-chlorians are pure fear." },
  { name: "JABBA THE WHALE",         tier: 2, hpMult: 1.3, reward: 120, lore: "Controls the Outer Rim liquidity pools." },
  { name: "DARTH LIQUIDATOR",        tier: 2, hpMult: 1.4, reward: 130, lore: "Erases leveraged positions across the chain." },
  { name: "COUNT PONZI-DOKU",        tier: 2, hpMult: 1.4, reward: 130, lore: "His returns are too good. They are always too good." },
  { name: "GENERAL FOMO GRIEVOUS",   tier: 2, hpMult: 1.5, reward: 140, lore: "Buys the top. Commands armies of retail bagholders." },
  { name: "THE VOID LEVIATHAN",      tier: 3, hpMult: 1.8, reward: 200, lore: "Ancient entity. Predates the first block." },
  { name: "EMPEROR SATOSHI SHADOW",  tier: 3, hpMult: 2.0, reward: 220, lore: "The dark mirror of the original vision." },
  { name: "SITH LORD NAKAMOTO",      tier: 3, hpMult: 2.2, reward: 250, lore: "He did not disappear. He was waiting." }
];

const BOSS_TAUNTS = {
  66: ["💢 «You think you can challenge me? I've seen empires crumble into meme coins.»", "💢 «Pathetic. I've liquidated better traders than you for sport.»"],
  33: ["💥 «Impossible... My algorithms never account for this level of stupidity!»", "💥 «You fools! I'll crash the whole chain before I fall!»"],
  10: ["💀 «No... The chain... The chain cannot end like this...»", "💀 «Even dead, I hold bags in the void. You will too.»"]
};

function getBossWorldModifiers() {
  if (!WORLD.boss?.active) return { rewardMult: 1.0, chaosAdd: 0, crimeBoost: 0, mineDebuff: 0 };
  const tier = WORLD.boss.tier || 1;
  const name = WORLD.boss.name || "";
  const base = ({
    1: { rewardMult: 0.90, chaosAdd: 1, crimeBoost: 0.05, mineDebuff: 0.05 },
    2: { rewardMult: 0.85, chaosAdd: 2, crimeBoost: 0.10, mineDebuff: 0.10 },
    3: { rewardMult: 0.80, chaosAdd: 3, crimeBoost: 0.20, mineDebuff: 0.15 }
  }[tier]) || { rewardMult: 0.90, chaosAdd: 1, crimeBoost: 0.05, mineDebuff: 0.05 };
  if (name.includes("LIQUIDATOR") || name.includes("PAPER HANDS")) base.mineDebuff += 0.10;
  if (name.includes("PONZI")      || name.includes("RUGPULL"))     base.crimeBoost += 0.15;
  if (name.includes("FOMO GRIEVOUS") || name.includes("VOID LEVIATHAN")) base.chaosAdd += 2;
  return base;
}

function bossWorldLine() {
  if (!WORLD.boss?.active) return "";
  const mods  = getBossWorldModifiers();
  const lines = [];
  if (mods.mineDebuff > 0) lines.push(`⚠️ ${WORLD.boss.name} suppresses mining yields`);
  if (mods.crimeBoost > 0) lines.push(`🔥 ${WORLD.boss.name} fuels criminal activity`);
  if (mods.chaosAdd   > 0) lines.push(`💀 Boss presence escalates chaos`);
  return lines.length ? `\n${rand(lines)}` : "";
}

let bossLock = false;

function spawnBoss() {
  if (bossLock || WORLD.boss?.active) return WORLD.boss || null;
  bossLock = true;
  try {
    const template = rand(BOSS_ROSTER);
    const baseHp   = CONFIG.BOSS_MIN_HP + Math.floor(Math.random() * (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP));
    const hp       = Math.floor(baseHp * template.hpMult);
    WORLD.boss = {
      active:       true,
      id:           crypto.randomBytes(8).toString("hex"),
      name:         template.name,
      tier:         template.tier,
      hp,
      maxHp:        hp,
      reward:       template.reward,
      lore:         template.lore,
      participants: {},
      tauntsUsed:   []
    };
    save();
    const mods        = getBossWorldModifiers();
    const effectLines = [];
    if (mods.mineDebuff > 0) effectLines.push("⛏ Mining yields reduced");
    if (mods.crimeBoost > 0) effectLines.push("🕶 Crime profits increased");
    if (mods.chaosAdd   > 0) effectLines.push("🔥 Chaos escalating per action");
    const effectStr = effectLines.length ? `\n\n🌍 World Effects:\n${effectLines.join("\n")}` : "";

    // FIX L: defer the broadcast with an extra yield so it never delays
    // the calling handler's reply(). setImmediate alone isn't enough on a
    // saturated single-core VPS; the extra setTimeout(0) ensures the
    // broadcast loop starts only after the current call stack fully unwinds.
    setTimeout(() => {
      broadcastFire(
`🐋 WORLD BOSS SPAWNED — TIER ${template.tier}

👹 ${template.name}
"${template.lore}"

❤️ HP: ${hp}
💰 Reward pool: ${template.reward} credits${effectStr}

Press 🐋 BOSS to join the raid!`
      );
    }, 0);

    return WORLD.boss;
  } catch (err) {
    console.error("❌ SPAWN BOSS ERROR:", err.message);
    return null;
  } finally {
    bossLock = false;
  }
}

// FIX O: save() inside checkBossTaunts deferred so it doesn't block
// the boss action handler before reply() fires.
function checkBossTaunts() {
  if (!WORLD.boss?.active) return;
  if (!Array.isArray(WORLD.boss.tauntsUsed)) WORLD.boss.tauntsUsed = [];
  const pct = Math.floor((WORLD.boss.hp / WORLD.boss.maxHp) * 100);
  for (const threshold of [66, 33, 10]) {
    if (pct <= threshold && !WORLD.boss.tauntsUsed.includes(threshold)) {
      WORLD.boss.tauntsUsed.push(threshold);
      const taunt = rand(BOSS_TAUNTS[threshold]);
      const phase = threshold <= 10 ? "FINAL" : threshold <= 33 ? "3" : "2";
      broadcastFire(`👹 ${WORLD.boss.name} — Phase ${phase}\n\n${taunt}`);
      // Defer save so it doesn't delay the calling handler's reply()
      setImmediate(() => save());
      break;
    }
  }
}

function damageBoss(userId, dmg) {
  if (!WORLD.boss?.active) return 0;
  if (!WORLD.boss.participants) WORLD.boss.participants = {};
  WORLD.boss.participants[userId] = (WORLD.boss.participants[userId] || 0) + dmg;
  WORLD.boss.hp = Math.max(0, WORLD.boss.hp - dmg);
  checkBossTaunts();
  if (WORLD.boss.hp > 0) { save(); return 0; }

  // Boss defeated
  WORLD.boss.active = false;
  const bossName = WORLD.boss.name;
  const reward   = WORLD.boss.reward || 100;
  const tier     = WORLD.boss.tier   || 1;
  const parts    = Object.keys(WORLD.boss.participants || {}).length;
  WORLD.boss     = null;
  WORLD.chaos    = clamp(WORLD.chaos - (tier * 3), 1, CONFIG.MAX_CHAOS);
  save();
  broadcastFire(
`🎉 WORLD BOSS DEFEATED!

👹 ${bossName} has fallen.
👥 ${parts} survivor${parts !== 1 ? "s" : ""} dealt the damage.
💰 All participants earn bonus loot!
🔥 Chaos recedes by ${tier * 3}

🌍 World effects from this boss have lifted.`
  );
  return reward;
}

/* =========================================================
   MENU & HOME
========================================================= */

function homeMenu() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("⚡ EVENT", "event"),       Markup.button.callback("⛏ MINE",  "mine")],
    [Markup.button.callback("🕶 CRIME", "crime"),       Markup.button.callback("⚔ WAR",   "war")],
    [Markup.button.callback("💻 HACK",  "hack"),        Markup.button.callback("🐋 BOSS",  "boss")],
    [Markup.button.callback("📊 PROFILE","profile"),    Markup.button.callback("🎒 INVENTORY","inventory")],
    [Markup.button.callback("🏪 MARKET","market"),      Markup.button.callback("🏆 LEADERBOARD","leaderboard")],
    [Markup.button.callback("🎁 DAILY", "daily"),       Markup.button.callback("♻️ REBIRTH","rebirth")]
  ]);
}

function homeText(u) {
  const dominant  = getDominantFaction();
  const energyBar = "█".repeat(Math.floor(u.energy / 10)) + "░".repeat(10 - Math.floor(u.energy / 10));
  const bossHint  = WORLD.boss?.active ? `\n⚔ BOSS EVENT: ${WORLD.boss.name} (HP: ${WORLD.boss.hp})` : "";
  let factionHint = "";
  if (dominant) {
    factionHint = "\n" + ({
      HODL:  "📈 HODL era: markets stable, miners profit",
      FOMO:  "🚀 FOMO era: war & events pay more",
      SCAM:  "🕶 SCAM era: crime & hacks boosted",
      WHALE: "🐋 WHALE era: all sectors slightly elevated"
    }[dominant] || "");
  }
  return `🌌 FOMO YODLVERSE

👤 ${u.name}
🧬 ${u.character || "UNSET"}
⚔ ${u.faction   || "UNSET"}

⭐ Level: ${level(u.xp)}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}/${CONFIG.MAX_HP}
⚡ Energy: ${u.energy}/${CONFIG.MAX_ENERGY} [${energyBar}]

🔥 Chaos: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}${bossHint}${factionHint}
${dominant ? `👑 Dominant: ${dominant}` : ""}`.trim();
}

async function home(ctx, u) {
  if (!u) return reply(ctx, "❌ User not found. Please restart with /start.");
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
  const session  = resolveSessionFromCtx(ctx);
  const canEnter = u.registered || !!session;
  if (!canEnter) {
    return reply(ctx, "🌌 FOMO YODLVERSE\n\nYou haven't started yet. Tap below to begin.",
      Markup.inlineKeyboard([[Markup.button.callback("🚀 START", "start_game")]]));
  }
  applyEnergyRegen(u);
  save();
  resetMessageCounter(u.id);
  return reply(ctx, homeText(u), homeMenu());
}

async function maybeResendMenu(ctx, user) {
  try {
    if (!isPrivateChat(ctx) || !user) return;
    if (user.dead) {
      if (tickMessageCounter(user.id)) { resetMessageCounter(user.id); await showDeadMenu(ctx, user); }
      return;
    }
    if (!user.registered) return;
    if (tickMessageCounter(user.id)) await reply(ctx, "🕹 Quick actions:", homeMenu());
  } catch (err) { console.error("❌ MENU RESEND ERROR:", err.message); }
}

/* =========================================================
   ONBOARDING FLOW
========================================================= */

async function startOnboarding(ctx, u) {
  u._entryIntent = "onboarding";
  save();
  return reply(ctx,
`🌌 WELCOME TO FOMO YODLVERSE

The Great Rugpull has destroyed civilization.
The blockchain is a warzone of factions, whales, and Sith Lords.

Your credits are all you have left.

Step 1 of 2: Choose your character.`,
    Markup.inlineKeyboard(CHARACTERS.map(c => [Markup.button.callback(c, "char_" + c)]))
  );
}

/* =========================================================
   ENTRY HANDLER (shared by /start, /game, start_game action)
========================================================= */

async function handleEntry(ctx) {
  const isPrivate = ctx.chat?.type === "private";

  if (!isPrivate) {
    const deepLink = hubPrivateLink(ctx.from.id, ctx);
    return reply(ctx,
      "🌌 FOMO YODLVERSE\n\nTap below to enter your private game session:",
      Markup.inlineKeyboard([[Markup.button.url("🎮 ENTER THE YODLVERSE", deepLink)]])
    );
  }

  const session = resolveSessionFromCtx(ctx);
  const u       = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) {
    await reply(ctx, `💀 Welcome back, ${u.name || "player"}. The Yodlverse remembers your end.`);
    return showDeadMenu(ctx, u);
  }

  if (!u.registered) {
    if (session) return startOnboarding(ctx, u);
    return reply(ctx,
`🌌 FOMO YODLVERSE

The Great Rugpull has destroyed civilization.
The blockchain is a warzone of factions, whales, and Sith Lords.

Your credits are all you have left.
Press START to enter the Yodlverse.`,
      Markup.inlineKeyboard([[Markup.button.callback("🚀 START", "start_game")]])
    );
  }

  await reply(ctx,
    `👋 Welcome back, ${u.name}.\n⚔ ${u.faction} | ⭐ Level ${level(u.xp)} | ❤️ ${u.hp} HP`
  );
  return home(ctx, u);
}

/* =========================================================
   POST-RESET SCREEN
========================================================= */

async function showPostResetScreen(ctx, name) {
  return reply(ctx,
`💥 CHARACTER DELETED

${name} has been erased from the Yodlverse.

You start fresh with ${CONFIG.START_CREDITS} credits.
Tap below to create your new character.`,
    Markup.inlineKeyboard([[Markup.button.callback("🚀 CREATE NEW CHARACTER", "start_game")]])
  );
}

/* =========================================================
   ITEM USE / SELL HELPERS
========================================================= */

async function useItem(ctx, user, idx) {
  if (isNaN(idx) || idx < 0 || idx >= user.inventory.length) {
    return reply(ctx, "❌ Item not found. Your inventory may have changed.");
  }
  const item = user.inventory[idx];
  if (!item || typeof item === "string") return reply(ctx, "❌ Cannot use this item.");
  const hpGain     = item.hpBonus     || 0;
  const energyGain = item.energyBonus || 0;
  if (hpGain === 0 && energyGain === 0) {
    return reply(ctx, `⚠️ ${item.name} has no usable effect. Try selling it instead.`);
  }
  user.hp     = clamp(user.hp     + hpGain,     0, CONFIG.MAX_HP);
  user.energy = clamp(user.energy + energyGain, 0, CONFIG.MAX_ENERGY);
  user.inventory.splice(idx, 1);
  save();
  return reply(ctx,
`✅ Used: ${item.name}

+${hpGain} HP  +${energyGain} Energy
❤️ HP: ${user.hp}/${CONFIG.MAX_HP}  ⚡ Energy: ${user.energy}/${CONFIG.MAX_ENERGY}`
  );
}

async function sellItem(ctx, user, idx) {
  if (isNaN(idx) || idx < 0 || idx >= user.inventory.length) {
    return reply(ctx, "❌ Item not found. Your inventory may have changed.");
  }
  const item = user.inventory[idx];
  if (!item || typeof item === "string") return reply(ctx, "❌ Cannot sell this item.");
  const value    = ITEM_SELL_VALUES[item.rarity] || 10;
  user.credits  += value;
  user.inventory.splice(idx, 1);
  save();
  return reply(ctx,
`💰 SOLD: ${item.name}

+${value} Credits
💰 Total Credits: ${user.credits}`
  );
}

/* =========================================================
   PROFILE TEXT
========================================================= */

function profileText(u) {
  const isDominant = u.faction === getDominantFaction();
  const wantedStr  = u.wantedLevel > 0 ? `🚨 WANTED Lv${u.wantedLevel}` : u.wanted ? "🚨 WANTED" : "Clean";
  const invPower   = u.inventory.reduce((s, i) => s + (i?.power || 0), 0);
  return `📊 PROFILE

👤 ${u.name}  (@${u.username || "—"})
🧬 ${u.character}
⚔ ${u.faction}${isDominant ? " 👑 (Dominant +10%)" : ""}

⭐ Level: ${level(u.xp)}  XP: ${u.xp}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}${u.dead ? " (DEAD)" : ""}
⚡ Energy: ${u.energy}

🏆 Wins: ${u.wins}  💀 Losses: ${u.losses}
🌟 Reputation: ${u.reputation}
👑 Prestige: ${u.prestige}
⚔ War Streak: ${u.warStreak || 0}

⛏ Mining Lv: ${u.miningLevel}
💻 Hacking Lv: ${u.hackingLevel}
🏠 ${u.apartment}
🚀 ${u.ship}
${wantedStr}
🎒 Items: ${u.inventory.length}  ⚡ Inv Power: ${invPower}`;
}

/* =========================================================
   LEADERBOARD TEXT
========================================================= */

function leaderboardText() {
  const top = Object.values(DB).sort((a, b) => b.xp - a.xp).slice(0, 10);
  let msg   = "🏆 LEADERBOARD\n\n";
  top.forEach((u, i) => {
    const dead     = u.dead      ? " 💀" : "";
    const prestige = u.prestige > 0 ? ` ♻️${u.prestige}` : "";
    msg += `${i + 1}. ${u.name}${dead}${prestige}  ⭐${level(u.xp)}  ${u.xp} XP\n`;
  });
  msg += "\n⚔ FACTION POWER\n\n";
  Object.entries(WORLD.factions).sort((a, b) => b[1] - a[1]).forEach(([f, p]) => { msg += `${f}: ${p}\n`; });
  const dominant = getDominantFaction();
  if (dominant) msg += `\n👑 Dominant: ${dominant}\n(+10% rewards for ${dominant} members)`;
  msg += `\n\n🔥 Chaos: ${WORLD.chaos}`;
  msg += `\n🌍 Market: ${WORLD.marketState}`;
  if (WORLD.boss?.active) msg += `\n🐋 Boss Active: ${WORLD.boss.name} HP:${WORLD.boss.hp}`;
  return msg;
}

/* =========================================================
   INVENTORY PAGER
========================================================= */

const INV_PAGE_SIZE = 10;

function inventoryPage(u, page = 0) {
  if (!u.inventory.length) {
    return { text: "🎒 INVENTORY — Empty\n\nGo fight, mine, commit crimes, hack, or raid bosses to earn items!", keyboard: null };
  }
  const totalPages = Math.ceil(u.inventory.length / INV_PAGE_SIZE);
  const start      = page * INV_PAGE_SIZE;
  const pageItems  = u.inventory.slice(start, start + INV_PAGE_SIZE);
  const totalPower = u.inventory.reduce((s, i) => s + (i?.power || 0), 0);

  let msg = `🎒 INVENTORY (${u.inventory.length} items | ⚡ Total Power: ${totalPower})\n`;
  if (totalPages > 1) msg += `Page ${page + 1}/${totalPages}\n`;
  msg += "\n";

  const rows = [];
  pageItems.forEach((item, i) => {
    const realIdx = start + i;
    if (typeof item === "string") { msg += `${realIdx + 1}. ${item}\n`; return; }
    const name    = item?.name   || "Unknown";
    const rarity  = item?.rarity || "common";
    const power   = item?.power  || 0;
    const hp      = item?.hpBonus     || 0;
    const en      = item?.energyBonus || 0;
    const star    = ITEM_RARITY_STARS[rarity] || "⚪";
    const sellVal = ITEM_SELL_VALUES[rarity]  || 10;
    msg += `${realIdx + 1}. ${star} ${name}\n   ${rarity} | PWR ${power} | +${hp}HP +${en}⚡ | 💰${sellVal}cr\n`;
    rows.push([
      Markup.button.callback(`✅ USE #${realIdx + 1}`,  `inv_use_${realIdx}`),
      Markup.button.callback(`💰 SELL #${realIdx + 1}`, `inv_sell_${realIdx}`)
    ]);
  });

  const navRow = [];
  if (page > 0)               navRow.push(Markup.button.callback("◀ PREV", `inv_page_${page - 1}`));
  if (page < totalPages - 1)  navRow.push(Markup.button.callback("▶ NEXT", `inv_page_${page + 1}`));
  if (navRow.length) rows.push(navRow);

  return { text: msg.trim(), keyboard: Markup.inlineKeyboard(rows) };
}

/* =========================================================
   ===================== COMMAND HANDLERS ==================
========================================================= */

bot.start(async (ctx) => { await handleEntry(ctx); });
bot.command("game", async (ctx) => { await handleEntry(ctx); });

bot.command("menu", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
  return home(ctx, u);
});

bot.command("status", (ctx) => {
  return reply(ctx,
`🌌 SERVER STATUS

👥 Players: ${Object.keys(DB).length}
🔥 Chaos: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}
🐋 Boss: ${WORLD.boss?.active ? `${WORLD.boss.name} HP:${WORLD.boss.hp}` : "NONE"}
👑 Dominant Faction: ${getDominantFaction() || "None"}
🌍 Boss World Effects: ${bossWorldLine() || "None"}
💾 Save: ${dirty ? "PENDING" : "SYNCED"}`
  );
});

bot.command("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  return reply(ctx, profileText(u));
});

bot.command("leaderboard", (ctx) => reply(ctx, leaderboardText()));
bot.command("top",         (ctx) => reply(ctx, leaderboardText()));

bot.command("bulletin", (ctx) => {
  if (!Array.isArray(WORLD.bulletin) || !WORLD.bulletin.length) {
    return reply(ctx, "📋 BULLETIN BOARD\n\nNo entries yet.");
  }
  let msg = "📋 BULLETIN BOARD\n\n";
  WORLD.bulletin.slice(0, 5).forEach(e => {
    const age = Math.floor((now() - e.ts) / 60000);
    msg += `• ${e.text} (${age}m ago)\n`;
  });
  return reply(ctx, msg);
});

bot.command("respawn", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!isDead(u)) return reply(ctx, "✅ You are not dead.\n\nNo need to respawn — you are still in the Yodlverse.");
  return reply(ctx,
`⚠️ RESPAWN — FULL RESET

This will DELETE your character permanently:
• All XP, credits, items, reputation lost
• Return to starting state (${CONFIG.START_CREDITS} credits, no faction)

♻️ REBIRTH is available for a softer revival (keeps 25% XP + prestige).

Are you sure you want to full reset?`,
    Markup.inlineKeyboard([[
      Markup.button.callback("💀 YES — DELETE EVERYTHING", "confirm_hardreset"),
      Markup.button.callback("❌ NO — GO BACK",            "cancel_hardreset")
    ]])
  );
});

bot.command("use", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!u.registered) return reply(ctx, "❌ Not registered.");
  const idx = parseInt((ctx.message.text.split(" ")[1] || "")) - 1;
  if (isNaN(idx)) return reply(ctx, "❌ Invalid item number.\n\nUse 🎒 INVENTORY to see your items.");
  return useItem(ctx, u, idx);
});

bot.command("sell", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!u.registered) return reply(ctx, "❌ Not registered.");
  const idx = parseInt((ctx.message.text.split(" ")[1] || "")) - 1;
  if (isNaN(idx)) return reply(ctx, "❌ Invalid item number.\n\nUse 🎒 INVENTORY to see your items.");
  return sellItem(ctx, u, idx);
});

/* =========================================================
   ADMIN COMMANDS
========================================================= */

bot.command("broadcast", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const msg = ctx.message.text.replace("/broadcast", "").trim();
  if (!msg) return reply(ctx, "Usage: /broadcast message");
  broadcastFire(`📢 ADMIN ALERT\n\n${msg}`);
  return reply(ctx, "✅ Broadcast queued");
});

bot.command("spawnboss", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  spawnBoss();
  return reply(ctx, "🐋 Boss spawn initiated");
});

bot.command("chaos", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const amount = parseInt(ctx.message.text.split(" ")[1]);
  if (isNaN(amount)) return reply(ctx, "Usage: /chaos number");
  WORLD.chaos = clamp(amount, 1, CONFIG.MAX_CHAOS);
  save();
  return reply(ctx, `🔥 Chaos set to ${amount}`);
});

bot.command("givecredits", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const parts  = ctx.message.text.split(" ");
  const target = parts[1];
  const amount = parseInt(parts[2]);
  if (!target || isNaN(amount)) return reply(ctx, "Usage: /givecredits <userId> <amount>");
  const u = DB[target];
  if (!u) return reply(ctx, "❌ User not found");
  u.credits += amount;
  save();
  return reply(ctx, `✅ Gave ${amount} credits to ${u.name}`);
});

bot.command("resetwanted", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  const target = ctx.message.text.split(" ")[1];
  const u      = DB[target];
  if (!u) return reply(ctx, "❌ User not found");
  u.wanted = false; u.wantedLevel = 0;
  save();
  return reply(ctx, `✅ Cleared wanted status for ${u.name}`);
});

// FIX Q: await forceSave() so the reply fires after save completes
bot.command("forcesave", async (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  dirty = true;
  await forceSave();
  return reply(ctx, "💾 Force save complete");
});

/* =========================================================
   =================== ACTION HANDLERS ====================
========================================================= */

bot.action("start_game", async (ctx) => {
  await ack(ctx);
  if (!isPrivateChat(ctx)) return;
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
  if (!u.registered) return startOnboarding(ctx, u);
  return home(ctx, u);
});

bot.action(/char_(.+)/, async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
  if (u._entryIntent !== "onboarding" && !requireRegistered(u, ctx)) return;
  u.character = ctx.match[1];
  save();
  return reply(ctx,
`⚔ Step 2 of 2: Choose Your Faction

HODL → Stability & mining bonuses
FOMO → War & event bonuses
SCAM → Crime & hacking bonuses
WHALE → Balanced bonuses across all`,
    Markup.inlineKeyboard(FACTIONS.map(f => [Markup.button.callback(f, "faction_" + f)]))
  );
});

// FIX N: reply() and home() now fire BEFORE broadcastFire/addBulletin
// so side-effects never delay the handler's response to Telegram.
bot.action(/faction_(.+)/, async (ctx) => {
  await ack(ctx);
  const faction = ctx.match[1];
  if (!FACTIONS.includes(faction)) return;
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
  if (u._entryIntent !== "onboarding" && !requireRegistered(u, ctx)) return;
  u.faction      = faction;
  u.registered   = true;
  u._entryIntent = null;
  save();
  await reply(ctx,
`✅ Character created!

🧬 ${u.character}
⚔ Faction: ${u.faction}

You start with ${CONFIG.START_CREDITS} credits.
May the blockchain be with you.`
  );
  await home(ctx, u);
  // Defer broadcast and bulletin so they never block the reply above
  setImmediate(() => {
    broadcastFire(`🌌 ${u.name} joined faction ${u.faction}`);
    addBulletin(`${u.name} joined faction ${u.faction}`);
  });
});

bot.action("profile", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  await reply(ctx, profileText(u));
  await maybeResendMenu(ctx, u);
});

bot.action("leaderboard", async (ctx) => {
  await ack(ctx);
  await reply(ctx, leaderboardText());
  const u = getUser(ctx.from.id, ctx);
  await maybeResendMenu(ctx, u);
});

/* =========================================================
   DEATH / REBIRTH / RESPAWN ACTIONS
========================================================= */

bot.action("rebirth", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!u) return;
  if (!u.dead) return reply(ctx, "⚠️ You are still alive. Rebirth is only available after elimination.");

  const revived = rebirthPlayer(u);
  if (!revived) {
    const seconds = Math.max(0, Math.ceil(
      (REBIRTH_CONFIG.rebirthCooldown - (now() - (u.deathTime || now()))) / 1000
    ));
    return reply(ctx,
`⏳ Rebirth not ready yet.

Try again in ${seconds}s

While you wait:
• The Yodlverse continues without you
• Bosses are roaming
• Faction wars escalate`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🔄 Check Again",     "rebirth")],
        [Markup.button.callback("💥 RESPAWN (RESET)", "respawn_confirm_prompt")]
      ])
    );
  }

  save();
  await reply(ctx,
`♻️ REBIRTH COMPLETE

You have returned to the Yodlverse.
Prestige: ${u.prestige} | XP retained: ${u.xp}

_YODEL-BOT: "The chain welcomes you back. It will destroy you again shortly."_`
  );
  return home(ctx, u);
});

bot.action("respawn_confirm_prompt", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!isDead(u)) return reply(ctx, "✅ You are not dead. No reset needed.");
  return reply(ctx,
`⚠️ RESPAWN — FULL RESET

This will DELETE your character permanently:
• All XP, credits, items, reputation lost
• Return to starting state (${CONFIG.START_CREDITS} credits, no faction)

♻️ REBIRTH is available for a softer revival (keeps 25% XP + prestige).

Are you sure?`,
    Markup.inlineKeyboard([[
      Markup.button.callback("💀 YES — DELETE EVERYTHING", "confirm_hardreset"),
      Markup.button.callback("❌ NO — REBIRTH INSTEAD",    "cancel_hardreset")
    ]])
  );
});

bot.action("confirm_hardreset", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!isDead(u)) return reply(ctx, "✅ You are not dead. No reset needed.");
  const name = u.name;
  hardResetPlayer(u);
  return showPostResetScreen(ctx, name);
});

bot.action("cancel_hardreset", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (isDead(u)) return showDeadMenu(ctx, u);
  return reply(ctx, "✅ Reset cancelled.");
});

/* =========================================================
   EVENT
========================================================= */

bot.action("event", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;
  if (!cooldownOk(u, "event")) return reply(ctx, "⏳ Event cooldown active");
  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.event, ctx)) return;

  const e            = rand(EVENTS);
  const factionBonus = FACTION_BONUSES[u.faction]?.eventBonus || 0;
  const domBonus     = getDominanceBonus(u.faction);
  const repDiscount  = Math.min(0.10, u.reputation * 0.005);
  const cappedBonus  = softCapMultiplier(factionBonus + domBonus);
  const risk         = Math.min(0.90, e.risk + WORLD.chaos * 0.012 - cappedBonus * 0.5 - repDiscount);

  if (Math.random() < risk) {
    const loss = 15 + Math.floor(Math.random() * 30);
    const dmg  = 12 + Math.floor(Math.random() * 18);
    u.credits  = clamp(u.credits - loss, 0, 999999);
    u.hp       = Math.max(0, u.hp - dmg);
    u.losses   = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    addChaos(1); save();
    if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
    await reply(ctx,
`💥 EVENT FAILED

${e.title}
-${loss} Credits  -${dmg} HP
⚡ Energy: ${u.energy}

🔥 Chaos increased${contextualYodelBot(u, false)}`
    );
    return maybeResendMenu(ctx, u);
  }

  const mktMult  = WORLD.marketState === "bullish" ? 1.25 : WORLD.marketState === "crashing" ? 0.75 : 1.0;
  const xpGain   = Math.floor(e.xp      * (1 + cappedBonus));
  const credGain = Math.floor(e.credits * mktMult * (1 + cappedBonus));
  u.xp      += xpGain;
  u.credits += credGain;
  u.wins     = (u.wins || 0) + 1;
  addFactionPower(u.faction, xpGain);
  addChaos(e.chaos);
  const drop = tryDrop(u, "event");
  save();

  await reply(ctx,
`⚡ ${e.title}

${e.text}
+${xpGain} XP  +${credGain} Credits
⚡ Energy: ${u.energy}
🔥 Chaos: ${WORLD.chaos}${getFactionFlavour(u.faction)}${drop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   MINE
========================================================= */

bot.action("mine", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;
  if (!cooldownOk(u, "mine")) return reply(ctx, "⏳ Mining cooldown active");
  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.mine, ctx)) return;

  const caveInRisk = Math.max(0.02, 0.12 + WORLD.chaos * 0.005 - u.miningLevel * 0.01);
  if (Math.random() < caveInRisk) {
    const dmg = 10 + Math.floor(Math.random() * 15);
    u.hp      = Math.max(0, u.hp - dmg);
    u.losses  = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    save();
    if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
    await reply(ctx,
`⛏ CAVE-IN!

The tunnel collapsed. -${dmg} HP

HP: ${u.hp}/${CONFIG.MAX_HP}
⚡ Energy: ${u.energy}${contextualYodelBot(u, false)}`
    );
    return maybeResendMenu(ctx, u);
  }

  const bossMods     = getBossWorldModifiers();
  const factionBonus = FACTION_BONUSES[u.faction]?.mineBonus || 0;
  const cappedBonus  = softCapMultiplier(factionBonus + (u.prestige * 0.05) + getDominanceBonus(u.faction));
  const mktMult      = WORLD.marketState === "bullish" ? 1.2 : WORLD.marketState === "crashing" ? 0.8 : 1.0;
  const levelScale   = u.miningLevel + Math.floor(u.miningLevel * u.miningLevel * 0.1);
  const gain         = Math.floor(
    (15 + Math.floor(Math.random() * 35) + levelScale * 4) * mktMult * (1 - bossMods.mineDebuff) * (1 + cappedBonus)
  );

  u.credits += gain;
  u.xp      += 5 + u.miningLevel;
  const drop     = tryDrop(u, "mine");
  const bossLine = bossMods.mineDebuff > 0 ? `\n⚠️ Boss suppressing yields (${Math.round(bossMods.mineDebuff * 100)}% debuff)` : "";
  save();

  await reply(ctx,
`⛏ Mining Operation Successful

+${gain} Credits  +${5 + u.miningLevel} XP
⛏ Mining Level: ${u.miningLevel}
⚡ Energy: ${u.energy}${factionBonus > 0 ? "\n📈 HODL Bonus applied" : ""}${bossLine}${getFactionFlavour(u.faction)}${drop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   CRIME
========================================================= */

bot.action("crime", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;
  if (!cooldownOk(u, "crime")) return reply(ctx, "⏳ Crime cooldown active");
  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.crime, ctx)) return;

  const factionBonus = FACTION_BONUSES[u.faction]?.crimeBonus || 0;
  const cappedBonus  = softCapMultiplier(factionBonus + getDominanceBonus(u.faction));
  const repDiscount  = Math.min(0.15, u.reputation * 0.008);
  const wantedRisk   = (u.wantedLevel || 0) * 0.05;
  const failChance   = Math.max(0.10, 0.48 - cappedBonus - repDiscount + wantedRisk);

  if (Math.random() < failChance) {
    const loss = 20 + Math.floor(Math.random() * 40);
    const dmg  = 15 + Math.floor(Math.random() * 20);
    u.credits  = clamp(u.credits - loss, 0, 999999);
    u.hp       = Math.max(0, u.hp - dmg);
    u.wanted   = true;
    u.wantedLevel = Math.min(3, (u.wantedLevel || 0) + 1);
    u.losses   = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    save();
    if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
    await reply(ctx,
`🚔 CRIME FAILED

-${loss} Credits  -${dmg} HP
⚡ Energy: ${u.energy}
🚨 Wanted Level: ${u.wantedLevel}${contextualYodelBot(u, false)}`
    );
    return maybeResendMenu(ctx, u);
  }

  const bossMods    = getBossWorldModifiers();
  const wantedBonus = 1 + (u.wantedLevel || 0) * 0.20;
  const mktMult     = WORLD.marketState === "bullish" ? 1.15 : 1.0;
  const gain        = Math.floor(
    (45 + Math.floor(Math.random() * 95)) * wantedBonus * mktMult * (1 + bossMods.crimeBoost) * (1 + cappedBonus)
  );
  const repGain     = 1 + (u.wantedLevel || 0);

  u.credits    += gain;
  u.reputation += repGain;
  u.wins        = (u.wins || 0) + 1;
  if (u.wantedLevel > 0) { u.wantedLevel -= 1; if (u.wantedLevel === 0) u.wanted = false; }
  addChaos(1);
  const drop     = tryDrop(u, "crime");
  const bossLine = bossMods.crimeBoost > 0 ? "\n🔥 Boss chaos boosted crime profits!" : "";
  save();

  await reply(ctx,
`🕶 BLACK MARKET SUCCESS

+${gain} Credits  +${repGain} Reputation
⚡ Energy: ${u.energy}
🌟 Total Rep: ${u.reputation}${wantedBonus > 1 ? "\n⚡ Wanted bonus applied!" : ""}${bossLine}${getFactionFlavour(u.faction)}${drop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   WAR
========================================================= */

bot.action("war", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;
  if (!cooldownOk(u, "war", 8000)) return reply(ctx, "⏳ War cooldown active");
  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.war, ctx)) return;

  const cappedBonus  = softCapMultiplier(
    (FACTION_BONUSES[u.faction]?.warBonus || 0) + (u.prestige * 0.03) + getDominanceBonus(u.faction)
  );
  const chaosRisk  = 1 + WORLD.chaos * 0.008;
  const streakMult = 1 + Math.min(5, u.warStreak || 0) * 0.10;
  const isElite    = Math.random() < 0.05;

  const baseReward = isElite ? 80 + Math.floor(Math.random() * 120) : 20 + Math.floor(Math.random() * 50);
  const reward     = Math.floor(baseReward * streakMult * (1 + cappedBonus));
  const damage     = Math.floor((isElite ? 25 : 10) + Math.floor(Math.random() * (isElite ? 35 : 20))) * chaosRisk;

  u.xp = u.xp + reward;
  u.hp = Math.max(0, u.hp - damage);

  if (u.hp <= 0) {
    u.dead = true; u.deathTime = now();
    u.warStreak = 0; u.losses = (u.losses || 0) + 1;
    addFactionPower(u.faction, Math.floor(reward * 0.5));
    addChaos(2);
    tryDrop(u, "war");
    save();
    return showDeadMenu(ctx, u);
  }

  u.warStreak = (u.warStreak || 0) + 1;
  u.wins      = (u.wins || 0) + 1;
  addFactionPower(u.faction, reward);
  addChaos(2);

  const drop      = tryDrop(u, "war");
  const eliteDrop = isElite ? tryDrop(u, "boss") : "";
  save();

  await reply(ctx,
`⚔ FACTION CONFLICT${isElite ? " — ELITE" : ""}

${u.name} fought for ${u.faction}
+${reward} XP  -${damage} HP
⚡ Energy: ${u.energy}
🔥 Chaos: ${WORLD.chaos}${isElite ? "\n⚠️ ELITE ENCOUNTER — bonus XP and loot!" : ""}${u.warStreak > 1 ? `\n🔥 War Streak: ${u.warStreak}x (+${Math.round((streakMult - 1) * 100)}% XP)` : ""}${getFactionFlavour(u.faction)}${drop}${eliteDrop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   HACK
========================================================= */

bot.action("hack", async (ctx) => {
  await ack(ctx);
  if (!requirePrivate(ctx)) return;
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;
  if (!cooldownOk(u, "hack", 9000)) return reply(ctx, "⏳ Hacking cooldown active");
  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.hack, ctx)) return;

  const available = HACK_TARGETS.filter(t => t.hackReq <= u.hackingLevel);
  if (!available.length) return reply(ctx, "❌ No available targets for your hacking level.");

  const target      = Math.random() < 0.6 ? available[available.length - 1] : rand(available);
  const cappedBonus = softCapMultiplier(
    (FACTION_BONUSES[u.faction]?.hackBonus || 0) + getDominanceBonus(u.faction)
  );
  const repDiscount = Math.min(0.12, u.reputation * 0.006);
  const risk        = Math.max(0.10, target.risk - cappedBonus - repDiscount + WORLD.chaos * 0.004);

  if (Math.random() < risk) {
    const dmg  = 10 + Math.floor(Math.random() * 20);
    const loss = 10 + Math.floor(Math.random() * 30);
    u.hp       = Math.max(0, u.hp - dmg);
    u.credits  = clamp(u.credits - loss, 0, 999999);
    u.losses   = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    addChaos(1); save();
    if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);
    await reply(ctx,
`🚫 HACK FAILED — ${target.name}

Intrusion detected. Counterattack incoming.
-${dmg} HP  -${loss} Credits
⚡ Energy: ${u.energy}
🔥 Chaos ticked up${contextualYodelBot(u, false)}`
    );
    return maybeResendMenu(ctx, u);
  }

  const mktMult  = WORLD.marketState === "bullish" ? 1.15 : 1.0;
  const xpGain   = Math.floor(target.xp      * (1 + cappedBonus));
  const credGain = Math.floor(target.credits * mktMult * (1 + cappedBonus));
  u.xp         += xpGain;
  u.credits    += credGain;
  u.reputation += 1;
  u.wins        = (u.wins || 0) + 1;
  addFactionPower(u.faction, xpGain);
  addChaos(target.chaos);
  const drop = tryDrop(u, "hack");
  save();

  await reply(ctx,
`💻 HACK SUCCESSFUL — ${target.name}

+${xpGain} XP  +${credGain} Credits  +1 Rep
💻 Hacking Level: ${u.hackingLevel}
⚡ Energy: ${u.energy}
🔥 Chaos: ${WORLD.chaos}${getFactionFlavour(u.faction)}${drop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   BOSS
========================================================= */

bot.action("boss", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx, { applyRegen: true });
  if (!u) return;

  if (!WORLD.boss?.active) {
    const spawned = spawnBoss();
    if (!spawned) return reply(ctx, "⚠️ No boss available right now. The Yodlverse is peaceful... temporarily.\n\nTry again in a moment.");
  }
  if (!WORLD.boss?.active) return reply(ctx, "⚠️ Boss event not active right now. Check back soon!");

  if (!spendEnergy(u, CONFIG.ENERGY_COSTS.boss, ctx)) return;

  const tier              = WORLD.boss.tier || 1;
  const dmg               = 25 + Math.floor(Math.random() * 50) + (level(u.xp) * 2);
  const damage            = (8  + Math.floor(Math.random() * 10)) * tier;
  const bossNameSnapshot  = WORLD.boss.name;

  u.bossHits = (u.bossHits || 0) + dmg;
  const bossReward = damageBoss(String(u.id), dmg);

  u.xp += 10 + tier * 5;
  u.hp  = Math.max(0, u.hp - damage);
  if (bossReward > 0) { u.credits += bossReward; u.bossHits = 0; }

  if (u.hp <= 0) {
    u.dead = true; u.deathTime = now();
    save();
    return showDeadMenu(ctx, u);
  }

  u.wins = (u.wins || 0) + 1;
  const drop     = tryDrop(u, "boss");
  const remaining = WORLD.boss?.hp ?? 0;
  const pct       = WORLD.boss ? Math.round((remaining / (WORLD.boss.maxHp ?? 1)) * 100) : 0;
  const bossLine  = WORLD.boss
    ? `❤️ Boss HP: ${remaining} (${pct}%)`
    : `💥 BOSS DEFEATED! +${bossReward} bonus credits`;
  save();

  await reply(ctx,
`🐋 RAID ATTACK — ${bossNameSnapshot}

💥 Damage dealt: ${dmg}
-${damage} HP received
⚡ Energy: ${u.energy}
${bossLine}${drop}${contextualYodelBot(u, true)}`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   INVENTORY
   FIX P: guardAction() added to inv_use, inv_sell, inv_page
   so dead/unregistered users always get a response instead
   of silently hanging.
========================================================= */

bot.action("inventory", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const { text, keyboard } = inventoryPage(u, 0);
  await reply(ctx, text, keyboard || {});
  return maybeResendMenu(ctx, u);
});

bot.action(/inv_page_(\d+)/, async (ctx) => {
  await ack(ctx);
  const u    = await guardAction(ctx);
  if (!u) return;
  const page = parseInt(ctx.match[1]);
  if (isNaN(page)) return;
  const { text, keyboard } = inventoryPage(u, page);
  return reply(ctx, text, keyboard || {});
});

bot.action(/inv_use_(\d+)/, async (ctx) => {
  await ack(ctx);
  const u   = await guardAction(ctx);
  if (!u) return;
  const idx = parseInt(ctx.match[1]);
  return useItem(ctx, u, idx);
});

bot.action(/inv_sell_(\d+)/, async (ctx) => {
  await ack(ctx);
  const u   = await guardAction(ctx);
  if (!u) return;
  const idx = parseInt(ctx.match[1]);
  return sellItem(ctx, u, idx);
});

/* =========================================================
   MARKET
========================================================= */

bot.action("market", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;

  const energyPrice  = marketPrice(50);
  const armorPrice   = marketPrice(100);
  const drillPrice   = marketPrice(250);
  const cyberdeckPrc = marketPrice(200);
  const homePrice    = marketPrice(500);
  const dominant     = getDominantFaction();
  const marketComment = dominant ? rand(FACTION_FLAVOUR[dominant] || []) : "";

  await reply(ctx,
`🏪 BLACK MARKET

Market: ${WORLD.marketState.toUpperCase()} 🔥 Chaos: ${WORLD.chaos}
${marketComment ? `\n_${marketComment}_\n` : ""}
⚡ Energy Cell       — ${energyPrice} credits
🛡 Nano Armor        — ${armorPrice} credits
⛏ Quantum Drill     — ${drillPrice} credits
💻 Cyberdeck Upgrade — ${cyberdeckPrc} credits
🏠 Luxury Apartment  — ${homePrice} credits

⚠️ Prices fluctuate with market state and chaos.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Buy Energy",    "buy_energy")],
      [Markup.button.callback("🛡 Buy Armor",     "buy_armor")],
      [Markup.button.callback("⛏ Buy Drill",      "buy_drill")],
      [Markup.button.callback("💻 Buy Cyberdeck", "buy_cyberdeck")],
      [Markup.button.callback("🏠 Buy Apartment", "buy_home")]
    ])
  );
  return maybeResendMenu(ctx, u);
});

bot.action("buy_energy", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const price = marketPrice(50);
  if (u.credits < price) return reply(ctx, `❌ Not enough credits (need ${price})`);
  u.credits -= price;
  u.energy   = clamp(u.energy + 25, 0, CONFIG.MAX_ENERGY);
  save();
  return reply(ctx, `⚡ Energy restored to ${u.energy}/${CONFIG.MAX_ENERGY}`);
});

bot.action("buy_armor", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const price = marketPrice(100);
  if (u.credits < price) return reply(ctx, `❌ Not enough credits (need ${price})`);
  u.credits -= price;
  u.hp       = clamp(u.hp + 25, 0, CONFIG.MAX_HP);
  save();
  return reply(ctx, `🛡 Nano Armor equipped — HP: ${u.hp}/${CONFIG.MAX_HP}`);
});

bot.action("buy_drill", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const price = marketPrice(250);
  if (u.credits < price) return reply(ctx, `❌ Not enough credits (need ${price})`);
  u.credits     -= price;
  u.miningLevel += 1;
  save();
  return reply(ctx, `⛏ Mining upgraded to Level ${u.miningLevel}`);
});

bot.action("buy_cyberdeck", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const price = marketPrice(200);
  if (u.credits < price) return reply(ctx, `❌ Not enough credits (need ${price})`);
  u.credits      -= price;
  u.hackingLevel += 1;
  save();
  return reply(ctx, `💻 Hacking upgraded to Level ${u.hackingLevel}\n\nNew targets unlocked — use 💻 HACK`);
});

bot.action("buy_home", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;
  const price = marketPrice(500);
  if (u.credits < price) return reply(ctx, `❌ Not enough credits (need ${price})`);
  u.credits   -= price;
  u.apartment  = "Luxury Sky Apartment";
  save();
  return reply(ctx, "🏠 Apartment upgraded to Luxury Sky Apartment");
});

/* =========================================================
   DAILY
========================================================= */

bot.action("daily", async (ctx) => {
  await ack(ctx);
  const u = await guardAction(ctx);
  if (!u) return;

  if (now() - u.lastDaily < CONFIG.DAILY_COOLDOWN) {
    const remaining = Math.ceil((CONFIG.DAILY_COOLDOWN - (now() - u.lastDaily)) / 3600000);
    return reply(ctx, `⏳ Daily already claimed.\n\nCome back in ~${remaining}h`);
  }

  const today   = new Date().toISOString().slice(0, 10);
  const dayDiff = u.lastDailyDate ? Math.floor((now() - u.lastDaily) / 86400000) : 999;

  u.dailyStreak   = dayDiff <= 2 ? (u.dailyStreak || 0) + 1 : 1;
  u.lastDailyDate = today;
  u.lastDaily     = now();

  const streak      = u.dailyStreak || 1;
  const streakBonus = Math.min(5, streak - 1);
  const prestigeInc = u.prestige * 15;

  const credGain = 100 + streakBonus * 20 + prestigeInc;
  const xpGain   = 25  + streakBonus * 10;
  const hpGain   = 20  + u.prestige  * 5;

  u.credits += credGain;
  u.xp      += xpGain;
  u.hp       = clamp(u.hp + hpGain, 0, CONFIG.MAX_HP);
  u.energy   = clamp(u.energy + 10, 0, CONFIG.MAX_ENERGY);

  const worldHint = WORLD.boss?.active
    ? `\n⚠️ Active boss: ${WORLD.boss.name} — join the raid!`
    : WORLD.chaos >= 50
    ? "\n🔥 High chaos detected — risky but rewarding out there"
    : "";

  save();
  await reply(ctx,
`🎁 DAILY REWARD

+${credGain} Credits
+${xpGain} XP
+${hpGain} HP
+10 Energy restored${streak > 1 ? `\n🔥 Streak: Day ${streak} (+${streakBonus * 20} credits)` : ""}${u.prestige > 0 ? `\n👑 Prestige Bonus: +${prestigeInc} credits` : ""}${worldHint}

Come back tomorrow to keep your streak!`
  );
  return maybeResendMenu(ctx, u);
});

/* =========================================================
   FALLBACK MESSAGE HANDLER
========================================================= */

bot.on("message", async (ctx) => {
  if (!ctx.from) return;
  const text      = ctx.message?.text || "";
  const isPrivate = ctx.chat?.type === "private";

  if (!isPrivate) {
    const isGameCommand = text === "/game" || text.startsWith("/game@");
    if (!isGameCommand) return;
    const deepLink = hubPrivateLink(ctx.from.id, ctx);
    return reply(ctx,
      "🌌 FOMO YODLVERSE\n\nTap below to enter your private game session:",
      Markup.inlineKeyboard([[Markup.button.url("🎮 ENTER THE YODLVERSE", deepLink)]])
    );
  }

  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return showDeadMenu(ctx, u);

  if (!text.startsWith("/game") && !text.startsWith("/start")) {
    await reply(ctx,
      "🌌 FOMO YODLVERSE\n\nUse /start or /game to enter.",
      Markup.inlineKeyboard([[Markup.button.callback("🚀 START", "start_game")]])
    );
    if (u.registered && tickMessageCounter(u.id)) {
      await reply(ctx, "🕹 Quick actions:", homeMenu());
    }
  }
});

/* =========================================================
   WORLD TICK — RANDOM EVENTS
========================================================= */

let worldEventLock = false;

setInterval(() => {
  if (worldEventLock) return;
  if (Math.random() > 0.90) {
    worldEventLock = true;
    addChaos(1);
    const dominant     = getDominantFaction();
    const factionEvent = dominant ? rand([
      `👑 ${dominant} faction tightens its grip on the chain.`,
      `⚔ ${dominant} operatives spotted across all sectors.`,
      `📊 ${dominant} dominance reshaping market conditions.`
    ]) : null;
    const eventMsg = factionEvent || rand([
      "🌌 Market instability detected.",
      "📉 A major token collapsed.",
      "🐋 Whale fleets moving through sectors.",
      "⚠ Illegal mining activity rising.",
      "💀 Shadow hackers breached the chain.",
      "🔥 Flash crash detected. Chaos rising.",
      "🛸 Unknown entity entered the Yodlverse.",
      "⚡ Power grid fluctuations detected across sectors.",
      "🔐 Anonymous hacker leaked exchange wallet keys.",
      "🧬 Faction insurgents spotted at the border."
    ]);
    broadcastFire(eventMsg);
    addBulletin(eventMsg);
    setTimeout(() => { worldEventLock = false; }, 30_000);
  }
}, 120_000);

setInterval(() => {
  if      (WORLD.chaos >= 80) WORLD.marketState = "crashing";
  else if (WORLD.chaos >= 50) WORLD.marketState = "volatile";
  else if (WORLD.chaos >= 25) WORLD.marketState = rand(["stable", "volatile"]);
  else                        WORLD.marketState = rand(["stable", "bullish"]);
  save();
}, 300_000);

setInterval(() => {
  if (WORLD.chaos > 5) { WORLD.chaos = Math.max(5, WORLD.chaos - 1); save(); }
}, 600_000);

/* =========================================================
   LAUNCH
========================================================= */

console.log("➡️ Launch call executed");
bot.launch()
  .then(() => console.log("🌌 FOMO YODLVERSE ONLINE"))
  .catch(err => console.error("❌ Launch error:", err));
