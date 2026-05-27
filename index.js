/**
 * =========================================================
 * 🌌 FOMO YODELVERSE — ULTIMATE HUB EDITION v2
 * =========================================================
 *
 * INCLUDED:
 * - Stable debug engine
 * - Telegram topic/forum support
 * - Private hub sessions
 * - Session persistence + validation + cleanup + security
 * - Deep-link gameplay (group → private bot)
 * - Welcome-back message for returning users
 * - Full market system
 * - Daily rewards
 * - Admin commands
 * - Boss raids (expanded roster, tiered difficulty)
 * - World chaos engine + market shifts
 * - Inventory drops from ALL activities
 * - Safe atomic persistence
 * - Cooldowns + antispam
 * - Broadcast system
 * - Rebirth system (button + command)
 * - Slightly harder difficulty (real death risk)
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
   CONFIG
========================================================= */

const CONFIG = {
  SAVE_INTERVAL: 15000,
  COOLDOWN: 5000,
  MAX_HP: 100,
  MAX_ENERGY: 100,
  START_CREDITS: 100,
  DAILY_COOLDOWN: 86400000,
  ADMIN_IDS: (process.env.ADMIN_IDS || "").split(",").filter(Boolean),
  HUB_MODE: true,
  SESSION_TTL: 1000 * 60 * 60 * 24,
  SESSION_SECRET: process.env.SESSION_SECRET || "CHANGE_THIS_SECRET",
  BOSS_MIN_HP: 1200,
  BOSS_MAX_HP: 3500,
  CHAOS_BOSS_TRIGGER: 15,
  MAX_CHAOS: 100,
  BROADCAST_LIMIT: 300,
  ENERGY_COSTS: {
    event: 5,
    mine: 4,
    crime: 8,
    war: 10,
    boss: 6
  }
};

/* =========================================================
   STORAGE
========================================================= */

const DB_FILE      = "./data.json";
const WORLD_FILE   = "./world.json";
const SESSION_FILE = "./sessions.json";

/* =========================================================
   LOAD (SAFE)
========================================================= */

function load(path, fallback) {
  try {
    if (!fs.existsSync(path)) return fallback;
    const raw = fs.readFileSync(path, "utf8");
    if (!raw || !raw.trim()) return fallback;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return fallback;
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
  factions: { HODL: 0, FOMO: 0, SCAM: 0, WHALE: 0 }
});
let SESSIONS = load(SESSION_FILE, {});
let dirty = false;

/* =========================================================
   SAVE
========================================================= */

function save() { dirty = true; }

function atomicWrite(file, data) {
  const temp   = `${file}.tmp`;
  const backup = `${file}.bak`;
  try {
    if (fs.existsSync(file)) fs.copyFileSync(file, backup);
    fs.writeFileSync(temp, JSON.stringify(data, null, 2));
    const check = JSON.parse(fs.readFileSync(temp, "utf8"));
    if (!check || typeof check !== "object") throw new Error("Validation failed");
    fs.renameSync(temp, file);
  } catch (err) {
    console.log("❌ ATOMIC WRITE FAILED:", file, err.message);
    try {
      if (fs.existsSync(backup)) {
        fs.copyFileSync(backup, file);
        console.log("♻️ Restored backup:", file);
      }
    } catch (re) { console.log("❌ BACKUP RESTORE FAILED:", re.message); }
  }
}

function forceSave() {
  if (!dirty) return;
  try {
    atomicWrite(DB_FILE, DB);
    atomicWrite(WORLD_FILE, WORLD);
    atomicWrite(SESSION_FILE, SESSIONS);
    dirty = false;
    console.log("💾 Saved safely");
  } catch (err) { console.log("❌ SAVE ERROR:", err.message); }
}

setInterval(() => { if (dirty) forceSave(); }, CONFIG.SAVE_INTERVAL);

/* =========================================================
   PROCESS SAFETY
========================================================= */

process.on("uncaughtException",    err => console.log("❌ UNCAUGHT:", err));
process.on("unhandledRejection",   err => console.log("❌ REJECTION:", err));
process.on("SIGINT",  () => { forceSave(); process.exit(0); });
process.on("SIGTERM", () => { forceSave(); process.exit(0); });

/* =========================================================
   UTILITIES
========================================================= */

const rand  = arr => arr[Math.floor(Math.random() * arr.length)];
const now   = ()  => Date.now();
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const level = xp  => Math.floor(xp / 100) + 1;
const isAdmin = id => CONFIG.ADMIN_IDS.includes(String(id));
const safeNumber = (n, fallback = 0) =>
  typeof n === "number" && !isNaN(n) ? n : fallback;

/* =========================================================
   🌌 FOMOYODL ONBOARDING GATE
   Passive first-time user onboarding system
========================================================= */

/**
 * PURPOSE:
 * - Detect first-time users in group chats
 * - Automatically surface game entry button
 * - Prevent spam/repeating welcomes
 * - Funnel users into private bot correctly
 *
 * IMPORTANT:
 * This does NOT register users.
 * It ONLY creates the bridge into the bot.
 */

const ONBOARDING = {
  enabled: true,

  // how long before user can be welcomed again
  cooldown: 1000 * 60 * 60 * 24, // 24h

  // store who already saw onboarding
  seenUsers: {}
};

/* =========================================================
   HELPERS
========================================================= */

function hasSeenOnboarding(userId) {
  const last = ONBOARDING.seenUsers[userId];
  if (!last) return false;

  return (Date.now() - last) < ONBOARDING.cooldown;
}

function markOnboardingSeen(userId) {
  ONBOARDING.seenUsers[userId] = Date.now();
}

/* =========================================================
   AUTO ENTRY DETECTOR
========================================================= */

bot.use(async (ctx, next) => {
  try {
    if (!ONBOARDING.enabled) {
      return next();
    }

    if (!ctx.from || !ctx.chat) {
      return next();
    }

    // only operate in groups
    const isPrivate = ctx.chat.type === "private";

    if (isPrivate) {
      return next();
    }

    const userId = ctx.from.id;

    // existing registered player?
    const existing = DB[userId];

    if (existing?.registered) {
      return next();
    }

    // avoid spamming same user repeatedly
    if (hasSeenOnboarding(userId)) {
      return next();
    }

    markOnboardingSeen(userId);

    // generate private entry link
    const link = hubPrivateLink(userId, ctx);

    await reply(
      ctx,
`🌌 Welcome to FOMOYODLVERSE

The chain has collapsed.
Survivors now fight for credits, factions, and control of the Yodelverse.

Start your journey below.`,
      Markup.inlineKeyboard([
        [Markup.button.url("🎮 ENTER FOMOYODLVERSE", link)]
      ])
    );

    return next();

  } catch (err) {
    console.log("❌ FOMOYODL ONBOARDING ERROR:", err.message);
    return next();
  }
});
/* =========================================================
   🌌 START ORGANISER — DROP-IN ENTRY CONTROLLER
   (NO OTHER CODE CHANGES REQUIRED)
========================================================= */

/**
 * This becomes the ONLY entry gate for the game.
 * It safely wraps /start, /game, fallback, and deep links
 * without requiring you to edit the rest of the code.
 */

async function START_ORGANISER(ctx, next) {
  try {
    if (!ctx.from) return;

    const u = getUser(ctx.from.id, ctx);
    const text = ctx.message?.text || "";
    const isPrivate = ctx.chat?.type === "private";
    const session = resolveSessionFromCtx(ctx);

    const isStartCmd = text.startsWith("/start");
    const isGameCmd  = text.startsWith("/game");

    // =====================================================
    // 💀 DEATH STATE (never blocks navigation, only informs)
    // =====================================================
    if (u.dead) {
      return reply(ctx,
        "💀 You are dead in the Yodelverse.\n\nOpen the bot and use ♻️ REBIRTH or /respawn."
      );
    }

    // =====================================================
    // 🌍 GROUP CHAT ENTRY (ONLY /game generates link)
    // =====================================================
    if (!isPrivate) {
      if (!isGameCmd) return next?.();

      const link = hubPrivateLink(ctx.from.id, ctx);

      return reply(ctx,
        "🌌 Enter your private Yodelverse session:",
        Markup.inlineKeyboard([
          [Markup.button.url("🎮 ENTER GAME", link)]
        ])
      );
    }

    // =====================================================
    // 🔗 SESSION ENTRY (PRIMARY REGISTRATION PATH)
    // =====================================================
    if (session) {
      if (!u.registered) {
        u.character = u.character || rand(CHARACTERS);
        u.faction   = u.faction   || rand(FACTIONS);
        u.registered = true;

        // tracking for UI refresh system
        u.uiTicks = 0;

        save();
        broadcast(`🌌 ${u.name} joined ${u.faction}`);
      }

      return home(ctx, u);
    }

    // =====================================================
    // 👤 REGISTERED USERS (ALWAYS GO HOME)
    // =====================================================
    if (u.registered) {
      u.uiTicks = (u.uiTicks || 0) + 1;

      // 🔁 UI REFRESH MECHANISM (your "rebuild keyboard" idea)
      const shouldRefreshUI = u.uiTicks % 7 === 0;

      if (shouldRefreshUI) {
        return reply(
          ctx,
          homeText(u),
          homeMenu(u.id, ctx)
        );
      }

      return home(ctx, u);
    }

    // =====================================================
    // 🚀 NEW USER FLOW (ONLY ONE ENTRY PATH)
    // =====================================================
    const entryAttempt =
      isStartCmd ||
      isGameCmd ||
      text === "";

    if (!entryAttempt) {
      return reply(ctx,
        "🌌 Use /start or /game to enter the Yodelverse.",
        Markup.inlineKeyboard([
          [Markup.button.callback("🚀 START", "start_game")]
        ])
      );
    }

    return reply(ctx,
`🌌 FOMO YODELVERSE

The system collapsed.
Only those who press START can enter reality.

Press START to begin.`,
      Markup.inlineKeyboard([
        [Markup.button.callback("🚀 START", "start_game")]
      ])
    );

  } catch (err) {
    console.log("❌ START_ORGANISER ERROR:", err.message);
  }
}
/* =========================================================
   DEATH HELPERS
========================================================= */

function isDead(user) { return !!user?.dead; }

function checkDeath(ctx, user) {
  if (!user || !user.dead) return false;
  if (user.hp > 0) user.hp = 0;
  return true;
}

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

/* =========================================================
   ROUTING HELPERS
========================================================= */

function isPrivateChat(ctx) {
  return ctx.chat && ctx.chat.type === "private";
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
  const session = resolveSessionFromCtx(ctx);
  if (user.registered || session) return true;
  reply(ctx, "❌ You must complete registration first.");
  return false;
}

function spendEnergy(user, amount) {
  if (user.energy < amount) return false;
  user.energy -= amount;
  return true;
}

function restoreEnergy(user) {
  user.energy = clamp(user.energy + 1, 0, CONFIG.MAX_ENERGY);
}

function transaction(callback) {
  try { callback(); save(); return true; }
  catch (err) { console.log("❌ TRANSACTION ERROR:", err.message); return false; }
}

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
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [id, sig] = parts;
    if (signSession(id) !== sig) return null;
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
  const botUsername = process.env.BOT_USERNAME || "FOMOYODELverseBot";
  return `https://t.me/${botUsername}?start=session_${token}`;
}

/* =========================================================
   REBIRTH SYSTEM
========================================================= */

const REBIRTH_CONFIG = {
  xpKeepRatio:      0.25,
  creditBonus:      100,
  energyRestore:    true,
  hpReset:          true,
  rebirthCooldown:  1000 * 60 * 10
};

function canRebirth(user) {
  if (!user || !user.dead) return false;
  if (!user.deathTime) return true;
  return (now() - user.deathTime) > REBIRTH_CONFIG.rebirthCooldown;
}

function rebirthPlayer(user) {
  if (!user || !user.dead) return user;
  if (!canRebirth(user)) return null;
  user.dead     = false;
  user.deathTime = null;
  if (REBIRTH_CONFIG.hpReset)      user.hp     = CONFIG.MAX_HP;
  if (REBIRTH_CONFIG.energyRestore) user.energy = CONFIG.MAX_ENERGY;
  user.xp      = Math.floor(user.xp * REBIRTH_CONFIG.xpKeepRatio);
  user.credits += REBIRTH_CONFIG.creditBonus;
  user.prestige = (user.prestige || 0) + 1;
  return user;
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

const FACTIONS = ["HODL", "FOMO", "SCAM", "WHALE"];

const EVENTS = [
  { title: "Whale Manipulation",  text: "Massive liquidity distortion detected.",    xp: 20, credits: 15, chaos: 2, risk: 0.30 },
  { title: "Meme Coin Frenzy",    text: "Speculators flood the markets.",             xp: 15, credits: 20, chaos: 1, risk: 0.25 },
  { title: "Shadow Rugpull",      text: "Entire sectors collapse instantly.",         xp: 35, credits: 30, chaos: 3, risk: 0.45 },
  { title: "Quantum Pump",        text: "Unknown forces trigger hypergrowth.",        xp: 50, credits: 40, chaos: 4, risk: 0.50 },
  { title: "Flash Loan Attack",   text: "Someone drained three protocols at once.",   xp: 40, credits: 35, chaos: 3, risk: 0.40 },
  { title: "Airdrop Frenzy",      text: "Free tokens rain from the void.",            xp: 10, credits: 50, chaos: 1, risk: 0.15 }
];

/* =========================================================
   ITEM SYSTEM
========================================================= */

const ITEMS = [
  { id: "scrap_token",       name: "Scrap Token",       rarity: "common",    power: 1,  type: "resource", hpBonus: 0,  energyBonus: 5  },
  { id: "glitch_shard",      name: "Glitch Shard",      rarity: "common",    power: 2,  type: "resource", hpBonus: 0,  energyBonus: 8  },
  { id: "dark_token",        name: "Dark Token",        rarity: "rare",      power: 4,  type: "resource", hpBonus: 5,  energyBonus: 0  },
  { id: "quantum_ore",       name: "Quantum Ore",       rarity: "rare",      power: 6,  type: "resource", hpBonus: 8,  energyBonus: 0  },
  { id: "meme_crystal",      name: "Meme Crystal",      rarity: "epic",      power: 10, type: "boost",    hpBonus: 15, energyBonus: 10 },
  { id: "whale_fragment",    name: "Whale Fragment",    rarity: "epic",      power: 12, type: "boost",    hpBonus: 20, energyBonus: 0  },
  { id: "forbidden_ledger",  name: "Forbidden Ledger",  rarity: "legendary", power: 25, type: "relic",    hpBonus: 30, energyBonus: 25 },
  { id: "void_core",         name: "Void Core",         rarity: "legendary", power: 30, type: "relic",    hpBonus: 40, energyBonus: 30 },
  { id: "rug_shard",         name: "Rug Shard",         rarity: "common",    power: 1,  type: "resource", hpBonus: 0,  energyBonus: 3  },
  { id: "defi_key",          name: "DeFi Key",          rarity: "rare",      power: 5,  type: "resource", hpBonus: 10, energyBonus: 5  },
  { id: "satoshi_relic",     name: "Satoshi Relic",     rarity: "legendary", power: 35, type: "relic",    hpBonus: 50, energyBonus: 40 }
];

// Drop chances per activity: [commonChance, rareChance, epicChance, legendaryChance]
const DROP_TABLE = {
  mine:  [0.25, 0.10, 0.03, 0.005],
  event: [0.20, 0.08, 0.02, 0.003],
  crime: [0.30, 0.12, 0.04, 0.008],
  war:   [0.22, 0.09, 0.03, 0.005],
  boss:  [0.40, 0.20, 0.10, 0.030]
};

function rollDrop(activity) {
  const [c, r, e, l] = DROP_TABLE[activity] || [0.15, 0.05, 0.01, 0.001];
  const roll = Math.random();
  let rarity;
  if      (roll < l) rarity = "legendary";
  else if (roll < l + e) rarity = "epic";
  else if (roll < l + e + r) rarity = "rare";
  else if (roll < l + e + r + c) rarity = "common";
  else return null;

  const pool = ITEMS.filter(i => i.rarity === rarity);
  return pool.length ? rand(pool) : null;
}

/* =========================================================
   BOSS ROSTER (expanded, tiered)
========================================================= */

const BOSS_ROSTER = [
  // tier 1 — weakest
  { name: "THE RUG EMPEROR",       tier: 1, hpMult: 1.0, reward: 80,  lore: "Pulls rugs for breakfast." },
  { name: "VAPORWARE SPECTER",      tier: 1, hpMult: 1.0, reward: 80,  lore: "Promises products that never ship." },
  { name: "LORD PAPER HANDS",       tier: 1, hpMult: 1.1, reward: 90,  lore: "Sells every dip. Every. Single. One." },
  // tier 2 — medium
  { name: "MEGA WHALE",             tier: 2, hpMult: 1.3, reward: 120, lore: "Moves markets with a single wallet." },
  { name: "DARTH LIQUIDATOR",       tier: 2, hpMult: 1.4, reward: 130, lore: "Erases leveraged positions across the chain." },
  { name: "COUNT PONZI-DOKU",       tier: 2, hpMult: 1.4, reward: 130, lore: "His returns are too good to be true." },
  { name: "GENERAL FOMO GRIEVOUS",  tier: 2, hpMult: 1.5, reward: 140, lore: "Buys tops. Commands armies of retail." },
  // tier 3 — strongest
  { name: "VOID LEVIATHAN",         tier: 3, hpMult: 1.8, reward: 200, lore: "Ancient entity. Predates the blockchain." },
  { name: "CHAIN DEVOURER",         tier: 3, hpMult: 2.0, reward: 220, lore: "Has consumed seventeen forks." },
  { name: "EMPEROR SATOSHI SHADOW", tier: 3, hpMult: 2.2, reward: 250, lore: "The dark mirror of the original vision." }
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
  try { await ctx.answerCbQuery(); } catch {}
}

/* =========================================================
   USER SYSTEM
========================================================= */

function createUser(id, ctx = null) {
  return {
    id,
    name:         ctx?.from?.first_name || "Player",
    username:     ctx?.from?.username   || "",
    registered:   false,
    character:    null,
    faction:      null,
    xp:           0,
    credits:      CONFIG.START_CREDITS,
    hp:           CONFIG.MAX_HP,
    energy:       CONFIG.MAX_ENERGY,
    wins:         0,
    losses:       0,
    reputation:   0,
    prestige:     0,
    inventory:    [],
    apartment:    "Container Unit",
    ship:         "Rust Bucket",
    miningLevel:  1,
    hackingLevel: 1,
    cooldowns:    {},
    lastDaily:    0,
    wanted:       false,
    dead:         false,
    deathTime:    null
  };
}

function repairUser(u) {
  if (!u) return u;
  if (!u.cooldowns || typeof u.cooldowns !== "object") u.cooldowns = {};
  if (!Array.isArray(u.inventory)) u.inventory = [];
  u.xp          = safeNumber(u.xp);
  u.credits     = safeNumber(u.credits);
  u.hp          = safeNumber(u.hp, CONFIG.MAX_HP);
  u.energy      = safeNumber(u.energy, CONFIG.MAX_ENERGY);
  u.wins        = safeNumber(u.wins);
  u.losses      = safeNumber(u.losses);
  u.reputation  = safeNumber(u.reputation);
  u.prestige    = safeNumber(u.prestige);
  u.miningLevel = safeNumber(u.miningLevel, 1);
  u.hackingLevel= safeNumber(u.hackingLevel, 1);
  if (typeof u.dead !== "boolean") u.dead = false;
  if (u.hp <= 0 && !u.dead) { u.dead = true; u.deathTime = u.deathTime || now(); }
  if (u.deathTime === undefined) u.deathTime = null;
  return u;
}

function getUser(id, ctx = null) {
  if (!DB[id]) { DB[id] = createUser(id, ctx); save(); }
  DB[id] = repairUser(DB[id]);
  return DB[id];
}

/* =========================================================
   COOLDOWNS
========================================================= */

function cooldownOk(user, key, ms = CONFIG.COOLDOWN) {
  if (!user) return false;
  if (!user.cooldowns || typeof user.cooldowns !== "object") user.cooldowns = {};
  const nowTime = now();
  const last    = user.cooldowns[key] || 0;
  if (nowTime - last < ms) return false;
  user.cooldowns[key] = nowTime;
  return true;
}

/* =========================================================
   WORLD ENGINE
========================================================= */

function addChaos(amount) {
  WORLD.chaos = clamp(WORLD.chaos + amount, 1, CONFIG.MAX_CHAOS);
  if (WORLD.chaos >= CONFIG.CHAOS_BOSS_TRIGGER && (!WORLD.boss || !WORLD.boss.active)) {
    spawnBoss();
  }
  save();
}

function addFactionPower(faction, amount) {
  if (!faction) return;
  if (WORLD.factions[faction] === undefined) WORLD.factions[faction] = 0;
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
      await new Promise(r => setTimeout(r, 40));
    } catch (err) {
      console.log(`❌ BROADCAST FAILED ${id}:`, err.message);
    }
  }
}

/* =========================================================
   BOSS SYSTEM
========================================================= */

let bossLock = false;

function spawnBoss() {
  if (bossLock) return;
  if (WORLD.boss && WORLD.boss.active) return;
  bossLock = true;

  const template = rand(BOSS_ROSTER);
  const baseHp   = CONFIG.BOSS_MIN_HP +
    Math.floor(Math.random() * (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP));
  const hp = Math.floor(baseHp * template.hpMult);

  WORLD.boss = {
    active:   true,
    id:       crypto.randomBytes(8).toString("hex"),
    name:     template.name,
    tier:     template.tier,
    hp,
    maxHp:    hp,
    reward:   template.reward,
    lore:     template.lore
  };

  broadcast(
`🐋 WORLD BOSS SPAWNED — TIER ${template.tier}

👹 ${template.name}
"${template.lore}"

❤️ HP: ${hp}
💰 Reward pool: ${template.reward} credits`
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
    const reward   = WORLD.boss.reward || 100;
    broadcast(`🎉 WORLD BOSS DEFEATED!\n\n👹 ${bossName} has fallen.\n💰 All participants earn bonus loot!`);
    WORLD.boss = null;
    return reward;
  }
  save();
  return 0;
}

/* =========================================================
   MENU
========================================================= */

function homeMenu(userId, ctx) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("⚡ EVENT",       "event"),
      Markup.button.callback("⛏ MINE",         "mine")
    ],
    [
      Markup.button.callback("🕶 CRIME",        "crime"),
      Markup.button.callback("⚔ WAR",           "war")
    ],
    [
      Markup.button.callback("🐋 BOSS",         "boss"),
      Markup.button.callback("📊 PROFILE",      "profile")
    ],
    [
      Markup.button.callback("🎒 INVENTORY",    "inventory"),
      Markup.button.callback("🏪 MARKET",       "market")
    ],
    [
      Markup.button.callback("🏆 LEADERBOARD",  "leaderboard"),
      Markup.button.callback("🎁 DAILY",        "daily")
    ],
    [
      Markup.button.callback("♻️ REBIRTH",      "rebirth")
    ]
  ]);
}

function homeText(u) {
  return `🌌 FOMO YODELVERSE

👤 ${u.name}
🧬 ${u.character || "UNSET"}
⚔ ${u.faction   || "UNSET"}

⭐ Level: ${level(u.xp)}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}/${CONFIG.MAX_HP}
⚡ Energy: ${u.energy}/${CONFIG.MAX_ENERGY}

🔥 Chaos: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}
🐋 Boss: ${WORLD.boss?.active ? WORLD.boss.name + " ❤️" + WORLD.boss.hp : "None"}`;
}

/* =========================================================
   HOME — SINGLE AUTHORITATIVE DEFINITION
   Registered users always get the menu.
   New unregistered users with a valid session also get in.
========================================================= */

async function home(ctx, u) {
  if (!u) {
    return reply(ctx, "❌ User not found. Please restart with /start.");
  }

  if (checkDeath(ctx, u)) {
    return reply(ctx,
      "💀 You have been eliminated from the Yodelverse.\n\nUse /respawn or press ♻️ REBIRTH to return."
    );
  }

  const session       = resolveSessionFromCtx(ctx);
  const canEnter      = u.registered === true || !!session;

  if (!canEnter) {
    return reply(ctx,
      "🚫 Session not active.\n\nUse /start or /game to enter the Yodelverse."
    );
  }

  return reply(ctx, homeText(u), homeMenu(u.id, ctx));
}

/* =========================================================
   DROP HELPER — appends loot message and pushes to inventory
========================================================= */

function tryDrop(user, activity) {
  const item = rollDrop(activity);
  if (!item) return "";
  user.inventory.push({ ...item });
  const stars = { common: "⚪", rare: "🔵", epic: "🟣", legendary: "🟡" };
  return `\n\n${stars[item.rarity] || "⚪"} ITEM DROP: ${item.name} (${item.rarity}) [PWR ${item.power}]`;
}

/* =========================================================
   DEATH COMMANDS
========================================================= */

bot.command("respawn", async (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!isDead(u)) return reply(ctx, "✅ You are not dead.");

  const revived = rebirthPlayer(u);
  if (!revived) {
    const deathTime = u.deathTime || now();
    const seconds   = Math.max(0, Math.ceil(
      (REBIRTH_CONFIG.rebirthCooldown - (now() - deathTime)) / 1000
    ));
    return reply(ctx, `⏳ Rebirth not ready yet.\n\nTry again in ${seconds}s`);
  }
  save();
  return home(ctx, u);
});

bot.action("rebirth", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!u) return;

  if (!u.dead) {
    return reply(ctx, "⚠️ You are still alive. Rebirth is only available after elimination.");
  }

  const revived = rebirthPlayer(u);
  if (!revived) {
    const deathTime = u.deathTime || now();
    const seconds   = Math.max(0, Math.ceil(
      (REBIRTH_CONFIG.rebirthCooldown - (now() - deathTime)) / 1000
    ));
    return reply(ctx, `⏳ Rebirth not ready yet.\n\nTry again in ${seconds}s`);
  }

  save();
  await reply(ctx,
`♻️ REBIRTH COMPLETE

You have returned to the Yodelverse.
Prestige: ${u.prestige} | XP retained: ${u.xp}`
  );
  return home(ctx, u);
});

bot.command("status", (ctx) => {
  const users = Object.keys(DB).length;
  return reply(ctx,
`🌌 SERVER STATUS

👥 Players: ${users}
🔥 Chaos: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}
🐋 Boss: ${WORLD.boss?.active ? WORLD.boss.name + " HP:" + WORLD.boss.hp : "NONE"}
💾 Save: ${dirty ? "PENDING" : "SYNCED"}`
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

  return reply(ctx,
`⚔ Choose Your Faction

HODL → Stability
FOMO → Aggression
SCAM → Manipulation
WHALE → Wealth`,
    Markup.inlineKeyboard(
      FACTIONS.map(f => [Markup.button.callback(f, "faction_" + f)])
    )
  );
});

bot.action(/faction_(.+)/, async (ctx) => {
  await ack(ctx);
  const faction = ctx.match[1];
  if (!FACTIONS.includes(faction)) return;

  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!u || u.dead) return;

  u.faction    = faction;
  u.registered = true;
  save();
  broadcast(`🌌 ${u.name} joined faction ${u.faction}`);
  return home(ctx, u);
});

/* =========================================================
   PROFILE
========================================================= */

function profileText(u) {
  return `📊 PROFILE

👤 ${u.name}  (@${u.username || "—"})
🧬 ${u.character}
⚔ ${u.faction}

⭐ Level: ${level(u.xp)}  XP: ${u.xp}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}${u.dead ? " (DEAD)" : ""}
⚡ Energy: ${u.energy}

🏆 Wins: ${u.wins}  💀 Losses: ${u.losses}
🌟 Reputation: ${u.reputation}
👑 Prestige: ${u.prestige}

⛏ Mining Lv: ${u.miningLevel}
🕶 Hacking Lv: ${u.hackingLevel}
🏠 ${u.apartment}
🚀 ${u.ship}
🚨 Wanted: ${u.wanted ? "YES" : "NO"}
🎒 Items: ${u.inventory.length}`;
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
   EVENT
========================================================= */

bot.action("event", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!cooldownOk(u, "event")) return reply(ctx, "⏳ Event cooldown active");

  const e    = rand(EVENTS);
  const risk = Math.min(0.90, e.risk + WORLD.chaos * 0.012);

  if (Math.random() < risk) {
    const loss   = 15 + Math.floor(Math.random() * 30);
    const damage = 12 + Math.floor(Math.random() * 18); // slightly harder
    u.credits    = clamp(u.credits - loss, 0, 999999);
    u.hp         = Math.max(0, u.hp - damage);
    u.losses     = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    addChaos(1);
    save();
    if (checkDeath(ctx, u)) return reply(ctx,
      `💀 EVENT KILLED YOU\n\n${e.title}\n-${loss} Credits, -${damage} HP\n\nUse /respawn to return.`
    );
    return reply(ctx,
`💥 EVENT FAILED

${e.title}
-${loss} Credits  -${damage} HP

🔥 Chaos increased`
    );
  }

  u.xp     += e.xp;
  u.credits += e.credits;
  u.wins     = (u.wins || 0) + 1;
  addFactionPower(u.faction, e.xp);
  addChaos(e.chaos);

  const drop = tryDrop(u, "event");
  save();

  return reply(ctx,
`⚡ ${e.title}

${e.text}
+${e.xp} XP  +${e.credits} Credits
🔥 Chaos: ${WORLD.chaos}${drop}`
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
  if (!cooldownOk(u, "mine")) return reply(ctx, "⏳ Mining cooldown active");

  // Small chance of cave-in (slightly harder)
  if (Math.random() < 0.12 + WORLD.chaos * 0.005) {
    const damage = 10 + Math.floor(Math.random() * 15);
    u.hp         = Math.max(0, u.hp - damage);
    u.losses     = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    save();
    if (checkDeath(ctx, u)) return reply(ctx,
      `💀 CAVE-IN — You were killed in the mines.\n\nUse /respawn to return.`
    );
    return reply(ctx,
`⛏ CAVE-IN!

The tunnel collapsed. -${damage} HP

HP: ${u.hp}/${CONFIG.MAX_HP}`
    );
  }

  const gain = 15 + Math.floor(Math.random() * 35) + (u.miningLevel * 5);
  u.credits += gain;
  u.xp      += 5;

  const drop = tryDrop(u, "mine");
  save();

  return reply(ctx,
`⛏ Mining Operation Successful

+${gain} Credits  +5 XP${drop}`
  );
});

/* =========================================================
   CRIME
========================================================= */

bot.action("crime", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (!cooldownOk(u, "crime")) return reply(ctx, "⏳ Crime cooldown active");

  if (Math.random() < 0.48) {
    const loss   = 20 + Math.floor(Math.random() * 40);
    const damage = 15 + Math.floor(Math.random() * 20); // slightly harder
    u.credits    = clamp(u.credits - loss, 0, 999999);
    u.hp         = Math.max(0, u.hp - damage);
    u.wanted     = true;
    u.losses     = (u.losses || 0) + 1;
    if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }
    save();
    if (checkDeath(ctx, u)) return reply(ctx,
      `💀 ELIMINATED BY AUTHORITIES\n\n-${loss} Credits, -${damage} HP\n\nUse /respawn to return.`
    );
    return reply(ctx,
`🚔 CRIME FAILED

-${loss} Credits  -${damage} HP
🚨 You are now WANTED`
    );
  }

  const gain = 40 + Math.floor(Math.random() * 90);
  u.credits    += gain;
  u.reputation += 1;
  u.wins        = (u.wins || 0) + 1;
  addChaos(1);

  const drop = tryDrop(u, "crime");
  save();

  return reply(ctx,
`🕶 BLACK MARKET SUCCESS

+${gain} Credits  +1 Reputation${drop}`
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
  if (!cooldownOk(u, "war", 8000)) return reply(ctx, "⏳ War cooldown active");

  const reward = 20 + Math.floor(Math.random() * 50);
  const damage = 10 + Math.floor(Math.random() * 20); // slightly harder

  u.xp    += reward;
  u.hp     = Math.max(0, u.hp - damage);
  if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }

  addFactionPower(u.faction, reward);
  addChaos(2);

  const drop = tryDrop(u, "war");
  save();

  if (checkDeath(ctx, u)) return reply(ctx,
    `💀 KILLED IN BATTLE\n\n+${reward} XP before death.\n\nUse /respawn to return.`
  );

  u.wins = (u.wins || 0) + 1;
  save();

  return reply(ctx,
`⚔ FACTION CONFLICT

${u.name} fought for ${u.faction}
+${reward} XP  -${damage} HP
🔥 Chaos increased${drop}`
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

  if (!WORLD.boss || !WORLD.boss.active) spawnBoss();
  if (!WORLD.boss) return reply(ctx, "⚠️ No boss available right now.");

  const tier   = WORLD.boss.tier || 1;
  const dmg    = 25 + Math.floor(Math.random() * 50);
  const damage = (8 + Math.floor(Math.random() * 10)) * tier; // tier scales damage taken

  const bossReward = damageBoss(dmg);

  u.xp    += 10 + tier * 5;
  u.hp     = Math.max(0, u.hp - damage);
  if (bossReward > 0) u.credits += bossReward; // killing blow bonus
  if (u.hp <= 0) { u.dead = true; u.deathTime = now(); }

  const drop = tryDrop(u, "boss");
  save();

  if (checkDeath(ctx, u)) return reply(ctx,
    `💀 THE BOSS DESTROYED YOU\n\nYou dealt ${dmg} damage before falling.\n\nUse /respawn to return.`
  );

  u.wins = (u.wins || 0) + 1;
  save();

  const remaining = WORLD.boss?.hp || 0;
  const bossLine  = remaining > 0
    ? `❤️ Boss HP remaining: ${remaining}`
    : `💥 BOSS DEFEATED! +${bossReward} bonus credits`;

  return reply(ctx,
`🐋 RAID ATTACK — ${WORLD.boss?.name || "BOSS"}

💥 Damage dealt: ${dmg}
-${damage} HP received
${bossLine}${drop}`
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
    return reply(ctx,
`🎒 INVENTORY — Empty

Go fight, mine, commit crimes, or raid bosses to earn items!`
    );
  }

  const stars = { common: "⚪", rare: "🔵", epic: "🟣", legendary: "🟡" };
  let msg = `🎒 INVENTORY (${u.inventory.length} items)\n\n`;

  u.inventory.forEach((item, i) => {
    if (typeof item === "string") { msg += `${i + 1}. ${item}\n`; return; }
    const name   = item?.name    || "Unknown Item";
    const rarity = item?.rarity  || "common";
    const power  = item?.power   ? ` [PWR ${item.power}]` : "";
    const star   = stars[rarity] || "⚪";
    msg += `${i + 1}. ${star} ${name} (${rarity})${power}\n`;
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

  return reply(ctx,
`🏪 BLACK MARKET

⚡ Energy Cell      — 50 credits
🛡 Nano Armor       — 100 credits
⛏ Quantum Drill    — 250 credits
🏠 Luxury Apartment — 500 credits`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Buy Energy",    "buy_energy")],
      [Markup.button.callback("🛡 Buy Armor",     "buy_armor")],
      [Markup.button.callback("⛏ Buy Drill",      "buy_drill")],
      [Markup.button.callback("🏠 Buy Apartment", "buy_home")]
    ])
  );
});

bot.action("buy_energy", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (u.credits < 50) return reply(ctx, "❌ Not enough credits");
  u.credits -= 50;
  u.energy   = clamp(u.energy + 25, 0, CONFIG.MAX_ENERGY);
  save();
  return reply(ctx, `⚡ Energy restored to ${u.energy}`);
});

bot.action("buy_armor", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (u.credits < 100) return reply(ctx, "❌ Not enough credits");
  u.credits -= 100;
  u.hp       = clamp(u.hp + 25, 0, CONFIG.MAX_HP);
  save();
  return reply(ctx, `🛡 Armor equipped — HP: ${u.hp}`);
});

bot.action("buy_drill", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (u.credits < 250) return reply(ctx, "❌ Not enough credits");
  u.credits     -= 250;
  u.miningLevel += 1;
  save();
  return reply(ctx, `⛏ Mining upgraded to Level ${u.miningLevel}`);
});

bot.action("buy_home", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;
  if (!requireRegistered(u, ctx)) return;
  if (u.credits < 500) return reply(ctx, "❌ Not enough credits");
  u.credits   -= 500;
  u.apartment  = "Luxury Sky Apartment";
  save();
  return reply(ctx, "🏠 Apartment upgraded to Luxury Sky Apartment");
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
    return reply(ctx, "⏳ Daily already claimed. Come back tomorrow.");
  }
  u.lastDaily = now();
  u.credits  += 100;
  u.xp       += 25;
  u.hp        = clamp(u.hp + 20, 0, CONFIG.MAX_HP); // daily also restores some HP
  save();
  return reply(ctx,
`🎁 DAILY REWARD

+100 Credits
+25 XP
+20 HP restored`
  );
});

/* =========================================================
   LEADERBOARD
========================================================= */

function leaderboardText() {
  const top = Object.values(DB).sort((a, b) => b.xp - a.xp).slice(0, 10);
  let msg = "🏆 LEADERBOARD\n\n";
  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name}  ⭐${level(u.xp)}  ${u.xp} XP\n`;
  });
  msg += "\n⚔ FACTION POWER\n\n";
  for (const f in WORLD.factions) { msg += `${f}: ${WORLD.factions[f]}\n`; }
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
   MENU COMMAND
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
  if (!isAdmin(ctx.from.id)) return;
  const msg = ctx.message.text.replace("/broadcast", "").trim();
  if (!msg) return reply(ctx, "Usage: /broadcast message");
  broadcast(`📢 ADMIN ALERT\n\n${msg}`);
  return reply(ctx, "✅ Broadcast sent");
});

bot.command("spawnboss", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;
  spawnBoss();
  return reply(ctx, "🐋 Boss spawned");
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

/* =========================================================
   RANDOM WORLD EVENTS
========================================================= */

setInterval(() => {
  if (Math.random() > 0.90) {
    addChaos(1);
    broadcast(rand([
      "🌌 Market instability detected.",
      "📉 A major token collapsed.",
      "🐋 Whale fleets moving through sectors.",
      "⚠ Illegal mining activity rising.",
      "💀 Shadow hackers breached the chain.",
      "🔥 Flash crash detected. Chaos rising.",
      "🛸 Unknown entity entered the Yodelverse."
    ]));
  }
}, 120000);

setInterval(() => {
  WORLD.marketState = rand(["stable", "bullish", "volatile", "crashing"]);
  save();
}, 300000);

/* =========================================================
   GLOBAL MIDDLEWARE (ANTISPAM)
========================================================= */

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
    console.log("❌ MIDDLEWARE ERROR:", err.message);
  }
});

/* =========================================================
   FALLBACK MESSAGE HANDLER
========================================================= */

bot.on("message", async (ctx) => {
  if (!ctx.from) return;

  const text      = ctx.message?.text || "";
  const isPrivate = ctx.chat?.type === "private";

  // --- GROUP CHAT ---
  if (!isPrivate) {
    const isGameCommand = text === "/game" || text.startsWith("/game@");
    if (!isGameCommand) return; // ignore everything else in group

    const deepLink = hubPrivateLink(ctx.from.id, ctx);
    return reply(ctx,
      "🌌 FOMO YODELVERSE\n\nTap below to enter your private game session:",
      Markup.inlineKeyboard([
        [Markup.button.url("🎮 ENTER THE YODELVERSE", deepLink)]
      ])
    );
  }

  // --- PRIVATE CHAT ---
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;

  const isEntryCommand = text.startsWith("/game") || text.startsWith("/start");
  if (!isEntryCommand) {
    return reply(ctx,
      "🌌 FOMO YODELVERSE\n\nUse /start or /game to enter.",
      Markup.inlineKeyboard([
        [Markup.button.callback("🚀 START", "start_game")]
      ])
    );
  }
});

/* =========================================================
   /start HANDLER
========================================================= */

bot.start(async (ctx) => {

  // --- DEEP-LINK SESSION ARRIVAL (from group button) ---
  if (ctx.chat?.type === "private") {
    const session = resolveSessionFromCtx(ctx);

    if (session) {
      const u = getUser(ctx.from.id, ctx);
      if (checkDeath(ctx, u)) {
        return reply(ctx, "💀 You are dead.\n\nUse /respawn to return to the Yodelverse.");
      }
      if (!u.registered) {
        if (!u.character) u.character = rand(CHARACTERS);
        if (!u.faction)   u.faction   = rand(FACTIONS);
        u.registered = true;
        save();
        broadcast(`🌌 ${u.name} joined ${u.faction}`);
        await reply(ctx,
`🌌 Welcome to the FOMO YODELVERSE, ${u.name}!

🧬 Character: ${u.character}
⚔ Faction: ${u.faction}

The Yodelverse awaits.`
        );
      } else {
        // Returning user — brief welcome back
        await reply(ctx,
          `👋 Welcome back, ${u.name}.\n⚔ ${u.faction} | ⭐ Level ${level(u.xp)} | ❤️ ${u.hp} HP`
        );
      }
      return home(ctx, u);
    }
  }

  // --- GROUP /start ---
  if (ctx.chat?.type !== "private") {
    const botUsername = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME_HERE";
    return reply(ctx,
      "🌌 FOMO YODELVERSE\n\nUse /game in the group to get your private entry link.",
      Markup.inlineKeyboard([
        [Markup.button.url("🎮 ENTER THE YODELVERSE", `https://t.me/${botUsername}`)]
      ])
    );
  }

  // --- PRIVATE /start, no deep-link ---
  const u = getUser(ctx.from.id, ctx);

  if (checkDeath(ctx, u)) {
    return reply(ctx, "💀 You are dead.\n\nUse /respawn to return to the Yodelverse.");
  }

  // Returning registered user — skip intro, go straight home with welcome back
  if (u.registered) {
    await reply(ctx,
      `👋 Welcome back, ${u.name}.\n⚔ ${u.faction} | ⭐ Level ${level(u.xp)} | ❤️ ${u.hp} HP`
    );
    return home(ctx, u);
  }

  // New user — show intro
  return reply(ctx,
`🌌 FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.
The blockchain is now a warzone.

Press START to enter the Yodelverse.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🚀 START", "start_game")]
    ])
  );
});

/* =========================================================
   /game HANDLER
========================================================= */

bot.command("game", async (ctx) => {

  // Group: generate deep link
  if (ctx.chat?.type !== "private") {
    const deepLink = hubPrivateLink(ctx.from.id, ctx);
    return reply(ctx,
      "🌌 FOMO YODELVERSE\n\nTap below to enter your private game session:",
      Markup.inlineKeyboard([
        [Markup.button.url("🎮 ENTER THE YODELVERSE", deepLink)]
      ])
    );
  }

  // Private: returning user goes straight home
  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;

  if (u.registered) {
    await reply(ctx,
      `👋 Welcome back, ${u.name}.\n⚔ ${u.faction} | ⭐ Level ${level(u.xp)} | ❤️ ${u.hp} HP`
    );
    return home(ctx, u);
  }

  u._entryIntent = "game";
  return reply(ctx,
`🌌 FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.

Press START to enter the Yodelverse.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("🚀 START", "start_game")]
    ])
  );
});

/* =========================================================
   START BUTTON HANDLER
========================================================= */

bot.action("start_game", async (ctx) => {
  await ack(ctx);
  if (ctx.chat?.type !== "private") return;

  const u = getUser(ctx.from.id, ctx);
  if (checkDeath(ctx, u)) return;

  if (!u.registered) {
    if (!u.character) u.character = rand(CHARACTERS);
    if (!u.faction)   u.faction   = rand(FACTIONS);
    u.registered   = true;
    u._entryIntent = null;
    save();
    broadcast(`🌌 ${u.name} joined ${u.faction}`);
    await reply(ctx,
`🌌 Welcome to the FOMO YODELVERSE, ${u.name}!

🧬 Character: ${u.character}
⚔ Faction: ${u.faction}

You start with ${CONFIG.START_CREDITS} credits. Good luck.`
    );
  }

  return home(ctx, u);
});

/* =========================================================
   LAUNCH
========================================================= */

console.log("➡️ Launch call executed");
bot.launch()
  .then(() => console.log("🌌 FOMO YODELVERSE ONLINE"))
  .catch(err => console.error("❌ Launch error:", err));
