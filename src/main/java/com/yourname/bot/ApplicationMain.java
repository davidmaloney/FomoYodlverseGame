package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {

        // ====== 1) LOAD TOKENS FROM ENV ======
        String token = System.getenv("TELEGRAM_TOKEN");
        String clientId = System.getenv("CLIENT_ID");
        String guildId = System.getenv("GUILD_ID");

        if (token == null || clientId == null || guildId == null) {
            System.err.println("❌ Missing environment variables!");
            return;
        }

        // ====== 2) INIT BOT WITH CONSTRUCTOR FIX ======
        BotMain botInstance = new BotMain(token, clientId, guildId);

        TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
        try {
            botsApi.registerBot(botInstance);
            System.out.println("BotMain: Bot registered with polling successfully.");
        } catch (TelegramApiException e) {
            e.printStackTrace();
            return;
        }

        // ====== 3) LOAD ROUTER ======
        HandlerRouter router = new HandlerRouter(botInstance);

        // ====== 4) START LIGHT/MEDIUM-WEIGHT WEBHOOK SERVER ======
        int port = 10000; // Render exposes this
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // THREAD POOL — SUPPORTS **200+ concurrent players**
        ExecutorService executor = Executors.newFixedThreadPool(50);
        server.setExecutor(executor);

        System.out.println("Webhook server binding on /webhook (port " + port + ")…");

        server.createContext("/webhook", (HttpExchange exchange) -> {
            if (!exchange.getRequestMethod().equals("POST")) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            try (InputStream requestBody = exchange.getRequestBody()) {

                // SAFEST JSON MAPPER FOR TELEGRAM UPDATE
                ObjectMapper mapper = new ObjectMapper();
                Update update = mapper.readValue(requestBody, Update.class);

                // Forward to bot logic
                botInstance.receiveWebhookUpdate(update);

                // Existing routing system still works
                router.route(update);

                // Response
                byte[] response = "OK".getBytes();
                exchange.sendResponseHeaders(200, response.length);
                try (OutputStream os = exchange.getResponseBody()) {
                    os.write(response);
                }

            } catch (Exception ex) {
                ex.printStackTrace();
                exchange.sendResponseHeaders(500, -1);
            }
        });

        server.start();
        System.out.println("Webhook server running at https://YOUR-RENDER-URL/webhook");
        System.out.println("Polling + Webhook hybrid mode active.");
        System.out.println("Bot is fully operational.");
    }
}
