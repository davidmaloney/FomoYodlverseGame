package com.yourname.bot;

import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;

public class BotMain {

    public static void main(String[] args) {
        // Use environment variable for bot token
        String token = System.getenv("BOT_TOKEN");
        TelegramBot bot = new TelegramBot(token);

        // Set updates listener
        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    String chatId = update.message().chat().id().toString();
                    String receivedText = update.message().text();

                    // Only respond to /start command
                    if (receivedText.equalsIgnoreCase("/start")) {
                        bot.execute(new SendMessage(chatId, "Bot is alive! ✅"));
                    } else {
                        bot.execute(new SendMessage(chatId, "You said: " + receivedText));
                    }
                }
            }
            // Confirm all updates handled so Telegram doesn't resend
            return TelegramBot.CONFIRMED_UPDATES_ALL;
        });

        System.out.println("Bot is running...");
    }
}
