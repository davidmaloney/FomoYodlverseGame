package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Message;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;

public class StartHandler {

    // Called by MasterHandler when /start is received
    public void handle(Update update) {
        Message message = update.getMessage();
        if (message != null && message.hasText()) {
            String chatId = message.getChatId().toString();
            String welcomeText = "🚀 Welcome to the FOMO YODLverse! " +
                    "Your adventure starts now. Use the buttons to explore, battle, and collect loot!";

            SendMessage response = new SendMessage();
            response.setChatId(chatId);
            response.setText(welcomeText);

            try {
                new AbsSender() {
                    @Override
                    public String getBotToken() { return ""; }
                    @Override
                    public String getBotUsername() { return ""; }
                }.execute(response);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
