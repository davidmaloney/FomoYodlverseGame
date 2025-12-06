package com.formalyodelversegame.bot;

import com.formalyodelversegame.bot.handlers.MasterHandler;
import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends TelegramWebhookBot {

    private final MasterHandler masterHandler;

    public BotMain() {
        this.masterHandler = new MasterHandler(); // Delegator to master
    }

    @Override
    public String getBotUsername() {
        return "FOMOYodlVerseBot"; // Replace with your bot's exact username
    }

    @Override
    public String getBotToken() {
        // Pull from environment variable
        return System.getenv("TELEGRAM_BOT_TOKEN");
    }

    @Override
    public void onWebhookUpdateReceived(Update update) {
        try {
            // Pass "this" as the AbsSender
            masterHandler.handleUpdate(update, this);
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

    @Override
    public String getBotPath() {
        return "/"; // Default webhook path
    }
}
