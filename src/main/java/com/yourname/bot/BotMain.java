package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.UpdatesListener;
import com.sun.net.httpserver.HttpServer;

import java.net.InetSocketAddress;

public class BotMain {

    public static void main(String[] args) {
        // Read token from environment
        String token = System.getenv("BOT_TOKEN");
        if (token == null || token.isEmpty()) {
            System.err.println("BOT_TOKEN environment variable is not set. Exiting.");
            return;
        }

        // Small HTTP endpoint to bind to Render's PORT (optional but recommended)
        // It prevents "no open ports detected" warnings and keeps the web service happy.
        // If you already plan to run as a Background Worker (paid on Render), you can remove this block.
        try {
            String portEnv = System.getenv().getOrDefault("PORT", "8080");
            int port = Integer.parseInt(portEnv);
            HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
            server.createContext("/", exchange -> {
                String response = "OK";
                exchange.sendResponseHeaders(200, response.length());
                exchange.getResponseBody().write(response.getBytes());
                exchange.close();
            });
            server.setExecutor(null);
            server.start();
            System.out.println("HTTP status endpoint started on port " + port);
        } catch (Exception e) {
            // If it fails (no permission or other), we continue — binding is optional
            System.err.println("HTTP status endpoint not started: " + e.getMessage());
        }

        // Create bot
        TelegramBot bot = new TelegramBot(token);

        // Updates listener — handle incoming messages
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                try {
                    if (update.message() != null && update.message().text() != null) {
                        String chatId = update.message().chat().id().toString();
                        String text = update.message().text();

                        if (text.equalsIgnoreCase("/start")) {
                            bot.execute(new SendMessage(chatId, "🚀"));
                        } else {
                            bot.execute(new SendMessage(chatId, "You said: " + text));
                        }
                    }
                } catch (Exception ex) {
                    // Protect the listener loop from crashing on a single message
                    System.err.println("Error processing update: " + ex.getMessage());
                }
            }
            // Use the library's constant (current API) to confirm updates
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        System.out.println("Bot is running...");
    }
}
