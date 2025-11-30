package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.UpdatesListener;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;

public class BotMain {
    public static void main(String[] args) {

        // Replace YOUR_BOT_TOKEN with your actual bot token
        TelegramBot bot = new TelegramBot("YOUR_BOT_TOKEN");

        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {

                if (update.message() != null && update.message().text() != null) {
                    String chatId = update.message().chat().id().toString();
                    String text = update.message().text();

                    if (text.equalsIgnoreCase("/start")) {
                        bot.execute(new SendMessage(chatId, "Bot is alive! 🚀"));
                    } else {
                        bot.execute(new SendMessage(chatId, "You said: " + text));
                    }
                }
            }
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        System.out.println("Bot is running...");
    }
}
