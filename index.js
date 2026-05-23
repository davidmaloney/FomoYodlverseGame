const fs = require("fs");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

/* =========================================================
   STORAGE
========================================================= */

const DB_PATH = "./data.json";
const WORLD_PATH = "./world.json";

let DB = load(DB_PATH, {});
let WORLD = load(WORLD_PATH, {
  season: 1,
  chaosLevel: 1,
  boss: { active: false, hp: 0, maxHp: 0 },
  factionScore: {
    "HODL Alliance": 0,
    "FOMO Syndicate": 0,
    "Scam Resistance Guild": 0,
    "Whale Empire": 0
  }
});

function load(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return fallback;
  }
}

let saveQueue = new Set();
let saving = false;

function saveAll() {
  saveQueue.add("db");
  saveQueue.add("world");

  if (saving) return;
  saving = true;

  setTimeout(() => {
    if (saveQueue.has("db")) {
      fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
    }
    if (saveQueue.has("world")) {
      fs.writeFileSync(WORLD_PATH, JSON.stringify(WORLD, null, 2));
    }

    saveQueue.clear();
    saving = false;
  }, 800);
}

/* =========================================================
   UTILITIES
========================================================= */

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now();

const COOLDOWNS = {
  event: 5000,
  mine: 8000,
  crime: 10000,
  duel: 0
};

function cdOk(u, key) {
  const k = "cd_" + key;
  if (!u[k] || now() - u[k] > COOLDOWNS[key]) {
    u[k] = now();
    return true;
  }
  return false;
}

function level(xp) {
  return Math.floor(xp / 100) + 1;
}

function power(u) {
  return u.xp + u.wins * 20 + u.prestige * 200 + u.reputation * 5;
}

/* =========================================================
   GAME DATA
========================================================= */

const factions = [
  "HODL Alliance",
  "FOMO Syndicate",
  "Scam Resistance Guild",
  "Whale Empire"
];

const events = [
  { t: "Whale Manipulation", r: 20, c: 2 },
  { t: "FOMO Surge", r: 15, c: 1 },
  { t: "Rugpull Incident", r: 30, c: 3 },
  { t: "Meme Explosion", r: 10, c: 1 },
  { t: "Quantum Pump", r: 40, c: 4 }
];

/* =========================================================
   USER SYSTEM
========================================================= */

function getUser(id, ctx) {
  if (!DB[id]) {
    DB[id] = {
      id,
      name: ctx?.from?.first_name || "Unknown",
      faction: null,
      character: null,
      registered: false,

      xp: 0,
      credits: 100,
      hp: 100,
      energy: 100,

      wins: 0,
      losses: 0,
      reputation: 0,
      prestige: 0,

      inventory: []
    };
  }
  return DB[id];
}

/* =========================================================
   REPLY HELPER (TOPICS SAFE)
========================================================= */

function reply(ctx, text, extra = {}) {
  const threadId = ctx.message?.message_thread_id;
  return ctx.reply(text, {
    ...extra,
    ...(threadId ? { message_thread_id: threadId } : {})
  });
}

/* =========================================================
   ACTION ROUTER (IMPORTANT)
========================================================= */

const actions = {};

function onAction(name, fn) {
  actions[name] = fn;
}

bot.on("callback_query", async (ctx) => {
  const key = ctx.callbackQuery.data;
  if (actions[key]) return actions[key](ctx);
  return ctx.answerCbQuery("Unknown action");
});

/* =========================================================
   START
========================================================= */

bot.start((ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.registered) return mainMenu(ctx, u);

  return reply(
    ctx,
    "🌌 Welcome to Yodelverse\nChoose your faction:",
    Markup.inlineKeyboard(
      factions.map((f) => [
        Markup.button.callback(f, "faction_" + f)
      ])
    )
  );
});

onAction(/faction_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  const f = ctx.callbackQuery.data.replace("faction_", "");

  u.faction = f;
  u.character = "Wanderer";
  u.registered = true;

  saveAll();
  mainMenu(ctx, u);
});

/* =========================================================
   MAIN MENU
========================================================= */

function mainMenu(ctx, u) {
  return reply(
    ctx,
    `🌌 YODELVERSE

${u.name}
⚔ ${u.faction}

XP: ${u.xp}
💰 ${u.credits}
❤️ HP: ${u.hp}
⚡ Energy: ${u.energy}
🔥 Chaos: ${WORLD.chaosLevel}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Event", "event")],
      [Markup.button.callback("⛏ Mine", "mine")],
      [Markup.button.callback("🕶 Crime", "crime")],
      [Markup.button.callback("⚔ Duel Queue", "duel_queue")],
      [Markup.button.callback("🐋 Boss", "boss")],
      [Markup.button.callback("🏆 Leaderboard", "lb")]
    ])
  );
}

/* =========================================================
   EVENTS (BALANCED RISK SYSTEM)
========================================================= */

onAction("event", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "event")) return ctx.answerCbQuery("Cooldown");

  const e = rand(events);

  const risk = Math.random() * WORLD.chaosLevel;

  if (risk > 6) {
    u.credits -= 20;
    u.hp -= 5;
    WORLD.chaosLevel += 1;

    saveAll();

    return reply(ctx, `💥 Disaster Event\n${e.t}\nYou lost resources`);
  }

  u.xp += e.r;
  u.credits += Math.floor(e.r / 2);

  WORLD.chaosLevel += e.c;

  saveAll();

  reply(ctx, `⚡ ${e.t}\n+${e.r} XP`);
});

/* =========================================================
   MINING
========================================================= */

onAction("mine", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "mine")) return ctx.answerCbQuery("Cooldown");

  const gain = 10 + Math.floor(Math.random() * 30);

  if (Math.random() < 0.2) {
    u.hp -= 10;
    u.credits += gain / 2;

    saveAll();
    return reply(ctx, `⛏ Accident!\n+${gain / 2} credits`);
  }

  u.credits += gain;
  u.xp += 5;

  saveAll();
  reply(ctx, `⛏ Mined +${gain}`);
});

/* =========================================================
   CRIME (HIGH RISK)
========================================================= */

onAction("crime", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "crime")) return ctx.answerCbQuery("Cooldown");

  const success = Math.random() < 0.55;

  if (!success) {
    const loss = 20 + Math.floor(Math.random() * 40);
    u.credits = Math.max(0, u.credits - loss);
    u.reputation -= 1;

    saveAll();
    return reply(ctx, `🚔 Caught!\n-${loss}`);
  }

  const gain = 40 + Math.floor(Math.random() * 80);

  u.credits += gain;
  u.reputation += 1;

  saveAll();
  reply(ctx, `🕶 Crime success +${gain}`);
});

/* =========================================================
   DUEL QUEUE (REAL PLAYER INTERACTION)
========================================================= */

let duelQueue = [];

onAction("duel_queue", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (duelQueue.includes(u.id)) {
    duelQueue = duelQueue.filter((x) => x !== u.id);
    return ctx.answerCbQuery("Left queue");
  }

  duelQueue.push(u.id);

  if (duelQueue.length < 2) {
    return ctx.answerCbQuery("Waiting opponent...");
  }

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

  saveAll();

  reply(ctx, `⚔ DUEL\n🏆 ${win.name} defeated ${lose.name}`);
});

/* =========================================================
   BOSS (SHARED WORLD EVENT)
========================================================= */

function startBoss() {
  WORLD.boss.active = true;
  WORLD.boss.maxHp = 800 + Math.floor(Math.random() * 800);
  WORLD.boss.hp = WORLD.boss.maxHp;
}

function hitBoss(dmg) {
  if (!WORLD.boss.active) return;

  WORLD.boss.hp -= dmg;

  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;

    for (let id in DB) {
      DB[id].xp += 50;
      DB[id].credits += 50;
    }

    broadcast("🐋 Boss defeated! Global reward distributed");
  }

  saveAll();
}

function broadcast(msg) {
  for (let id in DB) {
    bot.telegram.sendMessage(id, msg).catch(() => {});
  }
}

onAction("boss", (ctx) => {
  if (!WORLD.boss.active) startBoss();

  const u = getUser(ctx.from.id, ctx);

  const dmg = 20 + Math.floor(Math.random() * 40);
  hitBoss(dmg);

  u.xp += 10;

  saveAll();

  reply(ctx, `🐋 Boss HP: ${WORLD.boss.hp}`);
});

/* =========================================================
   LEADERBOARD
========================================================= */

onAction("lb", (ctx) => {
  const top = Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  let msg = "🏆 Leaderboard\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name} - ${u.xp}\n`;
  });

  msg += `\n🔥 Chaos: ${WORLD.chaosLevel}`;

  reply(ctx, msg);
});

/* =========================================================
   WORLD CHAOS LOOP
========================================================= */

setInterval(() => {
  if (Math.random() > 0.9) {
    WORLD.chaosLevel++;
    broadcast("🌌 Chaos rising...");
    saveAll();
  }
}, 60000);

/* =========================================================
   START
========================================================= */

setInterval(saveAll, 15000);

bot.launch();
console.log("YODELVERSE RUNNING");
