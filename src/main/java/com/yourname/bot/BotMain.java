package com.yourname.bot;

import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.yourname.bot.handlers.HandlerRouter;

public class BotMain extends TelegramWebhookBot {

    private final String botToken;
    private final String botUsername;
    private final String webhookPath;

    private final HandlerRouter handlerRouter;

    public BotMain(String botToken, String botUsername, String webhookPath) {
        this.botToken = botToken;
        this.botUsername = botUsername;
        this.webhookPath = webhookPath;
        this.handlerRouter = new HandlerRouter(this);
    }

    @Override
    public BotApiMethod<?> onWebhookUpdateReceived(Update update) {
        return handlerRouter.route(update);
    }

    @Override
    public String getBotPath() {
        return webhookPath;
    }

    @Override
    public String getBotUsername() {
        return botUsername;
    }

    @Override
    public String getBotToken() {
        return botToken;
    }
}
