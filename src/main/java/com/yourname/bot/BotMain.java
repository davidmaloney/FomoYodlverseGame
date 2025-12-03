package com.yourname.bot;

import static spark.Spark.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;

public class BotMain {

    public static void main(String[] args) {
        String botToken = System.getenv("BOT_TOKEN");
        if (botToken == null || botToken.isEmpty()) {
            System.err.println("ERROR: BOT_TOKEN environment variable is not set!");
            return;
        }

        TelegramBot bot = new TelegramBot(botToken);

        port(4567);

        // Health Check
        get("/health", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"healthy\"}";
        });

        // Webhook Handler
        post("/webhook", (req, res) -> {
            try {
                ObjectMapper mapper = new ObjectMapper();
                JsonNode json = mapper.readTree(req.body());

                Update update = mapper.convertValue(json, Update.class);

                if (update.message() != null && update.message().text() != null) {
                    long chatId = update.message().chat().id();
                    String text = update.message().text();

                    bot.execute(new SendMessage(chatId, "You said: " + text));
                }

            } catch (Exception e) {
                e.printStackTrace();
            }

            return "OK";
        });

        System.out.println("Bot server running on port 4567...");
    }
}
