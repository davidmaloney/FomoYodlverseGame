package com.formalyodelversegame.bot;

import com.formalyodelversegame.bot.handlers.MasterHandler;
import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends TelegramWebhookBot {

    private final MasterHandler masterHandler;

    public BotMain() {
        this.masterHandler = new MasterHandler(); // Delegates to MasterHandler
    }

    @Override
    public String getBotUsername() {
        return "FOMOYodlVerseBot"; // Keep your bot’s exact username here
    }

    @Override
    public String getBotToken() {
        // Grab token from Render environment variable
        return System.getenv("TELEGRAM_BOT_TOKEN");
    }

    @Override
    public void onWebhookUpdateReceived(Update update) {
        try {
            masterHandler.handleUpdate(update); // Forward all updates to MasterHandler
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

    @Override
    public String getBotPath() {
        return "/"; // Default webhook path
    }
}
