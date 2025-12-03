package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.BotUtils;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendPhoto;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.request.SetWebhook;
import com.pengrad.telegrambot.response.SendResponse;

import static spark.Spark.*;

public class BotMain {

    public static void main(String[] args) {
        // Use Render's PORT environment variable if present
        int portNumber = 10000;
        String portEnv = System.getenv("PORT");
        if (portEnv != null && !portEnv.isEmpty()) {
            try {
                portNumber = Integer.parseInt(portEnv);
            } catch (NumberFormatException ignored) {}
        }
        port(portNumber);

        // Basic health check for Render
        get("/", (req, res) -> "Bot is running...");

        // Read token from environment (do NOT hardcode token)
        String botToken = System.getenv("BOT_TOKEN");
        if (botToken == null || botToken.isEmpty()) {
            System.err.println("BOT_TOKEN is not set. Exiting.");
            System.exit(1);
        }

        // Create bot instance
        TelegramBot bot = new TelegramBot(botToken);

        // (Optional) set webhook at startup if you prefer the bot to request it itself.
        // If you prefer to set webhook manually using Telegram API /setWebhook, you can skip this.
        String serviceUrl = System.getenv("RENDER_EXTERNAL_URL"); // optional: if you set it as env var
        if (serviceUrl != null && !serviceUrl.isEmpty()) {
            String webhookUrl = serviceUrl + "/" + botToken;
            bot.execute(new SetWebhook().url(webhookUrl));
            System.out.println("Requested setWebhook -> " + webhookUrl);
        }

        // Webhook endpoint: Telegram will POST JSON to https://your-service/<BOT_TOKEN>
        post("/" + botToken, (req, res) -> {
            String body = req.body();
            if (body == null || body.isEmpty()) {
                res.status(400);
                return "Empty";
            }
            // Parse incoming JSON into Update object
            Update update = BotUtils.parseUpdate(body);
            if (update != null) {
                handleUpdate(bot, update);
            }
            res.status(200);
            return "OK";
        });

        System.out.println("Webhook endpoint ready on port " + portNumber);
    }

    private static void handleUpdate(TelegramBot bot, Update update) {
        try {
            if (update.message() != null && update.message().text() != null) {
                String text = update.message().text();
                long chatId = update.message().chat().id();

                if (text.equalsIgnoreCase("/start")) {
                    // Example: send photo when user starts
                    SendResponse resp = bot.execute(new SendPhoto(chatId,
                            "https://i.imgur.com/6YVwTgR.png"));
                    if (!resp.isOk()) {
                        System.err.println("SendPhoto failed: " + resp.description());
                    }
                } else {
                    SendResponse resp = bot.execute(new SendMessage(chatId, "You said: " + text));
                    if (!resp.isOk()) {
                        System.err.println("SendMessage failed: " + resp.description());
                    }
                }
            }

            // handle other update types (callback_query, inline, etc.) later
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
