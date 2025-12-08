package com.yourname.bot;

import org.telegram.telegrambots.meta.TelegramBotsApi;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.updatesreceivers.DefaultBotSession;

public class ApplicationMain {
    public static void main(String[] args) {
        String botUsername = System.getenv("BOT_USERNAME");
        String botToken = System.getenv("BOT_TOKEN");

        BotMain bot = new BotMain(botUsername, botToken);

        try {
            TelegramBotsApi botsApi = new TelegramBotsApi(DefaultBotSession.class);
            botsApi.registerBot(bot);
            System.out.println("Bot started successfully!");
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }
}
