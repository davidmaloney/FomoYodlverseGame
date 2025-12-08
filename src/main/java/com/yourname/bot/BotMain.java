package com.yourname.bot;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;

public class BotMain extends TelegramLongPollingBot {

    private final String botName;
    private final String botToken;

    public BotMain(String botName, String botToken) {
        this.botName = botName;
        this.botToken = botToken;
    }

    @Override
    public String getBotUsername() {
        return botName;
    }

    @Override
    public String getBotToken() {
        return botToken;
    }

    @Override
    public void onUpdateReceived(Update update) {
        handleUpdate(update);
    }

    public void handleUpdate(Update update) {
        // Keep gameplay logic intact
        // Forward update to router or handlers
        Router.root(update, this);
    }

    // Helper method to send messages
    public void sendMessage(String chatId, String text) {
        SendMessage message = new SendMessage();
        message.setChatId(chatId);
        message.setText(text);

        try {
            execute(message);
        } catch (TelegramApiException e) {
            e.printStackTrace(); // We'll handle this with StartHandler debug
        }
    }
}
