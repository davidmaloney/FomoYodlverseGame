**
 * =========================================================
 * 🌌 YODELVERSE V6 — FULL SOCIAL MMO ENGINE (SINGLE FILE)
 * Telegram Multiplayer RPG / Strategy / Chaos Simulator
 * =========================================================
 */

const fs = require("fs");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

/* =========================================================
   PERFORMANCE SAFE STORAGE (Oracle VPS FRIENDLY)
========================================================= */

const DB_PATH = "./data.json";
const WORLD_PATH = "./world.json";

function load(path, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path));
  } catch {
    return fallback;
  }
}

let DB = load(DB_PATH, {});
let WORLD = load(WORLD_PATH, {
  season: 1,
  chaos: 1,
  story: "AWAKENING",

  boss: { active: false, hp: 0, maxHp: 0 },

  guilds: {},
  territories: {
    "Crypto Desert": { owner: null, power: 10 },
    "Whale Sea": { owner: null, power: 20 },
    "Scam Wastes": { owner: null, power: 30 },
    "HODL Citadel": { owner: null, power: 50 }
  },

  economy: {
    inflation: 1,
    taxPool: 0
  }
});

let saveQueued = false;

function saveAll() {
  if (saveQueued) return;
  saveQueued = true;

  setTimeout(() => {
    fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
    fs.writeFileSync(WORLD_PATH, JSON.stringify(WORLD, null, 2));
    saveQueued = false;
  }, 700);
}

/* =========================================================
   CORE UTILITIES
========================================================= */

const rand = (a) => a[Math.floor(Math.random() * a.length)];
const now = () => Date.now();

function level(xp) {
  return Math.floor(xp / 100) + 1;
}

function power(u) {
  return u.xp + u.wins * 25 + u.reputation * 10 + u.prestige * 200;
}

/* =========================================================
   COOLDOWNS (ANTI-SPAM + GAME BALANCE)
========================================================= */

const CD = {
  event: 5000,
  mine: 7000,
  crime: 9000,
  duel: 5000,
  war: 8000,
  boss: 8000
};

function cdOk(u, key) {
  const k = "cd_" + key;
  if (!u[k] || now() - u[k] > CD[key]) {
    u[k] = now();
    return true;
  }
  return false;
}

/* =========================================================
   USER MODEL (EXPANDABLE PLAYER STATE)
========================================================= */

function getUser(id, ctx) {
  if (!DB[id]) {
    DB[id] = {
      id,
      name: ctx?.from?.first_name || "Unknown",

      faction: null,
      guild: null,
      registered: false,

      xp: 0,
      credits: 100,
      hp: 100,
      energy: 100,

      wins: 0,
      losses: 0,
      reputation: 0,
      prestige: 0,

      inventory: ["Rusty Wallet"],

      tutorial: 0,

      lastActionHint: 0
    };
  }
  return DB[id];
}

/* =========================================================
   SAFE REPLY (TELEGRAM THREAD SUPPORT)
========================================================= */

function reply(ctx, text, extra = {}) {
  const threadId = ctx.message?.message_thread_id;

  return ctx.reply(text, {
    ...extra,
    ...(threadId ? { message_thread_id: threadId } : {})
  });
}

/* =========================================================
   ACTION ROUTER (SCALABLE EVENT SYSTEM)
========================================================= */

const actions = {};

function on(name, fn) {
  actions[name] = fn;
}

bot.on("callback_query", (ctx) => {
  const key = ctx.callbackQuery.data;

  if (actions[key]) return actions[key](ctx);

  if (key.startsWith("f_")) return factionSelect(ctx);
  if (key.startsWith("g_")) return guildRouter(ctx);

  return ctx.answerCbQuery("Unknown action");
});

/* =========================================================
   ONBOARDING (CRITICAL UX LAYER)
========================================================= */

bot.start((ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.registered) return mainMenu(ctx, u);

  return reply(
    ctx,
    "🌌 Welcome to YODELVERSE\n\nStep 1: Choose your faction (this defines your world alignment)",
    Markup.inlineKeyboard([
      [Markup.button.callback("HODL Alliance", "f_HODL")],
      [Markup.button.callback("FOMO Syndicate", "f_FOMO")],
      [Markup.button.callback("Scam Resistance", "f_SCAM")],
      [Markup.button.callback("Whale Empire", "f_WHALE")]
    ])
  );
});

function factionSelect(ctx) {
  const u = getUser(ctx.from.id, ctx);

  const map = {
    f_HODL: "HODL Alliance",
    f_FOMO: "FOMO Syndicate",
    f_SCAM: "Scam Resistance Guild",
    f_WHALE: "Whale Empire"
  };

  u.faction = map[ctx.callbackQuery.data];
  u.registered = true;

  saveAll();

  return mainMenu(ctx, u);
}

/* =========================================================
   MAIN MENU (PLAYER HUB)
========================================================= */

function mainMenu(ctx, u) {
  return reply(
    ctx,
    `🌌 YODELVERSE STATUS

👤 ${u.name}
⚔ Faction: ${u.faction}
🏰 Guild: ${u.guild || "None"}

⭐ Level: ${level(u.xp)} (${u.xp} XP)
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}
⚡ Energy: ${u.energy}

🌍 Global Chaos: ${WORLD.chaos}
📖 Story Phase: ${WORLD.story}

👉 Tip: Start with EVENT or join a GUILD for real power`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback("⚡ Event", "event"),
        Markup.button.callback("🏰 Guild", "guild")
      ],
      [
        Markup.button.callback("⚔ Duel", "duel"),
        Markup.button.callback("🌍 War", "war")
      ],
      [
        Markup.button.callback("⛏ Mine", "mine"),
        Markup.button.callback("🕶 Crime", "crime")
      ],
      [
        Markup.button.callback("🐋 Boss Raid", "boss"),
        Markup.button.callback("🏆 Leaderboard", "lb")
      ]
    ])
  );
}

/* =========================================================
   EVENTS (CORE GAME LOOP)
========================================================= */

on("event", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "event")) return ctx.answerCbQuery("Cooldown active");

  const events = [
    { name: "Whale Market Shift", xp: 20 },
    { name: "FOMO Spike", xp: 15 },
    { name: "Rugpull Crisis", xp: 30 },
    { name: "Meme Coin Explosion", xp: 25 }
  ];

  const e = rand(events);

  const risk = Math.random() * WORLD.chaos;

  if (risk > 8) {
    u.credits = Math.max(0, u.credits - 20);
    u.hp -= 5;
    WORLD.chaos++;

    saveAll();

    return reply(ctx, `💥 Disaster Event\n${e.name}\nYou barely survived.`);
  }

  u.xp += e.xp;
  u.credits += Math.floor(e.xp / 2);
  WORLD.chaos++;

  saveAll();

  reply(ctx, `⚡ ${e.name}\n+${e.xp} XP`);
});

/* =========================================================
   MINE SYSTEM (RISK/REWARD LOOP)
========================================================= */

on("mine", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "mine")) return ctx.answerCbQuery("Cooldown");

  const gain = 10 + Math.random() * 30;

  if (Math.random() < 0.2) {
    u.hp -= 10;
    u.credits += gain / 2;

    saveAll();
    return reply(ctx, `⛏ Mining accident!\nRecovered partial resources.`);
  }

  u.credits += gain;
  u.xp += 5;

  saveAll();

  reply(ctx, `⛏ Mining success\n+${Math.floor(gain)} credits`);
});

/* =========================================================
   CRIME SYSTEM (HIGH RISK ECONOMY LOOP)
========================================================= */

on("crime", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "crime")) return ctx.answerCbQuery("Cooldown");

  const success = Math.random() < 0.55;

  if (!success) {
    const loss = 20 + Math.random() * 40;
    u.credits = Math.max(0, u.credits - loss);
    u.reputation--;

    saveAll();
    return reply(ctx, `🚔 Caught!\n-${Math.floor(loss)} credits`);
  }

  const gain = 40 + Math.random() * 80;

  u.credits += gain;
  u.reputation++;

  saveAll();

  reply(ctx, `🕶 Crime successful\n+${Math.floor(gain)} credits`);
});

/* =========================================================
   DUEL SYSTEM (PLAYER VS PLAYER)
========================================================= */

on("duel", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const opponent = rand(Object.values(DB).filter(x => x.id !== u.id));
  if (!opponent) return ctx.reply("No opponent found");

  const a = power(u) + Math.random() * 50;
  const b = power(opponent) + Math.random() * 50;

  const winner = a > b ? u : opponent;

  winner.xp += 30;
  winner.wins++;

  saveAll();

  reply(ctx, `⚔ Duel Result\n🏆 ${winner.name} wins`);
});

/* =========================================================
   GUILD SYSTEM (SOCIAL PROGRESSION LAYER)
========================================================= */

function guildRouter(ctx) {
  const u = getUser(ctx.from.id, ctx);

  if (!u.guild) {
    return reply(
      ctx,
      "🏰 No guild yet — create or join",
      Markup.inlineKeyboard([
        [Markup.button.callback("Create Guild", "g_create")],
        [Markup.button.callback("Join Guild", "g_join")]
      ])
    );
  }

  const g = WORLD.guilds[u.guild];

  return reply(
    ctx,
    `🏰 ${u.guild}

Members: ${g.members.length}
Power: ${g.power}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("Contribute XP", "g_contrib")]
    ])
  );
}

on("g_create", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const name = `Guild-${u.id}`;

  WORLD.guilds[name] = {
    owner: u.id,
    members: [u.id],
    power: 10
  };

  u.guild = name;

  saveAll();
  reply(ctx, `🏰 Guild created: ${name}`);
});

on("g_join", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const g = Object.keys(WORLD.guilds)[0];
  if (!g) return reply(ctx, "No guilds exist");

  WORLD.guilds[g].members.push(u.id);
  u.guild = g;

  saveAll();
  reply(ctx, `🏰 Joined ${g}`);
});

on("g_contrib", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const g = WORLD.guilds[u.guild];
  g.power += u.xp * 0.01;

  saveAll();

  reply(ctx, "🏰 Guild strengthened");
});

/* =========================================================
   TERRITORY WARFARE
========================================================= */

on("war", (ctx) => {
  const u = getUser(ctx.from.id, ctx);
  if (!cdOk(u, "war")) return ctx.answerCbQuery("Cooldown");

  const target = rand(Object.keys(WORLD.territories));
  const t = WORLD.territories[target];

  const score = power(u) + Math.random() * 50;

  if (score > t.power) {
    t.owner = u.faction;
    t.power = score;

    WORLD.chaos++;

    reply(ctx, `⚔ ${u.faction} captured ${target}`);
  } else {
    reply(ctx, `⚔ Attack failed on ${target}`);
  }

  saveAll();
});

/* =========================================================
   BOSS RAID (GLOBAL COOP EVENT)
========================================================= */

function startBoss() {
  WORLD.boss.active = true;
  WORLD.boss.maxHp = 1000;
  WORLD.boss.hp = 1000;
}

on("boss", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!WORLD.boss.active) startBoss();

  const dmg = 20 + Math.random() * 40;
  WORLD.boss.hp -= dmg;

  u.xp += 10;

  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;

    Object.values(DB).forEach(p => {
      p.xp += 50;
      p.credits += 50;
    });

    broadcast("🐋 WORLD BOSS DEFEATED");
  }

  saveAll();

  reply(ctx, `🐋 Boss HP: ${Math.max(0, WORLD.boss.hp).toFixed(0)}`);
});

function broadcast(msg) {
  for (let id in DB) {
    bot.telegram.sendMessage(id, msg).catch(() => {});
  }
}

/* =========================================================
   LEADERBOARD
========================================================= */

on("lb", (ctx) => {
  const top = Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  let msg = "🏆 Leaderboard\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name} - ${u.xp} XP\n`;
  });

  msg += `\n🌍 Chaos: ${WORLD.chaos}`;

  reply(ctx, msg);
});

/* =========================================================
   WORLD EVOLUTION LOOP (LIGHTWEIGHT SIMULATION)
========================================================= */

setInterval(() => {
  if (Math.random() > 0.9) {
    WORLD.chaos++;

    if (WORLD.chaos > 10) WORLD.story = "WAR ERA";

    broadcast("🌌 The galaxy shifts...");
    saveAll();
  }
}, 60000);

/* =========================================================
   SAVE LOOP
========================================================= */

setInterval(saveAll, 15000);

/* =========================================================
   START SERVER
========================================================= */

bot.launch();
console.log("🌌 YODELVERSE V6 ONLINE")
