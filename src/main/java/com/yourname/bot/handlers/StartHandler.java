package com.formalyodelversegame.bot.handlers;

import com.formalyodelversegame.bot.handlers.MasterHandler.BaseHandler;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;

public class StartHandler implements BaseHandler {

    @Override
    public void handle(Update update, AbsSender sender) {
        if (update.getMessage() != null && update.getMessage().hasText()) {
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
