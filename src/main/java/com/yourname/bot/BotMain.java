package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendPhoto;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.UpdatesListener;
import spark.Spark;

public class BotMain {

    public static void main(String[] args) {
        // Load environment variables
        String botToken = System.getenv("BOT_TOKEN");
        String webhookUrl = System.getenv("WEBHOOK_URL"); // New webhook URL
        String portEnv = System.getenv("PORT");
        int port = (portEnv != null) ? Integer.parseInt(portEnv) : 10000;

        // Initialize the bot
        TelegramBot bot = new TelegramBot(botToken);

        // Set the bot’s webhook URL for Telegram
        bot.setUpdatesListener(updates -> {
            // We'll handle updates via Spark webhook instead of long polling
            return UpdatesListener.CONFIRMED_UPDATES_NONE;
        });

        // Start Spark HTTP server for Render compatibility
        Spark.port(port);
        Spark.get("/", (req, res) -> "Bot is running..."); // Simple endpoint for Render health

        Spark.post("/" + botToken, (req, res) -> {
            // Telegram sends updates to this webhook
            Update update = TelegramBot.parseUpdate(req.body());
            
            if (update.message() != null && update.message().text() != null) {
                String text = update.message().text();

                if (text.equals("/start")) {
                    // Example: send rocket image
                    SendPhoto message = new SendPhoto(update.message().chat().id(),
                            "https://i.imgur.com/rocket.png"); // Replace with your rocket image URL
                    SendResponse response = bot.execute(message);
                }
            }

            res.status(200);
            return "OK";
        });

        System.out.println("Bot is running...");
    }
}
