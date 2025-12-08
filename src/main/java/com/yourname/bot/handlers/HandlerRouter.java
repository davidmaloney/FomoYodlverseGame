package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;

public class Router {
    private static final StartHandler startHandler = new StartHandler();

    public static void handle(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();
            if ("/start".equals(text)) {
                startHandler.handle(update);
            }
            // Add more handlers here as needed
        }
    }
}
