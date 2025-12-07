package com.yourname.bot;

import java.util.List;
import java.util.concurrent.CountDownLatch;

public class ApplicationMain {
    public static void main(String[] args) {
        // Arguments for BotMain constructor
        String botToken = "YOUR_BOT_TOKEN"; // replace with actual token
        String clientId = "YOUR_CLIENT_ID"; // replace with actual client ID
        String guildId = "YOUR_GUILD_ID";   // replace with actual guild/server ID

        // Create BotMain instance
        BotMain bot = new BotMain(botToken, clientId, guildId);

        // Start the bot
        bot.start();

        // Example of registering commands
        List<String> sampleCommands = List.of("command1", "command2");
        bot.registerCommands(sampleCommands);

        System.out.println("ApplicationMain: Bot has started successfully.");

        // Keep main thread alive to prevent early exit
        CountDownLatch keepAliveLatch = new CountDownLatch(1);
        try {
            keepAliveLatch.await(); // waits indefinitely until shutdown
        } catch (InterruptedException e) {
            System.out.println("ApplicationMain: Shutdown signal received.");
            Thread.currentThread().interrupt();
        }

        System.out.println("ApplicationMain: Exiting safely.");
    }
}
