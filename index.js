const fs = require("fs")
require("dotenv").config()
const { Telegraf, Markup } = require("telegraf")

const bot = new Telegraf(process.env.BOT_TOKEN)

/* ================= STORAGE ================= */

const DB_PATH = "./data.json"
let DB = load()

function load() {
 try {
   return JSON.parse(fs.readFileSync(DB_PATH))
 } catch {
   return {}
 }
}

let saveLock = false
function save() {
 if (saveLock) return
 saveLock = true
 setTimeout(() => {
   fs.writeFileSync(DB_PATH, JSON.stringify(DB, null, 2))
   saveLock = false
 }, 800)
}

/* ================= WORLD STATE ================= */

let WORLD = {
 bossHP: 0,
 bossActive: false,
 season: 1,
 seasonStart: Date.now(),
 factionScore: {
   "HODL Alliance": 0,
   "FOMO Syndicate": 0,
   "Scam Resistance Guild": 0,
   "Whale Empire": 0
 }
}

/* ================= GAME DATA ================= */

const characters = [
 "FOMO Yodel","Chewstacka","Fan Solo","Darth Fader","Web3PO",
 "Princess Liquidia","Darth Scamius","Jabba the Whale","R2D5",
 "Admiral Grow Bar","Obi FOMO Wannabe","LFG Skytalker","Discount Duko"
]

const factions = [
 "HODL Alliance",
 "FOMO Syndicate",
 "Scam Resistance Guild",
 "Whale Empire"
]

const events = [
 "Market chaos erupts",
 "A whale manipulates liquidity",
 "FOMO wave spreads globally",
 "Rugpull attempted in dark zone",
 "Meme energy surge detected",
 "Blockchain anomaly discovered"
]

/* ================= USER ================= */

function getUser(id, ctx) {
 if (!DB[id]) {
   DB[id] = {
     name: ctx?.from?.first_name || "Unknown",
     username: ctx?.from?.username || "",
     character: characters[Math.floor(Math.random() * characters.length)],
     faction: factions[Math.floor(Math.random() * factions.length)],
     xp: 0,
     credits: 100,
     inventory: [],
     referrals: 0,
     lastDaily: 0
   }
 }
 return DB[id]
}

function level(xp) {
 return Math.floor(xp / 100) + 1
}

/* ================= LEADERBOARD ================= */

function leaderboard() {
 return Object.entries(DB)
   .map(([id, u]) => ({ id, ...u }))
   .sort((a, b) => b.xp - a.xp)
   .slice(0, 10)
}

/* ================= WORLD HELPERS ================= */

function addFactionScore(faction, amount) {
 if (WORLD.factionScore[faction] !== undefined) {
   WORLD.factionScore[faction] += amount
 }
}

/* ================= BOSS SYSTEM ================= */

function startBoss() {
 WORLD.bossActive = true
 WORLD.bossHP = 300 + Math.floor(Math.random() * 500)
}

function damageBoss(amount) {
 if (!WORLD.bossActive) return

 WORLD.bossHP -= amount

 if (WORLD.bossHP <= 0) {
   WORLD.bossActive = false
   broadcast("🐋 WORLD BOSS DEFEATED! Bonus XP for all players!")

   for (let id in DB) {
     DB[id].xp += 20
   }
 }
}

function broadcast(msg, threadId = null) {
 for (let id in DB) {
   bot.telegram.sendMessage(id, msg, threadId ? { message_thread_id: threadId } : {})
     .catch(() => {})
 }
}

/* ================= EVENTS ================= */

function eventRoll() {
 return events[Math.floor(Math.random() * events.length)]
}

/* ================= SAFE REPLY WRAPPER (NEW) ================= */

function reply(ctx, text, extra = {}) {
 const threadId = ctx.message?.message_thread_id

 if (threadId) {
   return ctx.reply(text, {
     ...extra,
     message_thread_id: threadId
   })
 }

 return ctx.reply(text, extra)
}

/* ================= START ================= */

bot.start((ctx) => {
 const u = getUser(ctx.from.id, ctx)
 save()

 reply(ctx,
   `🌌 FOMO YODELVERSE\n\n` +
   `${u.name}${u.username ? " (@" + u.username + ")" : ""}\n` +
   `Character: ${u.character}\n` +
   `Faction: ${u.faction}\n` +
   `Level: ${level(u.xp)}\n\n` +
   `Commands:\n/event /profile /war /boss /trade /gift /duel /leaderboard`
 )
})

/* ================= PROFILE ================= */

bot.command("profile", (ctx) => {
 const u = getUser(ctx.from.id, ctx)

 reply(ctx,
   `📊 PROFILE\n\n` +
   `${u.name}${u.username ? " (@" + u.username + ")" : ""}\n` +
   `Character: ${u.character}\n` +
   `Faction: ${u.faction}\n` +
   `Level: ${level(u.xp)}\n` +
   `XP: ${u.xp}\n` +
   `Credits: ${u.credits}`
 )
})

/* ================= EVENT ================= */

bot.command("event", (ctx) => {
 const u = getUser(ctx.from.id, ctx)

 const e = eventRoll()

 u.xp += 10
 u.credits += 5
 addFactionScore(u.faction, 5)

 save()

 reply(ctx,
   "⚡ EVENT\n\n" + e,
   Markup.inlineKeyboard([
     [Markup.button.callback("⚔ FIGHT", "fight")],
     [Markup.button.callback("🛡 HODL", "hodl")],
     [Markup.button.callback("💸 SELL", "sell")]
   ])
 )
})

/* ================= ACTIONS ================= */

bot.action("fight", (ctx) => {
 const u = getUser(ctx.from.id, ctx)

 const dmg = 10 + Math.floor(Math.random() * 25)

 u.xp += 20
 u.credits += 10

 addFactionScore(u.faction, 10)
 damageBoss(dmg)

 save()

 ctx.reply(`⚔️ You fought chaos (boss dmg: ${dmg})`)
})

bot.action("hodl", (ctx) => {
 const u = getUser(ctx.from.id, ctx)
 u.xp += 10
 addFactionScore(u.faction, 5)
 save()
 ctx.reply("💎 HODL rewarded")
})

bot.action("sell", (ctx) => {
 const u = getUser(ctx.from.id, ctx)
 u.xp -= 5
 save()
 ctx.reply("📉 Panic sell")
})

/* ================= WAR ================= */

bot.command("war", (ctx) => {
 const u = getUser(ctx.from.id, ctx)

 u.xp += 15
 addFactionScore(u.faction, 15)

 save()

 reply(ctx, `⚔️ ${u.name} fought for ${u.faction}`)
})

/* ================= BOSS ================= */

bot.command("boss", (ctx) => {
 if (!WORLD.bossActive) startBoss()

 reply(ctx, `🐋 WORLD BOSS\nHP: ${WORLD.bossHP}`)
})

/* ================= DUEL ================= */

bot.command("duel", (ctx) => {
 const parts = ctx.message.text.split(" ")
 if (!parts[1]) return reply(ctx, "Use: /duel userId")

 const a = getUser(ctx.from.id, ctx)
 const b = getUser(parts[1])

 const scoreA = a.xp + Math.random() * 50
 const scoreB = b.xp + Math.random() * 50

 const winner = scoreA > scoreB ? a : b
 winner.xp += 10

 save()

 reply(ctx, `⚔️ Duel winner: ${winner.name}`)
})

/* ================= TRADE ================= */

bot.command("trade", (ctx) => {
 const parts = ctx.message.text.split(" ")

 if (parts.length < 3) return reply(ctx, "Use: /trade userId amount")

 const target = parts[1]
 const amount = parseInt(parts[2])

 const sender = getUser(ctx.from.id, ctx)
 const receiver = getUser(target)

 if (sender.credits < amount) return reply(ctx, "Not enough credits")

 sender.credits -= amount
 receiver.credits += amount

 save()

 reply(ctx, "💰 Trade complete")
})

/* ================= GIFT ================= */

bot.command("gift", (ctx) => {
 const parts = ctx.message.text.split(" ")

 if (parts.length < 3) return reply(ctx, "Use: /gift userId amount")

 const target = parts[1]
 const amount = parseInt(parts[2])

 const sender = getUser(ctx.from.id, ctx)
 const receiver = getUser(target)

 if (sender.credits < amount) return reply(ctx, "Not enough credits")

 sender.credits -= amount
 receiver.credits += amount

 sender.xp += 5
 receiver.xp += 5

 save()

 reply(ctx, "🎁 Gift sent")
})

/* ================= LEADERBOARD ================= */

bot.command("leaderboard", (ctx) => {
 const top = leaderboard()

 let msg = "🏆 LEADERBOARD\n\n"

 top.forEach((u, i) => {
   msg += `${i + 1}. ${u.name}${u.username ? " (@" + u.username + ")" : ""} — ${u.xp} XP — ${u.faction}\n`
 })

 msg += "\n🌍 FACTION POWER\n"
 for (let f in WORLD.factionScore) {
   msg += `${f}: ${WORLD.factionScore[f]}\n`
 }

 reply(ctx, msg)
})

/* ================= LOOP ================= */

setInterval(save, 15000)

setInterval(() => {
 if (Math.random() < 0.08) startBoss()
}, 60000)

bot.launch()
console.log("🌌 FOMO YODELVERSE RUNNING")
