package com.yourname.bot;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.telegram.telegrambots.meta.api.objects.Update;
import static spark.Spark.*;

public class ApplicationMain {

    public static void main(String[] args) {
        String botName = System.getenv("TELEGRAM_BOT_NAME");
        String botToken = System.getenv("TELEGRAM_BOT_TOKEN");

        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "443"));
        port(port);

        BotMain botInstance = new BotMain(botName, botToken);

        ObjectMapper mapper = new ObjectMapper();

        get("/", (req, res) -> {
            res.type("application/json");
            return "{\"status\":\"ok\",\"port\":" + port + "}";
        });

        post("/webhook", (req, res) -> {
            try {
                String body = req.body();
                Update update = mapper.readValue(body, Update.class);
                botInstance.onUpdateReceived(update);
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
