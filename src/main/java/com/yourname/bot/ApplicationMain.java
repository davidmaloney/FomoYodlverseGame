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
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "10000"));

        // Initialize BotMain
        BotMain botInstance = new BotMain(botName, botToken, optionalId);

        // Configure Spark
        port(port);

        // JSON parser
        ObjectMapper mapper = new ObjectMapper();

        // Webhook endpoint
        post("/webhook", (req, res) -> {
            try {
                String body = req.body();
                Update update = mapper.readValue(body, Update.class);

                // Forward update to BotMain
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
