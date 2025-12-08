package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;

public class StartHandler {

    public StartHandler() {
        // original constructor
    }

    public void handle(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            System.out.println("StartHandler received message: " + update.getMessage().getText());
        }
    }
}
