package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.bots.DefaultBotOptions;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import com.sun.net.httpserver.HttpServer;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Initialize Telegram bot API
        TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
        BotMain botInstance = new BotMain("YOUR_BOT_NAME", "YOUR_BOT_USERNAME", System.getenv("TELEGRAM_BOT_TOKEN"));
        try {
            botsApi.registerBot(botInstance);
        } catch (TelegramApiException e) {
            e.printStackTrace();
            return;
        }

        System.out.println("BotMain: Bot has started successfully.");

        // Initialize HandlerRouter
        HandlerRouter router = new HandlerRouter(botInstance);

        // Use Render-assigned port, fallback to 10000 if not set
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "10000"));
        System.out.println("Webhook server will start on port: " + port);

        // Set up simple webhook server
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook", exchange -> {
            if ("POST".equals(exchange.getRequestMethod())) {
                InputStream requestBody = exchange.getRequestBody();
                ObjectMapper mapper = new ObjectMapper();
                try {
                    Update update = mapper.readValue(requestBody, Update.class);
                    // Forward to BotMain (polling logic still works)
                    botInstance.onWebhookUpdateReceived(update);
                    // Route to your existing handlers
                    router.route(update);
                } catch (Exception ex) {
                    ex.printStackTrace();
                } finally {
                    String response = "OK";
                    exchange.sendResponseHeaders(200, response.getBytes().length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(response.getBytes());
                    os.close();
                }
            } else {
                exchange.sendResponseHeaders(405, -1); // Method not allowed
            }
        });

        server.start();
        System.out.println("Webhook server started on port " + port);
        System.out.println("Bot service is live! Webhook available at /webhook");
    }
}
