package com.formalyodelversegame.bot;

import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import com.formalyodelversegame.bot.handlers.MasterHandler;
import com.formalyodelversegame.bot.handlers.StartHandler;

public class BotMain extends TelegramWebhookBot {

    private final String botUsername;
    private final String botToken;
    private final String botPath;

    private final MasterHandler masterHandler;
    private final StartHandler startHandler;

    public BotMain() {
        this.botUsername = System.getenv("TELEGRAM_BOT_USERNAME");
        this.botToken = System.getenv("TELEGRAM_BOT_TOKEN");
        this.botPath = System.getenv("TELEGRAM_BOT_WEBHOOK");

        this.masterHandler = new MasterHandler();
        this.startHandler = new StartHandler();
    }

    @Override
    public String getBotUsername() {
        return botUsername;
    }

    @Override
    public String getBotToken() {
        return botToken;
    }

    @Override
    public String getBotPath() {
        return botPath;
    }

    @Override
    public void onWebhookUpdateReceived(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();

            if (text.equals("/start")) {
                startHandler.handleStart(update, this);
            } else {
                masterHandler.handle(update, this);
            }
        }
    }
}
