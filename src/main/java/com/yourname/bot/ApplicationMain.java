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

        // Port: Render will inject PORT, fallback to 443 for Telegram webhook
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "443"));

        // Initialize your BotMain instance
        BotMain botInstance = new BotMain(botName, botToken, optionalId);

        // Configure Spark
        port(port);

        // Optional: small thread pool for Spark
        int maxThreads = Integer.parseInt(System.getenv().getOrDefault("WEB_THREADS_MAX", "8"));
        int minThreads = Integer.parseInt(System.getenv().getOrDefault("WEB_THREADS_MIN", "2"));
        int idleTimeoutMillis = Integer.parseInt(System.getenv().getOrDefault("WEB_IDLE_MS", "30000"));
        threadPool(maxThreads, minThreads, idleTimeoutMillis);

        // JSON parser
        ObjectMapper mapper = new ObjectMapper();

        // Health endpoint — confirms service is alive
        get("/", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\",\"port\":" + port + "}";
        });

        // Webhook endpoint — Telegram POSTs here
        post("/webhook", (req, res) -> {
            try {
                String body = req.body();
                System.out.println("Received /webhook POST, body length: " + (body == null ? 0 : body.length()));

                // Parse the incoming update
                Update update = mapper.readValue(body, Update.class);

                // Forward update to BotMain handler
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
