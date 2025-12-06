package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;

public class StartHandler {

    public void handleStart(Update update, AbsSender sender) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String chatId = update.getMessage().getChatId().toString();
            String welcomeText = "🚀 Welcome to the FOMO YODLverse! " +
                    "Your adventure starts now. Use the buttons to explore, battle, and collect loot!";

            SendMessage response = new SendMessage();
            response.setChatId(chatId);
            response.setText(welcomeText);

            try {
                sender.execute(response);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
