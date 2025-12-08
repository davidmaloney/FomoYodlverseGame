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
        BotMain botInstance = new BotMain();
        try {
            botsApi.registerBot(botInstance);
        } catch (TelegramApiException e) {
            e.printStackTrace();
            return;
        }

        System.out.println("BotMain: Bot has started successfully.");

        // Initialize HandlerRouter
        HandlerRouter router = new HandlerRouter(botInstance);

        // Set up simple webhook server on port 10000
        int port = 10000; // Render-compatible port
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook", exchange -> {
            if ("POST".equals(exchange.getRequestMethod())) {
                InputStream requestBody = exchange.getRequestBody();
                ObjectMapper mapper = new ObjectMapper();
                try {
                    Update update = mapper.readValue(requestBody, Update.class);
                    botInstance.onWebhookUpdateReceived(update); // Send update to BotMain
                    router.route(update); // Route it to your existing handlers
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
        System.out.println("Bot service is live! Available at your primary URL /webhook");
    }
}
