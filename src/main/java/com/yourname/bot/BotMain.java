package com.yourname.bot;

import static spark.Spark.*;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.UpdatesListener;

import com.fasterxml.jackson.databind.ObjectMapper;

public class BotMain {

    public static void main(String[] args) {

        // Get bot token from environment (Render → Environment)
        String token = System.getenv("BOT_TOKEN");
        if (token == null || token.isEmpty()) {
            System.out.println("ERROR: BOT_TOKEN is missing!");
            return;
        }

        TelegramBot bot = new TelegramBot(token);

        // Start Spark server (Render uses port from $PORT)
        port(getHerokuAssignedPort());

        // Health check
        get("/", (req, res) -> "OK");

        // Webhook endpoint
        post("/webhook", (req, res) -> {
            try {
                ObjectMapper mapper = new ObjectMapper();
                Update update = mapper.readValue(req.body(), Update.class);

                if (update.message() != null && update.message().text() != null) {
                    long chatId = update.message().chat().id();
                    String text = update.message().text();

                    // Simple reply — SAFE minimal version
                    bot.execute(new SendMessage(chatId, "Bot is alive! You wrote: " + text));
                }

            } catch (Exception e) {
                e.printStackTrace();
            }
            return "OK";
        });

        // Important: keep alive listener to avoid shutdown
        bot.setUpdatesListener(updates -> UpdatesListener.CONFIRMED_UPDATES_ALL);

        System.out.println("Bot is running.");
    }

    // Render / Heroku dynamic port handling
    static int getHerokuAssignedPort() {
        String port = System.getenv("PORT");
        if (port != null) {
            return Integer.parseInt(port);
        }
        return 4567; // default local run
    }
}
