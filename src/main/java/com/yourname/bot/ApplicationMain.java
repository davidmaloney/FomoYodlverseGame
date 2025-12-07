package com.yourname.bot;

import java.util.List;

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

        // Optional: Additional setup or initialization if needed
        System.out.println("ApplicationMain: Bot has started successfully.");

        // Example of handling events or commands
        // This could be extended with button handling, commands, etc.
        List<String> sampleCommands = List.of("command1", "command2");
        bot.registerCommands(sampleCommands);
    }
}
