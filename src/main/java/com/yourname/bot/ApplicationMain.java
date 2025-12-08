package com.yourname.bot;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;
import com.yourname.bot.handlers.HandlerRouter;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.List;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Bot credentials
        String botToken = "YOUR_BOT_TOKEN"; // replace with actual token
        String clientId = "YOUR_CLIENT_ID"; // replace with actual client ID
        String guildId = "YOUR_GUILD_ID";   // replace with actual guild/server ID

        // Create bot
        BotMain bot = new BotMain(botToken, clientId, guildId);
        bot.start();

        // Register sample commands
        List<String> sampleCommands = List.of("command1", "command2");
        bot.registerCommands(sampleCommands);

        System.out.println("ApplicationMain: Bot has started successfully.");

        // Create HandlerRouter
        HandlerRouter router = new HandlerRouter(bot);

        // Set port for Render or fallback
        int port = 10000; // fallback port
        String portEnv = System.getenv("PORT");
        if (portEnv != null) {
            port = Integer.parseInt(portEnv);
        }

        // Start simple HTTP server for webhook
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook", new HttpHandler() {
            private final ObjectMapper mapper = new ObjectMapper();

            @Override
            public void handle(HttpExchange exchange) throws IOException {
                if ("POST".equals(exchange.getRequestMethod())) {
                    try {
                        JsonNode json = mapper.readTree(exchange.getRequestBody());
                        com.telegram.telegrambots.meta.api.objects.Update update =
                                mapper.treeToValue(json, com.telegram.telegrambots.meta.api.objects.Update.class);

                        // Route update
                        router.route(update);

                        // Respond with 200 OK
                        String response = "OK";
                        exchange.sendResponseHeaders(200, response.getBytes().length);
                        OutputStream os = exchange.getResponseBody();
                        os.write(response.getBytes());
                        os.close();
                    } catch (Exception e) {
                        e.printStackTrace();
                        exchange.sendResponseHeaders(500, 0);
                        exchange.getResponseBody().close();
                    }
                } else {
                    exchange.sendResponseHeaders(405, 0); // Method not allowed
                    exchange.getResponseBody().close();
                }
            }
        });

        server.start();
        System.out.println("Webhook server started on port " + port);
    }
}
