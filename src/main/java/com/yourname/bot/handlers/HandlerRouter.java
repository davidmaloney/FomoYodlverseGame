package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.yourname.bot.BotMain;

public class HandlerRouter {

    private final StartHandler startHandler;
    private final MasterHandler masterHandler;

    public HandlerRouter(BotMain bot) {
        this.startHandler = new StartHandler(bot);
        this.masterHandler = new MasterHandler(bot);
    }

    public BotApiMethod<?> route(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();

            if (text.equals("/start")) {
                return startHandler.handle(update);
            }
        }

        // default fallback
        return masterHandler.handle(update);
    }
}
