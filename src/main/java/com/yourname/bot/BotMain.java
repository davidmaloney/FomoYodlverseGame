package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendPhoto;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.UpdatesListener;

import static spark.Spark.*;

public class BotMain {

    public static void main(String[] args) {

        // Set the port from Render environment or default 10000
        int portNumber = 10000;
        if (System.getenv("PORT") != null) {
            portNumber = Integer.parseInt(System.getenv("PORT"));
        }
        port(portNumber);

        // Health check endpoint for Render
        get("/", (req, res) -> "Bot is running...");

        // Initialize bot with token from environment
        String botToken = System.getenv("BOT_TOKEN");
        if (botToken == null || botToken.isEmpty()) {
            System.err.println("Error: BOT_TOKEN environment variable not set!");
            System.exit(1);
        }

        TelegramBot bot = new TelegramBot(botToken);

        // Set the webhook URL (replace with your actual Render service URL)
        String webhookUrl = "https://fomoyodlversegame-1.onrender.com/" + botToken;
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    String text = update.message().text();

                    if (text.equals("/start")) {
                        // Send a rocket image
                        SendResponse response = bot.execute(new SendPhoto(update.message().chat().id(),
                                "https://i.imgur.com/6YVwTgR.png")); // example rocket image URL
                    }
                }
            }
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        // Webhook endpoint for Telegram
        post("/" + botToken, (req, res) -> {
            bot.process(req.body());
            return "OK";
        });
    }
}
