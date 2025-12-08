package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.bots.DefaultBotOptions;
import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.LinkedBlockingQueue;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Initialize Telegram bot API and BotMain (polling)
        TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
        BotMain botInstance = new BotMain();
        try {
            botsApi.registerBot(botInstance);
        } catch (TelegramApiException e) {
            e.printStackTrace();
            return;
        }

        System.out.println("BotMain: Bot has started successfully.");

        // Initialize HandlerRouter for BotMain (kept unchanged)
        HandlerRouter router = new HandlerRouter(botInstance);

        // Set up HTTP server for webhook on port 10000 (Render-compatible)
        int port = 10000;
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);

        // Thread pool to handle multiple concurrent requests (200+ users)
        ExecutorService executor = Executors.newFixedThreadPool(20);
        server.setExecutor(executor);

        // Queue to decouple incoming updates from BotMain handling
        LinkedBlockingQueue<Update> updateQueue = new LinkedBlockingQueue<>();

        // Webhook context
        server.createContext("/webhook", (HttpExchange exchange) -> {
            if ("POST".equals(exchange.getRequestMethod())) {
                InputStream requestBody = exchange.getRequestBody();
                ObjectMapper mapper = new ObjectMapper();
                try {
                    Update update = mapper.readValue(requestBody, Update.class);
                    updateQueue.offer(update); // queue updates safely
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

        // Worker thread to process queued updates asynchronously
        new Thread(() -> {
            while (true) {
                try {
                    Update update = updateQueue.take(); // blocks until an update arrives
                    // You can use the router to process handlers without blocking BotMain
                    router.route(update);
                    // Outgoing messages are still handled via BotMain internally
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }).start();

        System.out.println("Bot service is live! Available at your primary URL /webhook");
    }
}
