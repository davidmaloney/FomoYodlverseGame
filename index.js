require('dotenv').config()

const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')

const bot = new Telegraf(process.env.BOT_TOKEN)

const DB_PATH = './data/users.json'

function loadDB() {
  try {
    return JSON.parse(fs.readFileSync(DB_PATH))
  } catch {
    return {}
  }
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function getUser(db, id) {
  if (!db[id]) {
    db[id] = {
      character: "FOMO Yodel",
      xp: 0,
      credits: 100
    }
  }
  return db[id]
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

const events = [
  "⚠️ Darth Scamus dumped the market",
  "🐋 Jabba the Whale is manipulating liquidity",
  "📉 FOMO crash incoming",
  "🚀 Solana liquidity discovered",
  "🧠 Web3PO overexplains everything again"
]

bot.start((ctx) => {
  const db = loadDB()
  const user = getUser(db, ctx.from.id)
  saveDB(db)

  ctx.reply(
`FOMO YODELVERSE

You are:
${user.character}

Commands:
/profile
/event`
  )
})

bot.command('profile', (ctx) => {
  const db = loadDB()
  const user = db[ctx.from.id]

  if (!user) return ctx.reply("Type /start first")

  ctx.reply(
`PROFILE
Character: ${user.character}
XP: ${user.xp}
Credits: ${user.credits}`
  )
})

bot.command('event', (ctx) => {
  ctx.reply(
    random(events),
    Markup.inlineKeyboard([
      Markup.button.callback("BUY", "buy"),
      Markup.button.callback("HODL", "hodl"),
      Markup.button.callback("SELL", "sell")
    ])
  )
})

bot.action("buy", (ctx) => {
  const db = loadDB()
  const user = getUser(db, ctx.from.id)

  user.xp += 10
  saveDB(db)

  ctx.reply("+10 XP (BUY DIP)")
})

bot.action("hodl", (ctx) => {
  const db = loadDB()
  const user = getUser(db, ctx.from.id)

  user.xp += 15
  saveDB(db)

  ctx.reply("+15 XP (HODL strong)")
})

bot.action("sell", (ctx) => {
  const db = loadDB()
  const user = getUser(db, ctx.from.id)

  user.xp -= 5
  saveDB(db)

  ctx.reply("-5 XP (panic sell)")
})

bot.launch()

console.log("FOMO Yodelverse Worker running")
