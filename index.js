const fs = require("fs");
require("dotenv").config();
const { Telegraf, Markup } = require("telegraf");

const bot = new Telegraf(process.env.BOT_TOKEN);

/* =========================================================
   STORAGE SYSTEM
========================================================= */

const DB_PATH = "./data.json";

let DB = load();

function load() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH));
  } catch {
    return {};
  }
}

let saveLock = false;

function save() {
  if (saveLock) return;

  saveLock = true;

  setTimeout(() => {
    fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2));
    saveLock = false;
  }, 800);
}

/* =========================================================
   WORLD STATE
========================================================= */

let WORLD = {
  season: 1,
  chaosLevel: 1,
  bossActive: false,
  bossHP: 0,
  worldBank: 500000,
  blackMarketLevel: 1,

  factionScore: {
    "HODL Alliance": 0,
    "FOMO Syndicate": 0,
    "Scam Resistance Guild": 0,
    "Whale Empire": 0
  }
};

/* =========================================================
   GAME DATA
========================================================= */

const characters = [
  "FOMO Yodel",
  "Chewstacka",
  "Fan Solo",
  "Darth Fader",
  "Web3PO",
  "Princess Liquidia",
  "Darth Scamius",
  "Jabba the Whale",
  "R2D5",
  "Admiral Grow Bar",
  "Obi FOMO Wannabe",
  "LFG Skytalker",
  "Discount Duko"
];

const factions = [
  "HODL Alliance",
  "FOMO Syndicate",
  "Scam Resistance Guild",
  "Whale Empire"
];

const starterItems = [
  "Rusty Wallet",
  "Broken Mining Rig",
  "Suspicious NFT",
  "Pixel Coin",
  "Meme Fragment"
];

const events = [
  {
    title: "Whale Detected",
    text: "A giant whale manipulates the market.",
    reward: 20,
    chaos: 2
  },
  {
    title: "FOMO Wave",
    text: "Massive FOMO spreads across the galaxy.",
    reward: 15,
    chaos: 1
  },
  {
    title: "Rugpull Alert",
    text: "Dark scammers strike the outer sectors.",
    reward: 25,
    chaos: 3
  },
  {
    title: "Meme Coin Surge",
    text: "A meme coin explodes in popularity.",
    reward: 10,
    chaos: 1
  },
  {
    title: "Quantum Pump",
    text: "A mysterious token pumps 9000%.",
    reward: 40,
    chaos: 4
  }
];

/* =========================================================
   UTILITIES
========================================================= */

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function level(xp) {
  return Math.floor(xp / 100) + 1;
}

function getPower(user) {
  return (
    user.xp +
    user.reputation * 2 +
    user.wins * 10 +
    user.prestige * 100
  );
}

function addFactionScore(faction, amount) {
  if (WORLD.factionScore[faction] !== undefined) {
    WORLD.factionScore[faction] += amount;
  }
}

function addChaos(amount) {
  WORLD.chaosLevel += amount;

  if (WORLD.chaosLevel < 1) {
    WORLD.chaosLevel = 1;
  }

  if (WORLD.chaosLevel > 15 && !WORLD.bossActive) {
    startBoss();
  }
}

/* =========================================================
   THREAD SAFE REPLY SYSTEM
========================================================= */

function reply(ctx, text, extra = {}) {
  const threadId = ctx.message?.message_thread_id;

  return ctx.reply(text, {
    ...extra,
    ...(threadId
      ? {
          message_thread_id: threadId
        }
      : {})
  });
}

/* =========================================================
   PLAYER SYSTEM
========================================================= */

function getUser(id, ctx = null) {
  if (!DB[id]) {
    DB[id] = {
      id,
      name: ctx?.from?.first_name || "Unknown",
      username: ctx?.from?.username || "",
      faction: null,
      character: null,

      xp: 0,
      credits: 100,
      level: 1,

      energy: 100,
      hp: 100,
      reputation: 0,

      inventory: [rand(starterItems)],
      wins: 0,
      losses: 0,

      miningLevel: 1,
      hackingLevel: 1,
      tradingLevel: 1,

      prestige: 0,

      lastDaily: 0,
      lastCrime: 0,
      lastMine: 0,

      apartment: "Cardboard Box",
      ship: "Rust Bucket",

      registered: false
    };
  }

  return DB[id];
}

/* =========================================================
   CHARACTER SELECTION
========================================================= */

bot.start((ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.registered) {
    return mainMenuMessage(ctx, u);
  }

  return reply(
    ctx,
    "🌌 WELCOME TO FOMO YODELVERSE\n\nChoose your character:",
    Markup.inlineKeyboard([
      [Markup.button.callback("🤖 R2D5", "char_R2D5")],
      [Markup.button.callback("🧙 Darth Fader", "char_DarthFader")],
      [Markup.button.callback("🚀 Fan Solo", "char_FanSolo")],
      [Markup.button.callback("🐋 Jabba the Whale", "char_Jabba")],
      [Markup.button.callback("💎 Princess Liquidia", "char_Liquidia")]
    ])
  );
});

bot.action(/char_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const picked = ctx.match[1];

  const map = {
    R2D5: "R2D5",
    DarthFader: "Darth Fader",
    FanSolo: "Fan Solo",
    Jabba: "Jabba the Whale",
    Liquidia: "Princess Liquidia"
  };

  u.character = map[picked];

  save();

  return ctx.reply(
    "⚔ Choose your faction:",
    Markup.inlineKeyboard([
      [Markup.button.callback("🟦 HODL Alliance", "faction_HODL Alliance")],
      [Markup.button.callback("🟥 FOMO Syndicate", "faction_FOMO Syndicate")],
      [Markup.button.callback("🟩 Scam Resistance Guild", "faction_Scam Resistance Guild")],
      [Markup.button.callback("⬛ Whale Empire", "faction_Whale Empire")]
    ])
  );
});

bot.action(/faction_(.+)/, (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  u.faction = ctx.match[1];
  u.registered = true;

  save();

  mainMenuMessage(ctx, u);
});

/* =========================================================
   MAIN MENU
========================================================= */

function mainMenu() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("⚡ EVENT", "menu_event"),
      Markup.button.callback("📊 PROFILE", "menu_profile")
    ],
    [
      Markup.button.callback("⚔ WAR", "menu_war"),
      Markup.button.callback("🐋 BOSS", "menu_boss")
    ],
    [
      Markup.button.callback("⛏ MINE", "menu_mine"),
      Markup.button.callback("🕶 CRIME", "menu_crime")
    ],
    [
      Markup.button.callback("🏪 SHOP", "menu_shop"),
      Markup.button.callback("🎒 INVENTORY", "menu_inventory")
    ],
    [
      Markup.button.callback("🏆 LEADERBOARD", "menu_leaderboard"),
      Markup.button.callback("🎁 DAILY", "menu_daily")
    ]
  ]);
}

function mainMenuMessage(ctx, u) {
  return reply(
    ctx,
    `🌌 FOMO YODELVERSE

👤 ${u.name}
🤖 ${u.character}
⚔ ${u.faction}

⭐ Level: ${level(u.xp)}
💰 Credits: ${u.credits}
⚡ Energy: ${u.energy}
❤️ HP: ${u.hp}

🌍 Chaos Level: ${WORLD.chaosLevel}`,
    mainMenu()
  );
}

/* =========================================================
   PROFILE
========================================================= */

bot.command("profile", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  reply(
    ctx,
    `📊 PROFILE

👤 ${u.name}
🤖 ${u.character}
⚔ ${u.faction}

⭐ Level: ${level(u.xp)}
XP: ${u.xp}

💰 Credits: ${u.credits}
⚡ Energy: ${u.energy}
❤️ HP: ${u.hp}

🏆 Wins: ${u.wins}
💀 Losses: ${u.losses}

⛏ Mining: ${u.miningLevel}
🕶 Hacking: ${u.hackingLevel}
📈 Trading: ${u.tradingLevel}

🏠 Apartment: ${u.apartment}
🚀 Ship: ${u.ship}

🌟 Prestige: ${u.prestige}`
  );
});

/* =========================================================
   EVENTS
========================================================= */

function rollEvent() {
  return rand(events);
}

bot.command("event", (ctx) => {
  runEvent(ctx);
});

bot.action("menu_event", (ctx) => {
  runEvent(ctx);
});

function runEvent(ctx) {
  const u = getUser(ctx.from.id, ctx);

  const e = rollEvent();

  u.xp += e.reward;
  u.credits += Math.floor(e.reward / 2);

  addChaos(e.chaos);
  addFactionScore(u.faction, e.reward);

  save();

  reply(
    ctx,
    `⚡ ${e.title}

${e.text}

+${e.reward} XP
+${Math.floor(e.reward / 2)} Credits

🌍 Chaos: ${WORLD.chaosLevel}`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚔ ATTACK", "attack")],
      [Markup.button.callback("🛡 DEFEND", "defend")],
      [Markup.button.callback("💸 EXPLOIT", "exploit")]
    ])
  );
}

/* =========================================================
   ACTIONS
========================================================= */

bot.action("attack", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const dmg = 15 + Math.floor(Math.random() * 30);

  u.xp += 20;
  u.credits += 15;

  damageBoss(dmg);

  save();

  ctx.reply(`⚔ You attacked chaos

💥 Damage: ${dmg}
+20 XP
+15 Credits`);
});

bot.action("defend", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  u.xp += 10;

  addChaos(-1);

  save();

  ctx.reply(`🛡 Defense successful

Chaos reduced
+10 XP`);
});

bot.action("exploit", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const success = Math.random();

  if (success > 0.7) {
    u.credits -= 20;

    save();

    return ctx.reply("💥 Exploit failed\n-20 credits");
  }

  u.credits += 40;
  u.xp += 15;

  save();

  ctx.reply("💰 Exploit successful\n+40 credits");
});

/* =========================================================
   MINING SYSTEM
========================================================= */

bot.action("menu_mine", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const reward =
    10 +
    Math.floor(Math.random() * 25) +
    u.miningLevel * 5;

  u.credits += reward;
  u.xp += 10;

  if (Math.random() > 0.8) {
    const item = rand([
      "Quantum Ore",
      "Ancient NFT",
      "Dark Token",
      "Meme Crystal"
    ]);

    u.inventory.push(item);

    save();

    return ctx.reply(
      `⛏ Mining Success

+${reward} credits
🎁 Found item: ${item}`
    );
  }

  save();

  ctx.reply(`⛏ Mining Success

+${reward} credits`);
});

/* =========================================================
   CRIME SYSTEM
========================================================= */

bot.action("menu_crime", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const success = Math.random();

  if (success > 0.65) {
    const gain = 30 + Math.floor(Math.random() * 70);

    u.credits += gain;
    u.reputation += 1;

    save();

    return ctx.reply(
      `🕶 Crime Successful

+${gain} credits
+1 reputation`
    );
  }

  const loss = 15 + Math.floor(Math.random() * 30);

  u.credits -= loss;

  if (u.credits < 0) {
    u.credits = 0;
  }

  save();

  ctx.reply(
    `🚔 You got caught

-${loss} credits`
  );
});

/* =========================================================
   SHOP SYSTEM
========================================================= */

bot.action("menu_shop", (ctx) => {
  reply(
    ctx,
    `🏪 BLACK MARKET

1. Energy Drink — 50 credits
2. Nano Armor — 100 credits
3. Quantum Miner — 250 credits
4. Luxury Apartment — 500 credits`,
    Markup.inlineKeyboard([
      [Markup.button.callback("⚡ Buy Energy Drink", "buy_energy")],
      [Markup.button.callback("🛡 Buy Nano Armor", "buy_armor")],
      [Markup.button.callback("⛏ Buy Quantum Miner", "buy_miner")],
      [Markup.button.callback("🏠 Buy Apartment", "buy_home")]
    ])
  );
});

bot.action("buy_energy", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 50) {
    return ctx.reply("Not enough credits");
  }

  u.credits -= 50;
  u.energy += 25;

  save();

  ctx.reply("⚡ Energy restored");
});

bot.action("buy_armor", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 100) {
    return ctx.reply("Not enough credits");
  }

  u.credits -= 100;
  u.hp += 25;

  save();

  ctx.reply("🛡 Nano Armor equipped");
});

bot.action("buy_miner", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 250) {
    return ctx.reply("Not enough credits");
  }

  u.credits -= 250;
  u.miningLevel += 1;

  save();

  ctx.reply("⛏ Mining level upgraded");
});

bot.action("buy_home", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (u.credits < 500) {
    return ctx.reply("Not enough credits");
  }

  u.credits -= 500;
  u.apartment = "Luxury Apartment";

  save();

  ctx.reply("🏠 Apartment upgraded");
});

/* =========================================================
   INVENTORY
========================================================= */

bot.action("menu_inventory", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  if (!u.inventory.length) {
    return ctx.reply("🎒 Inventory empty");
  }

  let text = "🎒 INVENTORY\n\n";

  u.inventory.forEach((item, i) => {
    text += `${i + 1}. ${item}\n`;
  });

  ctx.reply(text);
});

/* =========================================================
   DAILY REWARD
========================================================= */

bot.action("menu_daily", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const now = Date.now();

  if (now - u.lastDaily < 86400000) {
    return ctx.reply("⏳ Daily already claimed");
  }

  u.lastDaily = now;

  u.credits += 100;
  u.xp += 25;

  save();

  ctx.reply(
    "🎁 DAILY REWARD\n\n+100 Credits\n+25 XP"
  );
});

/* =========================================================
   WAR SYSTEM
========================================================= */

bot.command("war", (ctx) => {
  const u = getUser(ctx.from.id, ctx);

  const reward = 20 + Math.floor(Math.random() * 40);

  u.xp += reward;

  addFactionScore(u.faction, reward);

  addChaos(1);

  save();

  reply(
    ctx,
    `⚔ FACTION WAR

${u.name} fought for ${u.faction}

+${reward} XP`
  );
});

bot.action("menu_war", (ctx) => {
  bot.handleUpdate({
    message: {
      ...ctx.callbackQuery.message,
      text: "/war"
    },
    from: ctx.from
  });
});

/* =========================================================
   BOSS SYSTEM
========================================================= */

function startBoss() {
  WORLD.bossActive = true;

  WORLD.bossHP =
    500 + Math.floor(Math.random() * 1000);
}

function damageBoss(amount) {
  if (!WORLD.bossActive) return;

  WORLD.bossHP -= amount;

  if (WORLD.bossHP <= 0) {
    WORLD.bossActive = false;

    for (let id in DB) {
      DB[id].xp += 50;
      DB[id].credits += 50;
    }

    broadcast(
      "🐋 WORLD BOSS DESTROYED\nAll players rewarded"
    );
  }
}

function broadcast(msg) {
  for (let id in DB) {
    bot.telegram
      .sendMessage(id, msg)
      .catch(() => {});
  }
}

bot.command("boss", (ctx) => {
  if (!WORLD.bossActive) {
    startBoss();
  }

  reply(
    ctx,
    `🐋 WORLD BOSS

HP: ${WORLD.bossHP}
Chaos: ${WORLD.chaosLevel}`
  );
});

bot.action("menu_boss", (ctx) => {
  bot.handleUpdate({
    message: {
      ...ctx.callbackQuery.message,
      text: "/boss"
    },
    from: ctx.from
  });
});

/* =========================================================
   DUEL SYSTEM
========================================================= */

bot.command("duel", (ctx) => {
  const parts = ctx.message.text.split(" ");

  if (!parts[1]) {
    return reply(ctx, "Use: /duel userId");
  }

  const a = getUser(ctx.from.id, ctx);
  const b = getUser(parts[1]);

  const powerA = getPower(a) + Math.random() * 100;
  const powerB = getPower(b) + Math.random() * 100;

  const winner = powerA > powerB ? a : b;
  const loser = powerA > powerB ? b : a;

  winner.xp += 30;
  winner.wins += 1;

  loser.losses += 1;

  save();

  reply(
    ctx,
    `⚔ DUEL RESULT

🏆 Winner: ${winner.name}
💀 Loser: ${loser.name}`
  );
});

/* =========================================================
   TRADE SYSTEM
========================================================= */

bot.command("trade", (ctx) => {
  const parts = ctx.message.text.split(" ");

  if (parts.length < 3) {
    return reply(ctx, "Use: /trade userId amount");
  }

  const target = parts[1];
  const amount = parseInt(parts[2]);

  const sender = getUser(ctx.from.id, ctx);
  const receiver = getUser(target);

  if (sender.credits < amount) {
    return reply(ctx, "Not enough credits");
  }

  sender.credits -= amount;
  receiver.credits += amount;

  save();

  reply(
    ctx,
    `💰 Trade Complete

Sent ${amount} credits`
  );
});

/* =========================================================
   GIFT SYSTEM
========================================================= */

bot.command("gift", (ctx) => {
  const parts = ctx.message.text.split(" ");

  if (parts.length < 3) {
    return reply(ctx, "Use: /gift userId amount");
  }

  const target = parts[1];
  const amount = parseInt(parts[2]);

  const sender = getUser(ctx.from.id, ctx);
  const receiver = getUser(target);

  if (sender.credits < amount) {
    return reply(ctx, "Not enough credits");
  }

  sender.credits -= amount;
  receiver.credits += amount;

  sender.xp += 10;
  receiver.xp += 10;

  save();

  reply(
    ctx,
    `🎁 Gift Sent

${amount} credits transferred`
  );
});

/* =========================================================
   LEADERBOARD
========================================================= */

function leaderboard() {
  return Object.values(DB)
    .sort((a, b) => b.xp - a.xp)
    .slice(0, 10);
}

bot.command("leaderboard", (ctx) => {
  const top = leaderboard();

  let msg = "🏆 LEADERBOARD\n\n";

  top.forEach((u, i) => {
    msg += `${i + 1}. ${u.name} — ${u.xp} XP\n`;
  });

  msg += "\n🌍 FACTION POWER\n";

  for (let f in WORLD.factionScore) {
    msg += `${f}: ${WORLD.factionScore[f]}\n`;
  }

  msg += `\n🔥 CHAOS LEVEL: ${WORLD.chaosLevel}`;

  reply(ctx, msg);
});

bot.action("menu_leaderboard", (ctx) => {
  bot.handleUpdate({
    message: {
      ...ctx.callbackQuery.message,
      text: "/leaderboard"
    },
    from: ctx.from
  });
});

bot.action("menu_profile", (ctx) => {
  bot.handleUpdate({
    message: {
      ...ctx.callbackQuery.message,
      text: "/profile"
    },
    from: ctx.from
  });
});

/* =========================================================
   RANDOM WORLD EVENTS
========================================================= */

setInterval(() => {
  if (Math.random() > 0.92) {
    addChaos(1);

    broadcast(
      "🌌 RANDOM WORLD EVENT\nChaos level increased"
    );
  }
}, 120000);

/* =========================================================
   AUTO BOSS SPAWNER
========================================================= */

setInterval(() => {
  if (!WORLD.bossActive && Math.random() > 0.94) {
    startBoss();

    broadcast(
      `🐋 WORLD BOSS HAS APPEARED

HP: ${WORLD.bossHP}`
    );
  }
}, 180000);

/* =========================================================
   SAVE LOOP
========================================================= */

setInterval(save, 15000);

/* =========================================================
   START BOT
========================================================= */

bot.launch();

console.log("🌌 FOMO YODELVERSE RUNNING")
