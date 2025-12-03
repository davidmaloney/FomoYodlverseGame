package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.response.SendResponse;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import static spark.Spark.*;

public class BotMain {

    private static final String BOT_TOKEN = System.getenv("BOT_TOKEN"); // Use environment variable on Render
    private static final int PORT = 4567;

    private static final TelegramBot bot = new TelegramBot(BOT_TOKEN);
    private static final ObjectMapper objectMapper = new ObjectMapper();

    public static void main(String[] args) {
        port(PORT);
        get("/", (req, res) -> "Bot is running.");

        post("/webhook", (req, res) -> {
            String body = req.body();
            try {
                JsonNode updateJson = objectMapper.readTree(body);
                handleUpdate(updateJson);
            } catch (Exception e) {
                e.printStackTrace();
            }
            res.status(200);
            return "OK";
        });

        System.out.println("Bot webhook server is running on port " + PORT);
    }

    private static void handleUpdate(JsonNode update) {
        if (update.has("message") && update.get("message").has("text")) {
            String chatId = update.get("message").get("chat").get("id").asText();
            String messageText = update.get("message").get("text").asText();

            SendMessage request = new SendMessage(chatId, "You said: " + messageText);
            SendResponse response = bot.execute(request);
        }
    }
}
