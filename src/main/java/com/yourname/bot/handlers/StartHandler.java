package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;

public class StartHandler {

    public static void handleStart(Update update, BotMain bot) {
        String chatId = update.getMessage().getChatId().toString();
        String welcomeText = "Welcome to FOMO Euroverse game!";

        // ===== New debug snippet =====
        System.out.println("=== StartHandler Debug ===");
        System.out.println("ChatId: " + chatId);
        System.out.println("Message object: " + update.getMessage());
        System.out.println("Outgoing text: " + welcomeText);
        System.out.println("===========================");
        // =============================

        SendMessage message = new SendMessage();
        message.setChatId(chatId);
        message.setText(welcomeText);

        try {
            bot.execute(message);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
