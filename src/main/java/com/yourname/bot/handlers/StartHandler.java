package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class StartHandler {

    public StartHandler() {
        // No arguments; reverted to working constructor
    }

    public void handle(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();
            String chatId = update.getMessage().getChatId().toString();

            if ("/start".equals(text)) {
                SendMessage message = new SendMessage();
                message.setChatId(chatId);
                message.setText("Welcome! The bot is running.");

                try {
                    BotMain sender = new BotMain("", ""); // placeholder, actual bot instance handles sending
                    sender.execute(message);
                } catch (TelegramApiException e) {
                    e.printStackTrace();
                }
            }
        }
    }
}
