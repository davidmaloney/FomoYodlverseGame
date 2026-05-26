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
🚪 STRICT ENTRY GATE PATCH (CRITICAL FIX)
========================================================= */

function isValidGameEntry(ctx) {
  const text = ctx.message?.text || "";
  const payload = ctx.startPayload || "";

  const isStartCommand = text === "/start";
  const isGameCommand = text === "/game";
  const isDeepLinkSession = typeof payload === "string" && payload.startsWith("session_");
  const isStartGameButton = ctx.callbackQuery?.data === "start_game";

  return isStartCommand || isGameCommand || isDeepLinkSession || isStartGameButton;
}

function blockInvalidGameAccess(ctx) {
  if (!ctx.from) return true;

  const text = ctx.message?.text || "";

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

};

/* =========================================================
STORAGE
========================================================= */

const DB_FILE = "./data.json";
const WORLD_FILE = "./world.json";
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
let dirty = false;

/* =========================================================
SAVE FLAG
========================================================= */

function save() {
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

    fs.writeFileSync(
      temp,
      JSON.stringify(data, null, 2)
    );

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
FORCE SAVE (SAFE)
========================================================= */

function forceSave() {
  if (!dirty) return;
  
  try {
    atomicWrite(DB_FILE, DB);
    atomicWrite(WORLD_FILE, WORLD);
    atomicWrite(SESSION_FILE, SESSIONS);

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
  if (!dirty) return;
  forceSave();
}, CONFIG.SAVE_INTERVAL);

/* =========================================================
SAFETY
========================================================= */

process.on("uncaughtException", (err) => {
  console.log("❌ UNCAUGHT ERROR");
  console.log(err);
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
arr[
  Math.floor(
    Math.random() * arr.length
  )
];

const now = () => Date.now();

function clamp(n, min, max) {
  return Math.max(
    min,
    Math.min(max, n)
  );
}

function level(xp) {
  return Math.floor(xp / 100) + 1;
}

function isAdmin(id) {
  return CONFIG.ADMIN_IDS.includes(
    String(id)
  );
}

function safeNumber(n, fallback = 0) {
  return typeof n === "number" && !isNaN(n)
    ? n
    : fallback;
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
 if (!user || !user.registered) {
   reply(
     ctx,
     "❌ You must complete registration first."
   );
   return false;
 }
 return true;
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
 user.energy = clamp(
   user.energy + 1,
   0,
   CONFIG.MAX_ENERGY
 );
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
ITEM SYSTEM (UPGRADED)
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

function repairUser(u) {
  if (!u) return u;

  if (!u.cooldowns || typeof u.cooldowns !== "object") {
    u.cooldowns = {};
  }

  if (!Array.isArray(u.inventory)) {
    u.inventory = [];
  }

  u.xp = safeNumber(u.xp);
  u.credits = safeNumber(u.credits);
  u.hp = safeNumber(u.hp, CONFIG.MAX_HP);
  u.energy = safeNumber(u.energy, CONFIG.MAX_ENERGY);
  u.wins = safeNumber(u.wins);
  u.losses = safeNumber(u.losses);
  u.reputation = safeNumber(u.reputation);
  u.prestige = safeNumber(u.prestige);
  u.miningLevel = safeNumber(u.miningLevel, 1);
  u.hackingLevel = safeNumber(u.hackingLevel, 1);

  if (typeof u.dead !== "boolean") {
    u.dead = false;
  }

  if (u.hp <= 0 && !u.dead) {
    u.dead = true;
  }

  return u;
}

function getUser(id, ctx = null) {
  if (!DB[id]) {
    DB[id] = createUser(id, ctx);
    save();
  }

  DB[id] = repairUser(DB[id]);
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
WORLD ENGINE
========================================================= */

function addChaos(amount) {
  WORLD.chaos = clamp(
    WORLD.chaos + amount,
    1,
    CONFIG.MAX_CHAOS
  );

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
BOSS SYSTEM
========================================================= */

let bossLock = false;

function spawnBoss() {
 if (bossLock) return;
 if (WORLD.boss && WORLD.boss.active) return;

 bossLock = true;

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
     Math.floor(
       Math.random() * (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP)
     )
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
    broadcast(`🎉 WORLD BOSS DEFEATED! The ${WORLD.boss.name} has fallen.`);
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
    const waitTime = REBIRTH_CONFIG.rebirthCooldown - (now() - u.deathTime);
    const seconds = Math.ceil(waitTime / 1000);

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
  const risk = e.risk + (WORLD.chaos * 0.01);

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

  const gain = 15 + Math.floor(Math.random() * 35) + (u.miningLevel * 5);
  u.credits += gain;
  u.xp += 5;

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
    const loss = 20 + Math.floor(Math.random() * 40);
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

  const gain = 40 + Math.floor(Math.random() * 90);
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

  const reward = 20 + Math.floor(Math.random() * 50);
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

  const dmg = 25 + Math.floor(Math.random() * 50);
  damageBoss(dmg);

  u.xp += 10;
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
      [Markup.button.callback("
