package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.CallbackQuery;

public class HandlerRouter {

    private final StartHandler startHandler;
    private final MasterHandler masterHandler;
    private final TutorialHandler tutorialHandler;

    public HandlerRouter() {
        this.startHandler = new StartHandler();
        this.masterHandler = new MasterHandler();
        this.tutorialHandler = new TutorialHandler();
    }

    public BotApiMethod<?> route(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();
            if (text.equals("/start")) {
                return tutorialHandler.handle(update); // first-time players see tutorial
            }
            return masterHandler.handle(update);
        }

        if (update.hasCallbackQuery()) {
            CallbackQuery callback = update.getCallbackQuery();
            return masterHandler.handleCallback(callback);
        }

        return masterHandler.handle(update);
    }
}
