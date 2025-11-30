package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.model.request.ParseMode;
import com.pengrad.telegrambot.request.SendPhoto;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.UpdatesListener;

import static spark.Spark.*;

public class BotMain {

    public static void main(String[] args) {
        // Get the bot token from environment
        String botToken = System.getenv("BOT_TOKEN");
        if (botToken == null || botToken.isEmpty()) {
            System.err.println("Error: BOT_TOKEN environment variable not set.");
            System.exit(1);
        }

        // Initialize Telegram bot
        TelegramBot bot = new TelegramBot(botToken);

        // Set up Spark HTTP server for Render health checks
        port(getHerokuAssignedPort());
        get("/", (req, res) -> "Bot is running...");

        // Set webhook URL
        String webhookUrl = "https://fomoyodlversegame-1.onrender.com/" + botToken;
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    String text = update.message().text();
                    long chatId = update.message().chat().id();

                    if (text.equals("/start")) {
                        SendPhoto photo = new SendPhoto(chatId, "https://example.com/rocket.png"); // Replace with your rocket image URL
                        SendResponse response = bot.execute(photo);
                    }
                }
            }
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        System.out.println("Bot is running and webhook set!");
    }

    private static int getHerokuAssignedPort() {
        String port = System.getenv("PORT");
        if (port != null) {
            return Integer.parseInt(port);
        }
        return 10000; // Default port if not provided by Render
    }
}
