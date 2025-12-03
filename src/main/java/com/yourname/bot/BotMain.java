package com.yourname.bot;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendPhoto;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.UpdatesListener;

import static spark.Spark.*;

public class BotMain {

    public static void main(String[] args) throws Exception {

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
        ObjectMapper objectMapper = new ObjectMapper();

        // Set UpdatesListener
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    handleUpdate(bot, update);
                }
            }
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        // Webhook endpoint for Telegram
        post("/" + botToken, (req, res) -> {
            JsonNode jsonNode = objectMapper.readTree(req.body());
            Update update = objectMapper.treeToValue(jsonNode, Update.class);
            handleUpdate(bot, update);
            return "OK";
        });
    }

    // Handles each update
    private static void handleUpdate(TelegramBot bot, Update update) {
        String text = update.message().text();

        if (text.equals("/start")) {
            // Example: send a rocket image
            SendResponse response = bot.execute(new SendPhoto(update.message().chat().id(),
                    "https://i.imgur.com/6YVwTgR.png"));
        }
        // You can add more commands here
    }
}
