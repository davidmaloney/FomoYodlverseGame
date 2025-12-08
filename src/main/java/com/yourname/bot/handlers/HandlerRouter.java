package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;

public class HandlerRouter {

    private final StartHandler startHandler;
    private final MasterHandler masterHandler;

    public HandlerRouter() {
        this.startHandler = new StartHandler();
        this.masterHandler = new MasterHandler();
    }

    public void handleUpdate(Update update) {
        if (update.hasMessage() && update.getMessage().getText().equals("/start")) {
            startHandler.handle(update);
        } else {
            masterHandler.handle(update);
        }
    }
}
