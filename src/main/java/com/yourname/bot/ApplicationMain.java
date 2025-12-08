package com.yourname.bot;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.util.List;

import com.sun.net.httpserver.HttpServer;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Arguments for BotMain constructor
        String botToken = "YOUR_BOT_TOKEN"; // replace with actual token
        String clientId = "YOUR_CLIENT_ID"; // replace with actual client ID
        String guildId = "YOUR_GUILD_ID";   // replace with actual guild/server ID

        // Create BotMain instance
        BotMain bot = new BotMain(botToken, clientId, guildId);

        // Start the bot exactly as it worked before
        bot.start();

        // Register commands
        List<String> sampleCommands = List.of("command1", "command2");
        bot.registerCommands(sampleCommands);

        System.out.println("ApplicationMain: Bot has started successfully.");

        // --- Render-safe webhook setup ---
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "4567"));
        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/webhook", new WebhookHandler(bot));
        server.setExecutor(null); // default executor
        server.start();

        System.out.println("Webhook server started on port " + port);
    }

    // Webhook handler to receive Telegram updates and forward to BotMain safely
    static class WebhookHandler implements HttpHandler {
        private final BotMain bot;

        public WebhookHandler(BotMain bot) {
            this.bot = bot;
        }

        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                if ("POST".equals(exchange.getRequestMethod())) {
                    // Read the raw JSON payload
                    byte[] requestBody = exchange.getRequestBody().readAllBytes();

                    // Here you can implement real forwarding to BotMain if BotMain exposes a safe method
                    // For now, just log payload length
                    System.out.println("Received webhook payload of length: " + requestBody.length);

                    // Respond OK to Telegram
                    String response = "OK";
                    exchange.sendResponseHeaders(200, response.getBytes().length);
                    OutputStream os = exchange.getResponseBody();
                    os.write(response.getBytes());
                    os.close();
                } else {
                    exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                }
            } catch (Exception e) {
                // Catch all exceptions to prevent Render from crashing the app
                System.err.println("Error handling webhook: " + e.getMessage());
                exchange.sendResponseHeaders(500, -1);
            }
        }
    }
}
