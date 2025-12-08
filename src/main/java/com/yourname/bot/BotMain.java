package com.yourname.bot;

import org.telegram.telegrambots.meta.api.objects.Update;

public class BotMain {
    private final String botName;
    private final String botToken;
    private final String optionalId; // Could be guild ID or client ID

    public BotMain(String botName, String botToken, String optionalId) {
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;
        // Initialize any other necessary bot state here
    }

    // Forwarded from ApplicationMain
    public void handleUpdate(Update update) {
        // ===== DEBUG LOGGING =====
        System.out.println("=== BotMain.handleUpdate called ===");
        if (update.hasMessage() && update.getMessage().hasText()) {
            Long chatId = update.getMessage().getChatId();
            String messageText = update.getMessage().getText();
            System.out.println("Update received! ChatId: " + chatId + ", Text: " + messageText);
        } else {
            System.out.println("Update received but no message text or not a message update.");
        }
        System.out.println("=================================");

        // Insert all your existing handler logic here
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText();
            long chatId = update.getMessage().getChatId();
            // Call your existing command handlers, game logic, etc.
            processMessage(chatId, messageText);
        }
    }

    private void processMessage(long chatId, String messageText) {
        // Your game logic / command handling here
        // Keep everything as in your last working bot
    }

    public String getBotName() {
        return botName;
    }

    public String getBotToken() {
        return botToken;
    }

    public String getOptionalId() {
        return optionalId;
    }
}
