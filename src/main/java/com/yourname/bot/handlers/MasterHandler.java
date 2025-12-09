package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.CallbackQuery;
import org.telegram.telegrambots.meta.api.objects.Update;

import com.yourname.bot.game.services.TelegramBotService;

public class MasterHandler {

    public BotApiMethod<?> handle(Update update) {
        if (update.hasCallbackQuery()) {
            return handleCallback(update.getCallbackQuery());
        }

        Long chatId = update.getMessage().getChatId();
        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());
        sm.setText("Command not recognized — but I'm alive and working!");
        return sm;
    }

    public BotApiMethod<?> handleCallback(CallbackQuery query) {
        String data = query.getData();
        Long chatId = query.getMessage().getChatId();
        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());

        switch (data) {
            case "ACTION_FIGHT":
                sm.setText(TelegramBotService.handleFight(chatId));
                break;
            case "ACTION_PASS":
                sm.setText(TelegramBotService.handlePass(chatId));
                break;
            case "ACTION_EXPLORE":
                sm.setText(TelegramBotService.handleExplore(chatId));
                break;
            case "ACTION_INVENTORY":
                sm.setText(TelegramBotService.handleInventory(chatId));
                break;
            case "ACTION_STATS":
                sm.setText(TelegramBotService.handleStats(chatId));
                break;
            default:
                sm.setText("Unknown action selected.");
        }

        return sm;
    }
}
