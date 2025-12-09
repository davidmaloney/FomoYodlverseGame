package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton;

import com.yourname.bot.game.services.TelegramBotService;

import java.util.ArrayList;
import java.util.List;

public class StartHandler {

    public BotApiMethod<?> handle(Update update) {
        Long chatId = update.getMessage().getChatId();
        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());
        sm.setText("Welcome to the FomoYodlverse Game Bot! 🚀\nChoose an action to begin:");

        InlineKeyboardMarkup markup = InlineMenuManager.getMainMenu();
        sm.setReplyMarkup(markup);

        return sm;
    }
}
