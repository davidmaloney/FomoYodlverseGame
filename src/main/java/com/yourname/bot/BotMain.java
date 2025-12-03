package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.UpdatesListener;

public class BotMain {

    public static void main(String[] args) {

        // Load token from environment variable on Render
        String token = System.getenv("BOT_TOKEN");
        if (token == null || token.isEmpty()) {
            System.out.println("ERROR: BOT_TOKEN is missing");
            return;
        }

        TelegramBot bot = new TelegramBot(token);

        // Listen for updates
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    long chatId = update.message().chat().id();
                    String text = update.message().text();

                    // Simple echo test so we know bot is working
                    SendResponse response = bot.execute(new SendMessage(chatId, "You said: " + text));
                    System.out.println("Message sent: " + response.isOk());
                }
            }
            return UpdatesListener.CONFIRMED_UPDATES_ALL;
        });

        System.out.println("Bot is running...");
    }
}
