package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;

public class HandlerRouter {

    private final StartHandler startHandler;
    private final MasterHandler masterHandler;

    public HandlerRouter() {
        startHandler = new StartHandler();
        masterHandler = new MasterHandler();
    }

    public void route(Update update) {
        if (update.hasMessage() && update.getMessage().getText().startsWith("/start")) {
            startHandler.handle(update);
        } else {
            masterHandler.handle(update);
        }
    }
}
