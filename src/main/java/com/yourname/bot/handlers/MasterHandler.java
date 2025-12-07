package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.yourname.bot.BotMain;

public class MasterHandler {

    private final BotMain bot;

    public MasterHandler(BotMain bot) {
        this.bot = bot;
    }

    public BotApiMethod<?> handle(Update update) {
        Long chatId = update.getMessage().getChatId();

        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());
        sm.setText("Command not recognized — but I'm alive and working!");

        return sm;
    }
}
