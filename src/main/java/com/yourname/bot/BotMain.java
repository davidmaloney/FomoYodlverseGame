package com.yourname.bot;

import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import com.yourname.bot.handlers.HandlerRouter;

public class BotMain extends TelegramLongPollingBot {

    private final String botToken;
    private final String botUsername;
    private final HandlerRouter router;

    public BotMain(String botToken, String botUsername) {
        this.botToken = botToken;
        this.botUsername = botUsername;
        this.router = new HandlerRouter();
    }

    @Override
    public void onUpdateReceived(Update update) {
        router.handleUpdate(update);
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
