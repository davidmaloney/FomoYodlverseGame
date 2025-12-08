package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.JsonNode;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpExchange;

import java.io.OutputStream;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.util.List;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Bot credentials
        String botToken = "YOUR_BOT_TOKEN"; // replace with actual token
        String clientId = "YOUR_CLIENT_ID"; // replace with actual client ID
        String guildId = "YOUR_GUILD_ID";   // replace with actual guild/server ID

        // Start BotMain
        BotMain bot = new BotMain(botToken, clientId, guildId);
        bot.start();

        // Register commands
        List<String> sampleCommands = List.of("command1", "command2");
        bot.registerCommands(sampleCommands);

        System.out.println("ApplicationMain: Bot has started successfully.");

        // Set up handler router
        HandlerRouter router = new HandlerRouter(bot);

        // Determine Render port (or fallback to 4567 locally)
        int port = 0;
        String portEnv = System.getenv("PORT");
        if (portEnv != null) {
            port = Integer.parseInt(portEnv);
        } else {
            port = 4567;
        }

        // Start HTTP server for Telegram webhook
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook", new HttpHandler() {
            private final ObjectMapper mapper = new ObjectMapper();

            @Override
            public void handle(HttpExchange exchange) {
                try {
                    if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                        InputStream is = exchange.getRequestBody();
                        JsonNode updateJson = mapper.readTree(is);

                        // Here you would convert JsonNode to your Update object
                        // For simplicity, assume HandlerRouter can handle JsonNode
                        // If you are using TelegramBots library, you can deserialize properly
                        router.routeJson(updateJson);

                        String response = "OK";
                        exchange.sendResponseHeaders(200, response.length());
                        OutputStream os = exchange.getResponseBody();
                        os.write(response.getBytes());
                        os.close();
                    } else {
                        exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                    }
                } catch (Exception e) {
                    e.printStackTrace();
                    try {
                        exchange.sendResponseHeaders(500, -1);
                    } catch (Exception ignored) {}
                }
            }
        });

        server.start();
        System.out.println("ApplicationMain: Webhook server running on port " + port);
    }
}
