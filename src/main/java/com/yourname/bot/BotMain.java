package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.bots.TelegramLongPollingBot;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends TelegramLongPollingBot {

    private final String botName;
    private final String botToken;
    private final HandlerRouter router;

    public BotMain(String botName, String botToken) {
        this.botName = botName;
        this.botToken = botToken;
        this.router = new HandlerRouter(this);
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
        try {
            router.route(update);  // Router handles routing to start/master/etc.
        } catch (Exception e) {
            e.printStackTrace();
            if (update.hasMessage() && update.getMessage().hasChatId()) {
                SendMessage msg = new SendMessage();
                msg.setChatId(update.getMessage().getChatId().toString());
                msg.setText("Error processing your message.");
                try {
                    execute(msg);
                } catch (TelegramApiException ex) {
                    ex.printStackTrace();
                }
            }
        }
    }
}
