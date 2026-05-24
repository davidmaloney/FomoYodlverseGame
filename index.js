/**
 * =========================================================
 * 🌌 FOMO YODELVERSE — DEFINITIVE EDITION CORE
 * =========================================================
 *
 * Telegram Multiplayer Civilization Game
 * Designed for:
 * - Oracle Free Tier
 * - Single-file maintainability
 * - Telegram groups + topics
 * - Long-term expansion
 *
 * ENGINE GOALS:
 * - Stable
 * - Social
 * - Addictive
 * - Lightweight
 * - Easy to debug
 *
 * =========================================================
 */

const fs = require("fs");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

/* =========================================================
   LAYER 1 — BOT CORE
========================================================= */

const bot = new Telegraf(process.env.BOT_TOKEN);

console.log("🌌 FOMO YODELVERSE ENGINE BOOTING...");

/* =========================================================
   LAYER 2 — CONFIG
========================================================= */

const CONFIG = {
  SAVE_INTERVAL: 15000,
  COOLDOWN: 5000,
  MAX_HP: 100,
  MAX_ENERGY: 100,
  START_CREDITS: 100,
  ADMIN_IDS: (process.env.ADMIN_IDS || "")
    .split(",")
    .filter(Boolean),

  BOSS_MIN_HP: 1000,
  BOSS_MAX_HP: 2500,

  CHAOS_BOSS_TRIGGER: 15,

  BROADCAST_LIMIT: 300,

  DAILY_COOLDOWN: 86400000
};

/* =========================================================
   LAYER 3 — STORAGE
========================================================= */

const DB_FILE = "./data.json";
const WORLD_FILE = "./world.json";

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

  marketState: "stable",

  boss: null,

  factions: {
    HODL: 0,
    FOMO: 0,
    SCAM: 0,
    WHALE: 0
  },

  worldEvent: null,

  lastWorldEvent: 0
});

let dirty = false;

function save() {
  dirty = true;
}

setInterval(() => {
  if (!dirty) return;

  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(DB, null, 2));
    fs.writeFileSync(WORLD_FILE, JSON.stringify(WORLD, null, 2));

    dirty = false;
    console.log("💾 Saved");
  } catch (err) {
    console.log("❌ SAVE ERROR:", err.message);
  }
}, CONFIG.SAVE_INTERVAL);

/* =========================================================
   LAYER 4 — SAFETY SYSTEMS
========================================================= */

process.on("uncaughtException", (err) => {
  console.log("❌ UNCAUGHT ERROR:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ REJECTION:", err);
});

/* =========================================================
   LAYER 5 — UTILITIES
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

function power(u) {
  return (
    u.xp +
    u.wins * 25 +
    u.reputation * 15 +
    u.credits * 0.15 +
    u.prestige * 100
  );
}

function isAdmin(id) {
  return CONFIG.ADMIN_IDS.includes(String(id));
}

/* =========================================================
   LAYER 6 — GAME DATA
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

const ITEMS = [
  "Dark Token",
  "Quantum Ore",
  "Ancient NFT",
  "Meme Crystal",
  "Whale Fragment",
  "Forbidden Ledger"
];

/* =========================================================
   LAYER 7 — THREAD SAFE REPLY
========================================================= */

function reply(ctx, text, extra = {}) {
  const threadId =
    ctx.message?.message_thread_id ||
    ctx.callbackQuery?.message?.message_thread_id;

  return ctx.reply(text, {
    ...extra,
    ...(threadId
      ? { message_thread_id: threadId }
      : {})
  });
}

/* =========================================================
   LAYER 8 — USER SYSTEM
========================================================= */

function getUser(id, ctx = null) {
  if (!DB[id]) {
    DB[id] = {
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

    save();
  }

  return DB[id];
}

/* =========================================================
   LAYER 9 — COOLDOWNS
========================================================= */

function cooldownOk(user, key, ms = CONFIG.COOLDOWN) {
  const last = user.cooldowns[key] || 0;

  if (now() - last < ms) {
    return false;
  }

  user.cooldowns[key] = now();

  return true;
}

/* =========================================================
   LAYER 10 — WORLD ENGINE
========================================================= */

function addChaos(amount) {
  WORLD.chaos += amount;

  if (WORLD.chaos < 1) {
    WORLD.chaos = 1;
  }

  if (
    WORLD.chaos >= CONFIG.CHAOS_BOSS_TRIGGER &&
    (!WORLD.boss || !WORLD.boss.active)
  ) {
    spawnBoss();
  }

  save();
}

function addFactionPower(faction, amount) {
  if (!WORLD.factions[faction]) return;

  WORLD.factions[faction] += amount;

  save();
}

/* =========================================================
   LAYER 11 — BROADCAST SYSTEM
========================================================= */

function broadcast(message) {
  const ids = Object.keys(DB).slice(
    0,
    CONFIG.BROADCAST_LIMIT
  );

  ids.forEach((id) => {
    bot.telegram.sendMessage(id, message).catch(() => {});
  });
}

/* =========================================================
   LAYER 12 — BOSS SYSTEM
========================================================= */

function spawnBoss() {
  WORLD.boss = {
    active: true,

    name: rand([
      "VOID LEVIATHAN",
      "MEGA WHALE",
      "THE RUG EMPEROR",
      "CHAIN DEVOURER"
    ]),

    hp:
      CONFIG.BOSS_MIN_HP +
      Math.floor(
        Math.random() *
          (CONFIG.BOSS_MAX_HP - CONFIG.BOSS_MIN_HP)
      )
  };

  broadcast(
    `🐋 WORLD BOSS SPAWNED\n\n${WORLD.boss.name}\nHP: ${WORLD.boss.hp}`
  );

  save();
}

function damageBoss(amount) {
  if (!WORLD.boss || !WORLD.boss.active) return;

  WORLD.boss.hp -= amount;

  if (WORLD.boss.hp <= 0) {
    WORLD.boss.active = false;

    Object.values(DB).forEach((p) => {
      p.xp += 50;
      p.credits += 50;
    });

    broadcast(
      `🏆 ${WORLD.boss.name} DEFEATED\n\nAll citizens rewarded.`
    );

    WORLD.chaos = clamp(
      WORLD.chaos - 5,
      1,
      999
    );

    save();
  }
}

/* =========================================================
   LAYER 13 — MAIN MENU
========================================================= */

function homeMenu() {
  return Markup.inlineKeyboard([
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
  ]);
}

function home(ctx, u) {
  return reply(
    ctx,
`🌌 FOMO YODELVERSE

👤 ${u.name}
🧬 ${u.character}
⚔ ${u.faction}

⭐ Level: ${level(u.xp)}
💰 Credits: ${u.credits}
❤️ HP: ${u.hp}
⚡ Energy: ${u.energy}

🔥 Chaos Level: ${WORLD.chaos}
🌍 Market: ${WORLD.marketState}

💡 The universe reacts to player actions.`,
    homeMenu()
  );
}

/* =========================================================
   LAYER 14 — START / ONBOARDING
========================================================= */

bot.start((ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.registered) {
    return home(ctx, u);
  }

  reply(
    ctx,
`🌌 WELCOME TO FOMO YODELVERSE

Civilization collapsed after the Great Rugpull.

Four factions now battle for control:
⚔ HODL
⚔ FOMO
⚔ SCAM
⚔ WHALE

Your decisions affect the entire universe.

Choose your identity.`,
    Markup.inlineKeyboard(
      CHARACTERS.map((c) => [
        Markup.button.callback(c, "char_" + c)
      ])
    )
  );
});

/* =========================================================
   LAYER 15 — CHARACTER FLOW
========================================================= */

bot.action(/char_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  u.character = ctx.match[1];

  save();

  reply(
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

bot.action(/faction_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const faction = ctx.match[1];

  if (!FACTIONS.includes(faction)) return;

  u.faction = faction;
  u.registered = true;

  save();

  broadcast(
    `🌌 ${u.name} joined the ${u.faction} faction`
  );

  home(ctx, u);
});

/* =========================================================
   LAYER 16 — PROFILE
========================================================= */

function profileText(u) {
  return `
📊 PROFILE

👤 ${u.name}
🧬 ${u.character}
⚔ ${u.faction}

⭐ Level: ${level(u.xp)}
XP: ${u.xp}

💰 Credits: ${u.credits}

🏆 Wins: ${u.wins}
💀 Losses: ${u.losses}

🌟 Reputation: ${u.reputation}
👑 Prestige: ${u.prestige}

⛏ Mining: ${u.miningLevel}
🕶 Hacking: ${u.hackingLevel}

🏠 ${u.apartment}
🚀 ${u.ship}

🚨 Wanted: ${u.wanted ? "YES" : "NO"}
`;
}

bot.command("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  reply(ctx, profileText(u));
});

bot.action("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  reply(ctx, profileText(u));
});

/* =========================================================
   LAYER 17 — EVENTS
========================================================= */

bot.action("event", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!cooldownOk(u, "event")) {
    return ctx.answerCbQuery("Cooldown active");
  }

  const e = rand(EVENTS);

  const risk = e.risk + WORLD.chaos * 0.01;

  if (Math.random() < risk) {
    const loss = 15 + Math.floor(Math.random() * 25);

    u.credits = clamp(
      u.credits - loss,
      0,
      999999
    );

    addChaos(1);

    save();

    return reply(
      ctx,
`💥 EVENT FAILED

${e.title}

-${loss} Credits
Chaos Increased`
    );
  }

  u.xp += e.xp;
  u.credits += e.credits;

  addFactionPower(u.faction, e.xp);

  addChaos(e.chaos);

  save();

  reply(
    ctx,
`⚡ ${e.title}

${e.text}

+${e.xp} XP
+${e.credits} Credits

🔥 Chaos: ${WORLD.chaos}`
  );
});

/* =========================================================
   LAYER 18 — MINING
========================================================= */

bot.action("mine", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!cooldownOk(u, "mine")) {
    return ctx.answerCbQuery("Cooldown active");
  }

  const gain =
    15 +
    Math.floor(Math.random() * 35) +
    u.miningLevel * 5;

  u.credits += gain;
  u.xp += 5;

  let msg =
    `⛏ Mining Operation Successful\n\n` +
    `+${gain} Credits`;

  if (Math.random() > 0.82) {
    const item = rand(ITEMS);

    u.inventory.push(item);

    msg += `\n🎁 Rare Item Found: ${item}`;
  }

  save();

  reply(ctx, msg);
});

/* =========================================================
   LAYER 19 — CRIME
========================================================= */

bot.action("crime", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!cooldownOk(u, "crime")) {
    return ctx.answerCbQuery("Cooldown active");
  }

  const success = Math.random();

  if (success < 0.45) {
    const loss =
      20 + Math.floor(Math.random() * 40);

    u.credits = clamp(
      u.credits - loss,
      0,
      999999
    );

    u.wanted = true;

    save();

    return reply(
      ctx,
`🚔 CRIME FAILED

Authorities tracked your signal.

-${loss} Credits
🚨 You are now WANTED`
    );
  }

  const gain =
    40 + Math.floor(Math.random() * 90);

  u.credits += gain;
  u.reputation += 1;

  addChaos(1);

  save();

  reply(
    ctx,
`🕶 BLACK MARKET SUCCESS

+${gain} Credits
+1 Reputation

Rumors spread through the galaxy.`
  );
});

/* =========================================================
   LAYER 20 — WAR
========================================================= */

bot.action("war", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!cooldownOk(u, "war", 8000)) {
    return ctx.answerCbQuery("Faction cooldown");
  }

  const reward =
    20 + Math.floor(Math.random() * 50);

  u.xp += reward;

  addFactionPower(u.faction, reward);

  addChaos(2);

  save();

  reply(
    ctx,
`⚔ FACTION CONFLICT

${u.name} fought for ${u.faction}

+${reward} XP

🔥 Chaos Increased`
  );
});

/* =========================================================
   LAYER 21 — BOSS RAID
========================================================= */

bot.action("boss", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!WORLD.boss || !WORLD.boss.active) {
    spawnBoss();
  }

  const dmg =
    25 + Math.floor(Math.random() * 50);

  damageBoss(dmg);

  u.xp += 10;

  save();

  reply(
    ctx,
`🐋 RAID ATTACK

💥 Damage: ${dmg}

Remaining HP:
${Math.max(0, WORLD.boss.hp)}`
  );
});

/* =========================================================
   LAYER 22 — INVENTORY
========================================================= */

bot.action("inventory", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!u.inventory.length) {
    return reply(ctx, "🎒 Inventory Empty");
  }

  let msg = "🎒 INVENTORY\n\n";

  u.inventory.forEach((item, i) => {
    msg += `${i + 1}. ${item}\n`;
  });

  reply(ctx, msg);
});

/* =========================================================
   LAYER 23 — MARKET
========================================================= */

bot.action("market", (ctx) => {
  reply(
    ctx,
`🏪 BLACK MARKET

⚡ Energy Cell — 50
🛡 Nano Armor — 100
⛏ Quantum Drill — 250
🏠 Luxury Apartment — 500`,
    Markup.inlineKeyboard([
      [
        Markup.button.callback(
          "⚡ Buy Energy",
          "buy_energy"
        )
      ],

      [
        Markup.button.callback(
          "🛡 Buy Armor",
          "buy_armor"
        )
      ],

      [
        Markup.button.callback(
          "⛏ Buy Drill",
          "buy_drill"
        )
      ],

      [
        Markup.button.callback(
          "🏠 Buy Apartment",
          "buy_home"
        )
      ]
    ])
  );
});

bot.action("buy_energy", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 50) {
    return reply(ctx, "Not enough credits");
  }

  u.credits -= 50;

  u.energy = clamp(
    u.energy + 25,
    0,
    CONFIG.MAX_ENERGY
  );

  save();

  reply(ctx, "⚡ Energy restored");
});

bot.action("buy_armor", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 100) {
    return reply(ctx, "Not enough credits");
  }

  u.credits -= 100;

  u.hp = clamp(
    u.hp + 25,
    0,
    CONFIG.MAX_HP
  );

  save();

  reply(ctx, "🛡 Armor equipped");
});

bot.action("buy_drill", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 250) {
    return reply(ctx, "Not enough credits");
  }

  u.credits -= 250;

  u.miningLevel += 1;

  save();

  reply(
    ctx,
    `⛏ Mining upgraded to level ${u.miningLevel}`
  );
});

bot.action("buy_home", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 500) {
    return reply(ctx, "Not enough credits");
  }

  u.credits -= 500;

  u.apartment = "Luxury Sky Apartment";

  save();

  reply(
    ctx,
    "🏠 Your social status increased"
  );
});

/* =========================================================
   LAYER 24 — DAILY REWARD
========================================================= */

bot.action("daily", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (
    now() - u.lastDaily <
    CONFIG.DAILY_COOLDOWN
  ) {
    return reply(
      ctx,
      "⏳ Daily reward already claimed"
    );
  }

  u.lastDaily = now();

  u.credits += 100;
  u.xp += 25;

  save();

  reply(
    ctx,
`🎁 DAILY REWARD

+100 Credits
+25 XP`
  );
});

/* =========================================================
   LAYER 25 — LEADERBOARD
========================================================= */

bot.action("leaderboard", (ctx) => {
  const top = Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);

  let msg = "🏆 LEADERBOARD\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name} — ${u.xp} XP\n`;
  });

  msg += `\n⚔ FACTION POWER\n`;

  for (let f in WORLD.factions) {
    msg += `${f}: ${WORLD.factions[f]}\n`;
  }

  msg += `\n🔥 Chaos: ${WORLD.chaos}`;

  reply(ctx, msg);
});

/* =========================================================
   LAYER 26 — ADMIN TOOLS
========================================================= */

bot.command("broadcast", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  const msg = ctx.message.text.replace(
    "/broadcast",
    ""
  );

  broadcast(`📢 ADMIN ALERT\n\n${msg}`);

  reply(ctx, "Broadcast sent");
});

bot.command("spawnboss", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  spawnBoss();

  reply(ctx, "Boss spawned");
});

bot.command("chaos", (ctx) => {
  if (!isAdmin(ctx.from.id)) return;

  const amount = parseInt(
    ctx.message.text.split(" ")[1]
  );

  if (isNaN(amount)) {
    return reply(ctx, "Use: /chaos number");
  }

  WORLD.chaos = amount;

  save();

  reply(
    ctx,
    `Chaos level set to ${amount}`
  );
});

/* =========================================================
   LAYER 27 — RANDOM WORLD EVENTS
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
   LAYER 28 — AUTO MARKET SHIFTS
========================================================= */

setInterval(() => {
  WORLD.marketState = rand([
    "stable",
    "bullish",
    "volatile",
    "crashing"
  ]);

  save();
}, 300000);

/* =========================================================
   LAYER 29 — COMMAND SHORTCUTS
========================================================= */

bot.command("menu", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  home(ctx, u);
});

bot.command("leaderboard", (ctx) => {
  bot.handleUpdate({
    message: {
      ...ctx.message,
      text: "leaderboard"
    },
    from: ctx.from
  });
});

/* =========================================================
   LAYER 30 — START ENGINE
========================================================= */

bot.launch();

console.log("🚀 FOMO YODELVERSE ONLINE");

/* =========================================================
   END OF FILE
========================================================= */
