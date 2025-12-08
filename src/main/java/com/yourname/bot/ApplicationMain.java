package com.yourname.bot;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.telegram.telegrambots.meta.api.objects.Update;

import static spark.Spark.*;

public class ApplicationMain {

    public static void main(String[] args) {
        // Read environment variables
        String botName = System.getenv("TELEGRAM_BOT_NAME");
        String botToken = System.getenv("TELEGRAM_BOT_TOKEN");
        String optionalId = System.getenv().getOrDefault("OPTIONAL_ID", "");

        // Port: prefer Render's PORT, otherwise default to 443 for Telegram
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "443"));

        // Initialize BotMain (your existing bot logic)
        BotMain botInstance = new BotMain(botName, botToken, optionalId);

        // Set Spark port
        port(port);

        // (Optional) set a small thread pool for Spark (safe defaults)
        int maxThreads = Integer.parseInt(System.getenv().getOrDefault("WEB_THREADS_MAX", "8"));
        int minThreads = Integer.parseInt(System.getenv().getOrDefault("WEB_THREADS_MIN", "2"));
        int idleTimeoutMillis = Integer.parseInt(System.getenv().getOrDefault("WEB_IDLE_MS", "30000"));
        threadPool(maxThreads, minThreads, idleTimeoutMillis);

        // JSON parser
        ObjectMapper mapper = new ObjectMapper();

        // Health endpoint (mapped) — useful to confirm service is up
        get("/", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\",\"port\":" + port + "}";
        });

        // Webhook endpoint (Telegram will POST here)
        post("/webhook", (req, res) -> {
            try {
                String body = req.body();
                System.out.println("Received /webhook POST, body length: " + (body == null ? 0 : body.length()));

                Update update = mapper.readValue(body, Update.class);

                // Forward update to your BotMain handler method
                // BotMain.handleUpdate should contain the unchanged gameplay routing logic
                botInstance.handleUpdate(update);

                res.status(200);
                return "OK";
            } catch (Exception e) {
                e.printStackTrace();
                res.status(500);
                return "ERROR";
            }
        });

        System.out.println("ApplicationMain running on port " + port);
    }
}
