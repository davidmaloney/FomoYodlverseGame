package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.yourname.bot.BotMain;

public class StartHandler {

    private final BotMain bot;

    public StartHandler(BotMain bot) {
        this.bot = bot;
    }

    public BotApiMethod<?> handle(Update update) {
        Long chatId = update.getMessage().getChatId();
        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());
        sm.setText("Welcome to the FomoYodlverse Game Bot! 🚀");

        return sm;
    }
}
