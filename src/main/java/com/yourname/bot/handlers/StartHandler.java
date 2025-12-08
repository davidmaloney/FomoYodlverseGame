package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class StartHandler {

    private final BotMain bot;

    public StartHandler(BotMain bot) {
        this.bot = bot;
    }

    public void handle(Update update) {
        if (update.hasMessage() && update.getMessage().hasChatId()) {
            SendMessage message = new SendMessage();
            message.setChatId(update.getMessage().getChatId().toString());
            message.setText("Welcome to FOMO Euroverse game!");  // Main start message
            try {
                bot.execute(message);
            } catch (TelegramApiException e) {
                e.printStackTrace();
            }
        }
    }
}
