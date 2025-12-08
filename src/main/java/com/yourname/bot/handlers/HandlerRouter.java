package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;

public class HandlerRouter {

    private final StartHandler startHandler;
    private final MasterHandler masterHandler;

    public HandlerRouter(BotMain bot) {
        this.startHandler = new StartHandler(bot);
        this.masterHandler = new MasterHandler(bot);
    }

    public void route(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String text = update.getMessage().getText();
            if (text.equals("/start")) {
                startHandler.handle(update);
            } else {
                masterHandler.handle(update);
            }
        }
    }
}
