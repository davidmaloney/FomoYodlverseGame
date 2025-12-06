package com.formalyodelversegame.bot;

import com.formalyodelversegame.bot.handlers.MasterHandler;
import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends TelegramWebhookBot {

    private final MasterHandler masterHandler;

    public BotMain() {
        this.masterHandler = new MasterHandler(); // central dispatcher
    }

    @Override
    public String getBotUsername() {
        return "FOMOYodlVerseBot"; // your bot username
    }

    @Override
    public String getBotToken() {
        // Reads token from environment variable set in Render
        return System.getenv("TELEGRAM_BOT_TOKEN");
    }

    @Override
    public void onWebhookUpdateReceived(Update update) {
        try {
            masterHandler.handleUpdate(update); // delegate everything to MasterHandler
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

    @Override
    public String getBotPath() {
        return "/"; // default webhook path
    }
}
