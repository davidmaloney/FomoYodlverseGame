package com.yourname.bot;

public class ApplicationMain {

    public static void main(String[] args) {
        String botToken = System.getenv("TELEGRAM_BOT_TOKEN");
        String botUsername = System.getenv("TELEGRAM_BOT_USERNAME");

        BotMain bot = new BotMain(botToken, botUsername);
        bot.registerBot();
    }
}
