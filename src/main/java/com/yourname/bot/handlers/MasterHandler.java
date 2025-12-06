package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.util.HashMap;
import java.util.Map;

public class MasterHandler {

    private Map<String, BaseHandler> handlerMap;

    public MasterHandler() {
        handlerMap = new HashMap<>();
        registerHandlers();
    }

    private void registerHandlers() {
        // Core commands
        handlerMap.put("start", new StartHandler());
        handlerMap.put("explore", update -> sendPlaceholder(update, "Explore command not implemented yet."));
        handlerMap.put("battle", update -> sendPlaceholder(update, "Battle command not implemented yet."));
        handlerMap.put("inventory", update -> sendPlaceholder(update, "Inventory command not implemented yet."));
        handlerMap.put("badge", update -> sendPlaceholder(update, "Badge command not implemented yet."));
    }

    public void handleUpdate(Update update) throws TelegramApiException {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText().trim().toLowerCase();
            if (messageText.startsWith("/")) {
                messageText = messageText.substring(1);
            }

            BaseHandler handler = handlerMap.get(messageText);
            if (handler != null) {
                handler.handle(update);
            } else {
                // default unknown command
                SendMessage response = new SendMessage();
                response.setChatId(update.getMessage().getChatId().toString());
                response.setText("Unknown command. Use /start to begin.");
                AbsSender sender = new AbsSender() {
                    @Override
                    public String getBotToken() {
                        return System.getenv("TELEGRAM_BOT_TOKEN");
                    }
                };
                sender.execute(response);
            }
        }
    }

    // Simple interface for commands
    public interface BaseHandler {
        void handle(Update update) throws TelegramApiException;
    }

    // Placeholder for unimplemented commands
    private void sendPlaceholder(Update update, String text) throws TelegramApiException {
        SendMessage response = new SendMessage();
        response.setChatId(update.getMessage().getChatId().toString());
        response.setText(text);

        AbsSender sender = new AbsSender() {
            @Override
            public String getBotToken() {
                return System.getenv("TELEGRAM_BOT_TOKEN");
            }
        };
        sender.execute(response);
    }
}
