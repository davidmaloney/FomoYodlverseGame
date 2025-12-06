package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class StartHandler implements MasterHandler.BaseHandler {

    @Override
    public void handle(Update update) throws TelegramApiException {
        SendMessage response = new SendMessage();
        response.setChatId(update.getMessage().getChatId().toString());
        response.setText("🚀 Welcome to the FOMO YODLverse! Your adventure starts now. Use the buttons to explore, battle, and collect loot!");

        AbsSender sender = new AbsSender() {
            @Override
            public String getBotToken() {
                return System.getenv("TELEGRAM_BOT_TOKEN");
            }
        };

        sender.execute(response);
    }
}
