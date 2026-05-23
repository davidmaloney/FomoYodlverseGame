* =========================================================
 * YODELVERSE REBORN V6 — STABLE MULTIPLAYER CORE
 * =========================================================
 */

const fs = require("fs");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

/* =========================================================
   CONFIG
========================================================= */

const DB_FILE = "./data.json";
const WORLD_FILE = "./world.json";

const CONFIG = {
  SAVE_INTERVAL: 15000,
  COOLDOWN: 4000,
  MAX_BOSS_HP: 2000,
  ADMIN_IDS: (process.env.ADMIN_IDS || "").split(",").filter(Boolean),
  BROADCAST_LIMIT: 200 // prevents CPU spikes
};

/* =========================================================
   STORAGE
========================================================= */

function load(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return fallback;
  }
}

let DB = load(DB_FILE, {});
let WORLD = load(WORLD_FILE, {
  season: 1,
  chaos: 1,

  boss: null,

  factions: {
    HODL: 0,
    FOMO: 0,
    SCAM: 0,
    WHALE: 0
  }
});

let dirty = false;

function save() {
  dirty = true;
}

setInterval(() => {
  if (!dirty) return;
  fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
  fs.writeFileSync(WORLD_FILE, JSON.stringify(WORLD, null, 2));
  dirty = false;
}, CONFIG.SAVE_INTERVAL);

/* =========================================================
   UTILITIES
========================================================= */

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now();

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/* =========================================================
   GAME DATA
========================================================= */

const CHARACTERS = [
  "R2D5",
  "Darth Fader",
  "Fan Solo",
  "Jabba the Whale",
  "Princess Liquidia"
];

const FACTIONS = ["HODL", "FOMO", "SCAM", "WHALE"];

const EVENTS = [
  { name: "Whale Manipulation", xp: 20, chaos: 2, risk: 0.2 },
  { name: "Meme Surge", xp: 15, chaos: 1, risk: 0.1 },
  { name: "Rugpull Alert", xp: 30, chaos: 3, risk: 0.35 },
  { name: "Quantum Pump", xp: 40, chaos: 4, risk: 0.4 }
];

/* =========================================================
   USER SYSTEM
========================================================= */

function getUser(id, ctx) {
  if (!DB[id]) {
    DB[id] = {
      id,
      name: ctx?.from?.first_name || "Player",

      registered: false,
      character: null,
      faction: null,

      xp: 0,
      credits: 100,
      hp: 100,
      energy: 100,

      wins: 0,
      losses: 0,
      reputation: 0,

      cooldowns: {},

      partyId: null
    };
  }
  return DB[id];
}

/* =========================================================
   REPLY SAFETY
========================================================= */

function reply(ctx, text, extra = {}) {
  const threadId = ctx.message?.message_thread_id;
  return ctx.reply(text, {
    ...extra,
    ...(threadId ? { message_thread_id: threadId } : {})
  });
}

/* =========================================================
   COOLDOWNS
========================================================= */

function cdOk(u, key, time = CONFIG.COOLDOWN) {
  const last = u.cooldowns[key] || 0;
  if (now() - last < time) return false;
  u.cooldowns[key] = now();
  return true;
}

/* =========================================================
   POWER SYSTEM
========================================================= */

function power(u) {
  return (
    u.xp +
    u.wins * 25 +
    u.reputation * 10 +
    u.credits * 0.1 +
    u.hp
  );
}

/* =========================================================
   START
========================================================= */

bot.start((ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.registered) return home(ctx, u);

  return reply(
    ctx,
    "🌌 YODELVERSE REBORN\nChoose your character:",
    Markup.inlineKeyboard(
      CHARACTERS.map(c => [Markup.button.callback(c, "char_" + c)])
    )
  );
});

/* =========================================================
   CHARACTER + FACTION
========================================================= */

bot.action(/char_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  u.character = ctx.match[1];

  return reply(
    ctx,
    "Choose your faction:",
    Markup.inlineKeyboard(
      FACTIONS.map(f => [Markup.button.callback(f, "f_" + f)])
    )
  );
});

bot.action(/f_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const faction = ctx.match[1];
  if (!FACTIONS.includes(faction)) return;

  u.faction = faction;
  u.registered = true;

  save();
  home(ctx, u);
});

/* =========================================================
   HOME UI
========================================================= */

function home(ctx, u) {
  return reply(
    ctx,
`🌌 YODELVERSE

👤 ${u.name}
⚔ ${u.faction}
🧬 ${u.character}

⭐ XP: ${u.xp}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}
⚡ Energy: ${u.energy}

🔥 Chaos: ${WORLD.chaos}

💡 Tip: Events are risky but rewarding.`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Event", "event"), Markup.button.callback("⛏ Mine", "mine")],
      [Markup.button.callback("🕶 Crime", "crime"), Markup.button.callback("⚔ Duel", "duel")],
      [Markup.button.callback("🐋 Boss", "boss"), Markup.button.callback("🏆 LB", "lb")],
      [Markup.button.callback("👥 Party", "party")]
    ])
  );
}

/* =========================================================
   EVENTS
========================================================= */

bot.action("event", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "event")) return ctx.answerCbQuery("Cooldown");

  const e = rand(EVENTS);
  const risk = WORLD.chaos * e.risk;

  if (Math.random() < risk) {
    u.credits = Math.max(0, u.credits - 20);
    u.hp = Math.max(1, u.hp - 5);
    WORLD.chaos++;

    save();
    return reply(ctx, `💥 Failed Event: ${e.name}\nLoss incurred.`);
  }

  u.xp += e.xp;
  u.credits += Math.floor(e.xp / 2);
  WORLD.chaos += e.chaos;

  save();
  reply(ctx, `⚡ ${e.name}\n+${e.xp} XP`);
});

/* =========================================================
   MINE (FIXED BUG)
========================================================= */

bot.action("mine", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "mine")) return ctx.answerCbQuery("Cooldown");

  const gain = 10 + Math.floor(Math.random() * 40);

  if (Math.random() < 0.15) {
    u.hp -= 8;
    u.credits += Math.floor(gain / 2); // FIXED BUG

    save();
    return reply(ctx, `⛏ Accident!\n+${Math.floor(gain/2)} credits\n-HP damage`);
  }

  u.credits += gain;
  u.xp += 5;

  save();
  reply(ctx, `⛏ Mined +${gain}`);
});

/* =========================================================
   CRIME
========================================================= */

bot.action("crime", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "crime")) return ctx.answerCbQuery("Cooldown");

  if (Math.random() < 0.45) {
    const loss = 20 + Math.floor(Math.random() * 50);
    u.credits = Math.max(0, u.credits - loss);
    u.reputation = Math.max(-10, u.reputation - 1);

    save();
    return reply(ctx, `🚔 Caught!\n-${loss}`);
  }

  const gain = 40 + Math.floor(Math.random() * 90);
  u.credits += gain;
  u.reputation++;

  save();
  reply(ctx, `🕶 Success +${gain}`);
});

/* =========================================================
   DUEL
========================================================= */

const duelQueue = [];

bot.action("duel", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (duelQueue.includes(u.id)) {
    duelQueue.splice(duelQueue.indexOf(u.id), 1);
    return ctx.answerCbQuery("Left queue");
  }

  duelQueue.push(u.id);

  if (duelQueue.length < 2) return ctx.answerCbQuery("Waiting...");

  const a = getUser(duelQueue.shift());
  const b = getUser(duelQueue.shift());

  const wa = power(a) + Math.random() * 100;
  const wb = power(b) + Math.random() * 100;

  const win = wa > wb ? a : b;
  const lose = wa > wb ? b : a;

  win.wins++;
  lose.losses++;

  win.xp += 30;
  lose.xp += 10;

  save();
  reply(ctx, `⚔ ${win.name} defeated ${lose.name}`);
});

/* =========================================================
   BOSS (SAFE)
========================================================= */

function spawnBoss() {
  WORLD.boss = {
    active: true,
    hp: clamp(1000 + Math.random() * 800, 600, CONFIG.MAX_BOSS_HP)
  };
}

bot.action("boss", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!WORLD.boss || !WORLD.boss.active) spawnBoss();

  const dmg = 20 + Math.floor(Math.random() * 40);
  WORLD.boss.hp -= dmg;
  u.xp += 10;

  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;

    Object.values(DB).forEach(p => {
      p.xp += 50;
      p.credits += 50;
    });

    broadcast("🐋 Boss defeated!");
  }

  save();
  reply(ctx, `🐋 Boss HP: ${Math.max(0, WORLD.boss.hp)}`);
});

/* =========================================================
   PARTY (FIXED MINIMAL FUNCTIONALITY)
========================================================= */

const parties = {};

bot.action("party", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!u.partyId) {
    const id = "p_" + Math.floor(Math.random() * 99999);
    parties[id] = { members: [u.id] };
    u.partyId = id;

    save();
    return reply(ctx, `👥 Party created: ${id}`);
  }

  const p = parties[u.partyId];
  reply(ctx, `👥 Members: ${p.members.length}`);
});

/* =========================================================
   LEADERBOARD
========================================================= */

bot.action("lb", (ctx) => {
  const top = Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  let msg = "🏆 LEADERBOARD\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name} (${u.xp})\n`;
  });

  reply(ctx, msg);
});

/* =========================================================
   BROADCAST (SAFE LIMIT)
========================================================= */

function broadcast(msg) {
  Object.keys(DB).slice(0, CONFIG.BROADCAST_LIMIT).forEach(id => {
    bot.telegram.sendMessage(id, msg).catch(() => {});
  });
}

/* =========================================================
   LOOP
========================================================= */

setInterval(() => {
  if (Math.random() > 0.92) {
    WORLD.chaos++;
    broadcast("🌌 Chaos rises...");
    save();
  }
}, 60000);

/* =========================================================
   START
========================================================= */

bot.launch();
console.log("🚀 YODELVERSE V6 STABLE RUNNING");
