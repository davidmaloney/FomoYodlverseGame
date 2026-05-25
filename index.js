/**
* =========================================================
* 🌌 FOMO YODELVERSE — ULTIMATE HUB EDITION (Stability + Scale Hardened)
* =========================================================
* Complete Merge • All Actions Expanded • Optimized Broadcast • TTL Active Users
* Fully Fixed & Production Ready
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
  SAVE_DEBOUNCE: 8000,
  COOLDOWN: 5000,
  MAX_HP: 100,
  MAX_ENERGY: 100,
  START_CREDITS: 100,
  DAILY_COOLDOWN: 86400000,
  ADMIN_IDS: (process.env.ADMIN_IDS || "").split(",").filter(Boolean),
  HUB_MODE: true,
  SESSION_TTL: 1000 * 60 * 60 * 24,
  SESSION_SECRET: process.env.SESSION_SECRET || "CHANGE_THIS_SECRET",
  BOSS_MIN_HP: 1000,
  BOSS_MAX_HP: 2500,
  CHAOS_BOSS_TRIGGER: 15,
  BROADCAST_LIMIT: 500,
  BROADCAST_CONCURRENCY: 8,
  ACTIVE_USER_TTL: 1000 * 60 * 30,
  MAX_BROADCAST_USERS: 2000,

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

function load(path, fallback) {
  try {
    if (!fs.existsSync(path)) return fallback;
    const raw = fs.readFileSync(path, "utf8");
    if (!raw || !raw.trim()) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.log("❌ LOAD ERROR:", err.message);
    return fallback;
  }
}

let DB = load(DB_FILE, {});
let WORLD = load(WORLD_FILE, {
  season: 1,
  chaos: 1,
  marketState: "stable",
  boss: null,
  factions: { HODL: 0, FOMO: 0, SCAM: 0, WHALE: 0 }
});

let SESSIONS = load(SESSION_FILE, {});

let saveTimer = null;
let savePending = false;

function atomicWrite(file, data) {
  const temp = `${file}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(data, null, 2));
  fs.renameSync(temp, file);
}

function save() {
  savePending = true;
  if (saveTimer) return;

  saveTimer = setTimeout(() => {
    if (!savePending) {
      saveTimer = null;
      return;
    }
    try {
      atomicWrite(DB_FILE, DB);
      atomicWrite(WORLD_FILE, WORLD);
      atomicWrite(SESSION_FILE, SESSIONS);
      console.log("💾 Saved");
    } catch (err) {
      console.log("❌ SAVE ERROR:", err.message);
    }
    savePending = false;
    saveTimer = null;
  }, CONFIG.SAVE_DEBOUNCE);
}

/* =========================================================
SAFETY & UTILITIES
========================================================= */

process.on("uncaughtException", (err) => console.log("❌ UNCAUGHT ERROR:", err));
process.on("unhandledRejection", (err) => console.log("❌ REJECTION:", err));
process.on("SIGINT", () => { save(); process.exit(0); });
process.on("SIGTERM", () => { save(); process.exit(0); });

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
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
ANTISPAM & ACTIVE USERS
========================================================= */

const ACTION_SPAM = {};

function antiSpam(userId, ms = 1200) {
  const last = ACTION_SPAM[userId] || 0;
  if (now() - last < ms) return false;
  ACTION_SPAM[userId] = now();
  return true;
}

let ACTIVE_USERS = new Map(); // id -> timestamp

function markActive(userId) {
  ACTIVE_USERS.set(String(userId), Date.now());
}

function getActiveUserIds() {
  cleanupActiveUsers();
  return Array.from(ACTIVE_USERS.keys());
}

function cleanupActiveUsers() {
  const current = Date.now();
  for (const [id, last] of ACTIVE_USERS.entries()) {
    if (current - last > CONFIG.ACTIVE_USER_TTL) ACTIVE_USERS.delete(id);
  }
}
setInterval(cleanupActiveUsers, 10 * 60 * 1000);

/* =========================================================
MIDDLEWARE
========================================================= */

bot.use((ctx, next) => {
  if (!ctx.from) return next();
  markActive(ctx.from.id);

  if (!antiSpam(ctx.from.id)) {
    try { ctx.reply("⏳ Slow down a bit."); } catch {}
    return;
  }
  return next();
});

/* =========================================================
HELPERS
========================================================= */

function spendEnergy(user, amount) {
  if (user.energy < amount) return false;
  user.energy -= amount;
  return true;
}

function restoreEnergy(user) {
  user.energy = clamp(user.energy + 1, 0, CONFIG.MAX_ENERGY);
}

/* =========================================================
SESSION SYSTEM
========================================================= */

function signSession(id) {
  return crypto.createHmac("sha256", CONFIG.SESSION_SECRET).update(id).digest("hex");
}

function createSession(userId, topicId) {
  const id = crypto.randomBytes(16).toString("hex");
  const sig = signSession(id);
  SESSIONS[id] = { userId, topicId: topicId || null, created: now(), sig };
  save();
  return `${id}.${sig}`;
}

function validateSession(token) {
  try {
    if (!token) return null;
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [id, sig] = parts;
    const expected = signSession(id);
    if (sig !== expected) return null;

    const session = SESSIONS[id];
    if (!session || session.sig !== sig) return null;
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

function cleanupSessions() {
  let changed = false;
  for (const id in SESSIONS) {
    if (now() - SESSIONS[id].created > CONFIG.SESSION_TTL) {
      delete SESSIONS[id];
      changed = true;
    }
  }
  if (changed) save();
}
setInterval(cleanupSessions, 3600000);

function resolveSessionFromCtx(ctx) {
  const payload = ctx.startPayload;
  if (payload?.startsWith("session_")) {
    const token = payload.replace("session_", "");
    return validateSession(token);
  }
  return null;
}

function hubPrivateLink(userId, ctx) {
  const topicId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id || null;
  const token = createSession(userId, topicId);
  const botUsername = process.env.BOT_USERNAME || "YOUR_BOT_USERNAME";
  return `https://t.me/${botUsername}?start=session_${token}`;
}

/* =========================================================
GAME DATA
========================================================= */

const CHARACTERS = ["R2D5", "Darth Fader", "Fan Solo", "Princess Liquidia", "Jabba the Whale"];
const FACTIONS = ["HODL", "FOMO", "SCAM", "WHALE"];

const EVENTS = [
  { title: "Whale Manipulation", text: "Massive liquidity distortion detected.", xp: 20, credits: 15, chaos: 2, risk: 0.25 },
  { title: "Meme Coin Frenzy", text: "Speculators flood the markets.", xp: 15, credits: 20, chaos: 1, risk: 0.15 },
  { title: "Shadow Rugpull", text: "Entire sectors collapse instantly.", xp: 35, credits: 30, chaos: 3, risk: 0.40 },
  { title: "Quantum Pump", text: "Unknown forces trigger hypergrowth.", xp: 50, credits: 40, chaos: 4, risk: 0.50 }
];

const ITEMS = ["Dark Token", "Quantum Ore", "Ancient NFT", "Meme Crystal", "Whale Fragment", "Forbidden Ledger"];

/* =========================================================
REPLY SYSTEM
========================================================= */

async function reply(ctx, text, extra = {}) {
  try {
    const threadId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id;
    return await ctx.reply(text, {
      ...extra,
      ...(threadId ? { message_thread_id: threadId } : {})
    });
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
    wanted: false
  };
}

function repairUser(u) {
  if (!u.cooldowns || typeof u.cooldowns !== "object") u.cooldowns = {};
  if (!Array.isArray(u.inventory)) u.inventory = [];
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
  return u;
}

function getUser(id, ctx = null) {
  if (!DB[id]) {
    DB[id] = createUser(id, ctx);
    save();
  }
  DB[id] = repairUser(DB[id]);
  markActive(id);
  return DB[id];
}

function cooldownOk(user, key, ms = CONFIG.COOLDOWN) {
  if (!user.cooldowns) user.cooldowns = {};
  const last = user.cooldowns[key] || 0;
  if (now() - last < ms) return false;
  user.cooldowns[key] = now();
  return true;
}

/* =========================================================
WORLD ENGINE + BOSS
========================================================= */

function addChaos(amount) {
  WORLD.chaos += amount;
  if (WORLD.chaos < 1) WORLD.chaos = 1;
  if (WORLD.chaos >= CONFIG.CHAOS_BOSS_TRIGGER && (!WORLD.boss || !WORLD.boss.active)) spawnBoss();
  save();
}

function addFactionPower(faction, amount) {
  if (!faction) return;
  if (WORLD.factions[faction] === undefined) WORLD.factions[faction] = 0;
  WORLD.factions[faction] += amount;
  save();
}

let bossLock = false;

function damageBoss(dmg) {
  if (!WORLD.boss || !WORLD.boss.active) return;
  WORLD.boss.hp -= dmg;
  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;
    queueBroadcast(`🎉 WORLD BOSS DEFEATED!\n\n${WORLD.boss.name} has been slain!`);
    WORLD.boss = null;
  }
  save();
}

function spawnBoss() {
  if (bossLock) return;
  if (WORLD.boss && WORLD.boss.active) return;

  bossLock = true;
  WORLD.boss = {
    active: true,
    id: crypto.randomBytes(8).toString("hex"),
    name: rand(["VOID LEVIATHAN", "MEGA WHALE", "THE RUG EMPEROR", "CHAIN DEVOURER"]),
    hp: CONFIG.BOSS_MIN_HP + Math.floor(Math.random() * (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP))
  };

  queueBroadcast(`🐋 WORLD BOSS SPAWNED\n\n${WORLD.boss.name}\nHP: ${WORLD.boss.hp}`);
  bossLock = false;
  save();
}

/* =========================================================
OPTIMIZED BROADCAST QUEUE
========================================================= */

const broadcastQueue = [];
let broadcasting = false;

function queueBroadcast(message) {
  broadcastQueue.push(message);
  processBroadcastQueue();
}

async function processBroadcastQueue() {
  if (broadcasting) return;
  broadcasting = true;

  while (broadcastQueue.length) {
    const message = broadcastQueue.shift();

    let targets = getActiveUserIds();
    if (targets.length < 50) {
      const allIds = Object.keys(DB);
      targets = [...new Set([...targets, ...allIds.slice(0, CONFIG.BROADCAST_LIMIT)])];
    }

    targets = targets.slice(0, CONFIG.MAX_BROADCAST_USERS);

    for (let i = 0; i < targets.length; i += CONFIG.BROADCAST_CONCURRENCY) {
      const batch = targets.slice(i, i + CONFIG.BROADCAST_CONCURRENCY);
      await Promise.allSettled(
        batch.map(id => bot.telegram.sendMessage(id, message).catch(() => {}))
      );
      await new Promise(r => setTimeout(r, 350));
    }
  }
  broadcasting = false;
}

async function broadcast(message) {
  queueBroadcast(message);
}

/* =========================================================
MENUS & TEXT HELPERS
========================================================= */

function homeMenu(userId, ctx) {
  const rows = [
    [Markup.button.callback("⚡ EVENT", "event"), Markup.button.callback("⛏ MINE", "mine")],
    [Markup.button.callback("🕶 CRIME", "crime"), Markup.button.callback("⚔ WAR", "war")],
    [Markup.button.callback("🐋 BOSS", "boss"), Markup.button.callback("📊 PROFILE", "profile")],
    [Markup.button.callback("🎒 INVENTORY", "inventory"), Markup.button.callback("🏪 MARKET", "market")],
    [Markup.button.callback("🏆 LEADERBOARD", "leaderboard"), Markup.button.callback("🎁 DAILY", "daily")]
  ];
  if (CONFIG.HUB_MODE) rows.push([Markup.button.url("🚀 OPEN PRIVATE GAME", hubPrivateLink(userId, ctx))]);
  return Markup.inlineKeyboard(rows);
}

function homeText(u) {
  return `🌌 FOMO YODELVERSE\n\n👤 ${u.name}\n🧬 ${u.character || "UNSET"}\n⚔ ${u.faction || "UNSET"}\n⭐ Level: ${level(u.xp)}\n💰 Credits: ${u.credits}\n❤️ HP: ${u.hp}\n⚡ Energy: ${u.energy}\n🔥 Chaos: ${WORLD.chaos}\n🌍 Market: ${WORLD.marketState}`;
}

function profileText(u) {
  return `📊 PROFILE\n\n👤 ${u.name}\n🧬 ${u.character}\n⚔ ${u.faction}\n⭐ Level: ${level(u.xp)}\nXP: ${u.xp}\n💰 Credits: ${u.credits}\n🏆 Wins: ${u.wins}\n💀 Losses: ${u.losses}\n🌟 Reputation: ${u.reputation}\n👑 Prestige: ${u.prestige}\n⛏ Mining: ${u.miningLevel}\n🕶 Hacking: ${u.hackingLevel}\n🏠 ${u.apartment}\n🚀 ${u.ship}\n🚨 Wanted: ${u.wanted ? "YES" : "NO"}`;
}

function leaderboardText() {
  const top = Object.values(DB).sort((a, b) => b.xp - a.xp).slice(0, 10);
  let msg = "🏆 LEADERBOARD\n\n";
  top.forEach((u, i) => msg += `${i+1}. ${u.name} — ${u.xp} XP\n\n`);
  msg += "⚔ FACTION POWER\n\n";
  for (const f in WORLD.factions) msg += `${f}: ${WORLD.factions[f]}\n`;
  msg += `\n🔥 Chaos: ${WORLD.chaos}`;
  return msg;
}

async function home(ctx, u) {
  return reply(ctx, homeText(u), homeMenu(u.id, ctx));
}

/* =========================================================
START + REGISTRATION
========================================================= */

bot.start(async (ctx) => {
  const session = resolveSessionFromCtx(ctx);
  if (session) return home(ctx, getUser(session.userId, ctx));

  const u = getUser(ctx.from.id, ctx);
  if (u.registered) return home(ctx, u);

  return reply(ctx,
`🌌 WELCOME TO FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.

Choose your identity.`,
    Markup.inlineKeyboard(CHARACTERS.map(c => [Markup.button.callback(c, "char_" + c)]))
  );
});

bot.action(/char_(.+)/, async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  u.character = ctx.match[1];
  save();
  return reply(ctx, `⚔ Choose Your Faction`, Markup.inlineKeyboard(FACTIONS.map(f => [Markup.button.callback(f, "faction_" + f)])));
});

bot.action(/faction_(.+)/, async (ctx) => {
  await ack(ctx);
  const faction = ctx.match[1];
  if (!FACTIONS.includes(faction)) return;
  const u = getUser(ctx.from.id, ctx);
  u.faction = faction;
  u.registered = true;
  save();
  broadcast(`🌌 ${u.name} joined ${u.faction}`);
  return home(ctx, u);
});

/* =========================================================
GAME ACTIONS
========================================================= */

bot.action("profile", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  return reply(ctx, profileText(u));
});

bot.action("event", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!cooldownOk(u, "event")) return reply(ctx, "⏳ Event cooldown active");

  const e = rand(EVENTS);
  const risk = e.risk + (WORLD.chaos * 0.01);

  if (Math.random() < risk) {
    const loss = 15 + Math.floor(Math.random() * 25);
    u.credits = clamp(u.credits - loss, 0, 999999);
    addChaos(1);
    save();
    return reply(ctx, `💥 EVENT FAILED\n\n${e.title}\n\n-${loss} Credits\n\n🔥 Chaos Increased`);
  }

  u.xp += e.xp;
  u.credits += e.credits;
  addFactionPower(u.faction, e.xp);
  addChaos(e.chaos);
  save();
  return reply(ctx, `⚡ ${e.title}\n\n${e.text}\n\n+${e.xp} XP\n+${e.credits} Credits\n\n🔥 Chaos: ${WORLD.chaos}`);
});

bot.action("mine", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!cooldownOk(u, "mine")) return reply(ctx, "⏳ Mining cooldown active");

  const gain = 15 + Math.floor(Math.random() * 35) + (u.miningLevel * 5);
  u.credits += gain;
  u.xp += 5;

  let msg = `⛏ Mining Operation Successful\n\n+${gain} Credits`;

  if (Math.random() > 0.82) {
    const item = rand(ITEMS);
    u.inventory.push(item);
    msg += `\n\n🎁 Rare Item Found: ${item}`;
  }

  save();
  return reply(ctx, msg);
});

bot.action("crime", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!cooldownOk(u, "crime")) return reply(ctx, "⏳ Crime cooldown active");

  if (Math.random() < 0.45) {
    const loss = 20 + Math.floor(Math.random() * 40);
    u.credits = clamp(u.credits - loss, 0, 999999);
    u.wanted = true;
    save();
    return reply(ctx, `🚔 CRIME FAILED\n\n-${loss} Credits\n\n🚨 You are now WANTED`);
  }

  const gain = 40 + Math.floor(Math.random() * 90);
  u.credits += gain;
  u.reputation += 1;
  addChaos(1);
  save();
  return reply(ctx, `🕶 BLACK MARKET SUCCESS\n\n+${gain} Credits\n+1 Reputation`);
});

bot.action("war", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!cooldownOk(u, "war", 8000)) return reply(ctx, "⏳ War cooldown active");

  const reward = 20 + Math.floor(Math.random() * 50);
  u.xp += reward;
  addFactionPower(u.faction, reward);
  addChaos(2);
  save();
  return reply(ctx, `⚔ FACTION CONFLICT\n\n${u.name} fought for ${u.faction}\n\n+${reward} XP\n\n🔥 Chaos Increased`);
});

bot.action("boss", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!WORLD.boss || !WORLD.boss.active) spawnBoss();

  const dmg = 25 + Math.floor(Math.random() * 50);
  damageBoss(dmg);
  u.xp += 10;
  save();

  const hp = WORLD.boss?.hp || 0;
  return reply(ctx, `🐋 RAID ATTACK\n\n💥 Damage: ${dmg}\n\n❤️ Remaining HP: ${hp}`);
});

bot.action("inventory", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (!u.inventory.length) return reply(ctx, "🎒 Inventory Empty");

  let msg = "🎒 INVENTORY\n\n";
  u.inventory.forEach((item, i) => msg += `${i + 1}. ${item}\n`);
  return reply(ctx, msg);
});

bot.action("market", async (ctx) => {
  await ack(ctx);
  return reply(ctx,
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
  if (u.credits < 50) return reply(ctx, "❌ Not enough credits");
  u.credits -= 50;
  u.energy = clamp(u.energy + 25, 0, CONFIG.MAX_ENERGY);
  save();
  return reply(ctx, "⚡ Energy restored");
});

bot.action("buy_armor", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (u.credits < 100) return reply(ctx, "❌ Not enough credits");
  u.credits -= 100;
  u.hp = clamp(u.hp + 25, 0, CONFIG.MAX_HP);
  save();
  return reply(ctx, "🛡 Armor equipped");
});

bot.action("buy_drill", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (u.credits < 250) return reply(ctx, "❌ Not enough credits");
  u.credits -= 250;
  u.miningLevel += 1;
  save();
  return reply(ctx, `⛏ Mining upgraded\n\nLevel ${u.miningLevel}`);
});

bot.action("buy_home", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (u.credits < 500) return reply(ctx, "❌ Not enough credits");
  u.credits -= 500;
  u.apartment = "Luxury Sky Apartment";
  save();
  return reply(ctx, "🏠 Apartment upgraded");
});

bot.action("daily", async (ctx) => {
  await ack(ctx);
  const u = getUser(ctx.from.id, ctx);
  if (now() - u.lastDaily < CONFIG.DAILY_COOLDOWN) return reply(ctx, "⏳ Daily already claimed");

  u.lastDaily = now();
  u.credits += 100;
  u.xp += 25;
  save();
  return reply(ctx, `🎁 DAILY REWARD\n\n+100 Credits\n+25 XP`);
});

bot.action("leaderboard", async (ctx) => {
  await ack(ctx);
  return reply(ctx, leaderboardText());
});

/* =========================================================
COMMANDS
========================================================= */

bot.command("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  return reply(ctx, profileText(u));
});

bot.command("leaderboard", (ctx) => {
  return reply(ctx, leaderboardText());
});

bot.command("menu", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  return home(ctx, u);
});

bot.command("status", (ctx) => {
  const users = Object.keys(DB).length;
  return reply(ctx,
`🌌 SERVER STATUS

👥 Players: ${users}
🔥 Chaos: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}
🐋 Boss: ${WORLD.boss?.active ? "ACTIVE" : "NONE"}
💾 Save State: ${savePending ? "PENDING" : "SYNCED"}`);
});

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
  WORLD.chaos = amount;
  save();
  return reply(ctx, `🔥 Chaos set to ${amount}`);
});

/* =========================================================
TIMERS
========================================================= */

setInterval(() => {
  if (Math.random() > 0.90) {
    addChaos(1);
    broadcast(rand([
      "🌌 Market instability detected.",
      "📉 A major token collapsed.",
      "🐋 Whale fleets moving through sectors.",
      "⚠ Illegal mining activity rising.",
      "💀 Shadow hackers breached the chain."
    ]));
  }
}, 120000);

setInterval(() => {
  WORLD.marketState = rand(["stable", "bullish", "volatile", "crashing"]);
  save();
}, 300000);

// Energy Regen (Active Users Only)
setInterval(() => {
  cleanupActiveUsers();
  for (const [id] of ACTIVE_USERS) {
    const u = DB[id];
    if (u && u.energy < CONFIG.MAX_ENERGY) {
      u.energy = Math.min(CONFIG.MAX_ENERGY, u.energy + 1);
    }
  }
}, 60000);

// Memory Protection
setInterval(() => {
  const userCount = Object.keys(DB).length;
  if (userCount > 50000) {
    console.log(`⚠️ Large DB detected (${userCount} users), forcing save`);
    save();
  }
}, 60 * 60 * 1000);

/* =========================================================
FALLBACK
========================================================= */

bot.on("message", (ctx) => {
  if (ctx.message.text?.startsWith("/")) return;
  const u = getUser(ctx.from.id, ctx);
  return home(ctx, u);
});

/* =========================================================
LAUNCH
========================================================= */



