require('dotenv').config()

const express = require('express')
const { Telegraf, Markup } = require('telegraf')
const fs = require('fs')

/* -----------------------------
   WEB SERVER (RENDER REQUIRED)
----------------------------- */

const app = express()

app.get('/', (req, res) => {
  res.send('FOMO Yodelverse is alive 🚀')
})

const PORT = process.env.PORT || 10000

app.listen(PORT, () => {
  console.log('Web server running on port', PORT)
})

/* -----------------------------
   TELEGRAM BOT
----------------------------- */

const bot = new Telegraf(process.env.BOT_TOKEN)

const DB_PATH = './data/users.json'

function loadDB() {
  return JSON.parse(fs.readFileSync(DB_PATH))
}

function saveDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2))
}

function random(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

/* -----------------------------
   CHARACTERS
----------------------------- */

const characters = [
  "FOMO Yodel",
  "Chewstacka",
  "Fan SOLo",
  "Obi FOMO Wannabe",
  "Darth Fader",
  "Web3PO",
  "Princess Liquidia",
  "Darth Scamus",
  "Jabba the Whale",
  "R2 DeFi",
  "Admiral Grow Bar"
]

/* -----------------------------
   EVENTS
----------------------------- */

const events = [
  "⚠️ Darth Scamus panic sold 4 billion tokens",
  "🐋 Jabba the Whale is manipulating liquidity",
  "📉 Market crash triggered by FOMO panic",
  "🚀 Fan SOLo discovered hidden gains on Solana",
  "🧠 Web3PO explains blockchain for 9 hours",
  "🌕 FOMO Yodel senses a massive pump incoming",
  "💀 Obi FOMO Wannabe gave terrible financial advice"
]

/* -----------------------------
   START
----------------------------- */

bot.start((ctx) => {
  const db = loadDB()
  const id = ctx.from.id

  if (!db[id]) {
    db[id] = {
      character: random(characters),
      xp: 0,
      credits: 100
    }
    saveDB(db)
  }

  ctx.reply(
`WELCOME TO FOMO YODELVERSE

You are:
${db[id].character}

Commands:
/profile
/event`
  )
})

/* -----------------------------
   PROFILE
----------------------------- */

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

/* -----------------------------
   EVENT + BUTTONS
----------------------------- */

bot.command('event', (ctx) => {
  const text = random(events)

  ctx.reply(
    text,
    Markup.inlineKeyboard([
      Markup.button.callback("BUY DIP", "buy"),
      Markup.button.callback("HODL", "hodl"),
      Markup.button.callback("PANIC SELL", "sell")
    ])
  )
})

/* -----------------------------
   BUTTON ACTIONS
----------------------------- */

bot.action("buy", (ctx) => {
  ctx.reply("You bought the dip. +10 XP. FOMO Yodel approves.")
})

bot.action("hodl", (ctx) => {
  ctx.reply("Diamond hands detected. +15 XP. Jabba respects you.")
})

bot.action("sell", (ctx) => {
  ctx.reply("You panic sold. Darth Fader is pleased. -5 XP.")
})

/* -----------------------------
   START BOT
----------------------------- */

bot.launch()

console.log("FOMO Yodelverse Bot Running")
