package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;

public class MasterHandler {

    public interface BaseHandler {
        void handle(Update update, AbsSender sender);
    }

    public void handle(Update update, AbsSender sender) {
        // Example handling: echo the message text
        if (update.hasMessage() && update.getMessage().hasText()) {
            String chatId = update.getMessage().getChatId().toString();
            String receivedText = update.getMessage().getText();

            SendMessage response = new SendMessage();
            response.setChatId(chatId);
            response.setText("You said: " + receivedText);

            try {
                sender.execute(response);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
