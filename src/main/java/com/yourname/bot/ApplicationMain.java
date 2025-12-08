package com.yourname.bot;

import java.util.List;

import com.yourname.bot.handlers.HandlerRouter;

import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

public class ApplicationMain {

    public static void main(String[] args) {
        // --- Bot configuration ---
        String botToken = "YOUR_BOT_TOKEN"; // replace with your actual bot token
        String clientId = "YOUR_CLIENT_ID"; // replace with your actual client ID
        String guildId = "YOUR_GUILD_ID";   // replace with your actual guild/server ID

        // --- Create BotMain instance ---
        BotMain bot = new BotMain(botToken, clientId, guildId);

        try {
            // --- Start the bot safely ---
            bot.start();

            // --- Optional: register sample commands ---
            List<String> sampleCommands = List.of("command1", "command2");
            bot.registerCommands(sampleCommands);

            System.out.println("ApplicationMain: Bot has started successfully.");

            // --- Setup Telegram webhook or long polling safely for Render ---
            TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
            botsApi.registerBot(new RenderSafeBot(bot));

        } catch (TelegramApiException e) {
            System.err.println("ApplicationMain: Error starting the Telegram bot: " + e.getMessage());
            e.printStackTrace();
            // Optional: handle retries or safe shutdown
        }

        // --- Keep the app alive for Render health checks ---
        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            System.out.println("ApplicationMain: Shutting down bot safely...");
            // Optionally add cleanup logic here
        }));
    }
}
