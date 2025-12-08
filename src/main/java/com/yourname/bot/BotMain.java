package com.yourname.bot;

import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;

public class BotMain extends TelegramLongPollingBot {

    private final String token;
    private final String clientId;
    private final String guildId;

    // Constructor with parameters for ApplicationMain to call
    public BotMain(String token, String clientId, String guildId) {
        this.token = token;
        this.clientId = clientId;
        this.guildId = guildId;
    }

    @Override
    public void onUpdateReceived(Update update) {
        // Normal polling logic: handle messages and commands
        if (update.hasMessage() && update.getMessage().hasText()) {
            String chatId = update.getMessage().getChatId().toString();
            String text = update.getMessage().getText();

            SendMessage message = new SendMessage();
            message.setChatId(chatId);
            message.setText("Echo: " + text);

            try {
                execute(message);
            } catch (TelegramApiException e) {
                e.printStackTrace();
            }
        }
    }

    @Override
    public String getBotUsername() {
        return clientId; // Or your bot username if needed
    }

    @Override
    public String getBotToken() {
        return token;
    }

    // Optional: helper to safely receive updates from ApplicationMain webhook
    public void receiveWebhookUpdate(Update update) {
        // Forward updates to normal polling logic if needed
        onUpdateReceived(update);
    }
}
