const fs = require("fs")

require("dotenv").config()

const { Telegraf, Markup } = require("telegraf")



const bot = new Telegraf(process.env.BOT_TOKEN)



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

  seasonStart: Date.now()

}



/* ================= GAME DATA ================= */



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



/* ================= CORE USER ================= */



function getUser(id) {

  if (!DB[id]) {

    DB[id] = {

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

    .map(([id, u]) => ({ id, xp: u.xp, faction: u.faction }))

    .sort((a, b) => b.xp - a.xp)

    .slice(0, 10)

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

    broadcast("🐋 WORLD BOSS DEFEATED! Everyone gains bonus XP!")

    for (let id in DB) DB[id].xp += 20

  }

}



function broadcast(msg) {

  for (let id in DB) {

    bot.telegram.sendMessage(id, msg).catch(() => {})

  }

}



/* ================= CORE GAME ================= */



function eventRoll() {

  return events[Math.floor(Math.random() * events.length)]

}



/* ================= START ================= */



bot.start((ctx) => {

  const u = getUser(ctx.from.id)

  save()



  ctx.reply(

    "🌌 FOMO YODELVERSE\n\n" +

    "Character: " + u.character + "\n" +

    "Faction: " + u.faction + "\n" +

    "Level: " + level(u.xp) + "\n\n" +

    "Commands:\n" +

    "/event\n/profile\n/war\n/boss\n/trade\n/gift\n/leaderboard"

  )

})



/* ================= PROFILE ================= */



bot.command("profile", (ctx) => {

  const u = getUser(ctx.from.id)



  ctx.reply(

    "📊 PROFILE\n\n" +

    "Character: " + u.character + "\n" +

    "Faction: " + u.faction + "\n" +

    "Level: " + level(u.xp) + "\n" +

    "XP: " + u.xp + "\n" +

    "Credits: " + u.credits

  )

})



/* ================= EVENT ================= */



bot.command("event", (ctx) => {

  const u = getUser(ctx.from.id)



  const e = eventRoll()



  u.xp += 10

  u.credits += 5



  save()



  ctx.reply(

    "⚡ EVENT\n\n" + e,

    Markup.inlineKeyboard([

      [Markup.button.callback("FIGHT", "fight")],

      [Markup.button.callback("HODL", "hodl")],

      [Markup.button.callback("SELL", "sell")]

    ])

  )

})



/* ================= ACTIONS ================= */



bot.action("fight", (ctx) => {

  const u = getUser(ctx.from.id)



  const dmg = 10 + Math.floor(Math.random() * 25)



  u.xp += 20

  u.credits += 10



  damageBoss(dmg)



  save()



  ctx.reply("⚔️ You fought chaos (+XP, boss dmg " + dmg + ")")

})



bot.action("hodl", (ctx) => {

  const u = getUser(ctx.from.id)

  u.xp += 10

  save()

  ctx.reply("💎 HODL rewarded")

})



bot.action("sell", (ctx) => {

  const u = getUser(ctx.from.id)

  u.xp -= 5

  save()

  ctx.reply("📉 Panic sell")

})



/* ================= WAR ================= */



bot.command("war", (ctx) => {

  const u = getUser(ctx.from.id)



  u.xp += 15



  save()



  ctx.reply("⚔️ You contributed to faction war!")

})



/* ================= BOSS ================= */



bot.command("boss", (ctx) => {

  if (!WORLD.bossActive) startBoss()



  ctx.reply(

    "🐋 WORLD BOSS ACTIVE\nHP: " + WORLD.bossHP

  )

})



/* ================= TRADE ================= */



bot.command("trade", (ctx) => {

  const parts = ctx.message.text.split(" ")



  if (parts.length < 4) {

    return ctx.reply("Use: /trade userId amount")

  }



  const target = parts[1]

  const amount = parseInt(parts[2])



  const sender = getUser(ctx.from.id)

  const receiver = getUser(target)



  if (sender.credits < amount) {

    return ctx.reply("Not enough credits")

  }



  sender.credits -= amount

  receiver.credits += amount



  save()



  ctx.reply("💰 Trade complete")

})



/* ================= GIFT SYSTEM ================= */



bot.command("gift", (ctx) => {

  const parts = ctx.message.text.split(" ")



  if (parts.length < 3) {

    return ctx.reply("Use: /gift userId amount")

  }



  const target = parts[1]

  const amount = parseInt(parts[2])



  const sender = getUser(ctx.from.id)

  const receiver = getUser(target)



  if (sender.credits < amount) return ctx.reply("Not enough credits")



  sender.credits -= amount

  receiver.credits += amount



  sender.xp += 5

  receiver.xp += 5



  save()



  ctx.reply("🎁 Gift sent")

})



/* ================= LEADERBOARD ================= */



bot.command("leaderboard", (ctx) => {

  const top = leaderboard()



  let msg = "🏆 LEADERBOARD\n\n"



  top.forEach((u, i) => {

    msg += (i + 1) + ". " + u.xp + " XP | " + u.faction + "\n"

  })



  ctx.reply(msg)

})



/* ================= AUTO EVENTS ================= */



setInterval(() => {

  if (Math.random() < 0.08) startBoss()

}, 60000)



/* ================= SAVE LOOP ================= */



setInterval(save, 15000)



/* ================= START BOT ================= */



bot.launch()

console.log("🌌 FOMO YODELVERSE RUNNING")
