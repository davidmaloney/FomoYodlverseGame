package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;

import java.util.HashMap;
import java.util.Map;

public class MasterHandler {

    private final Map<String, BaseHandler> handlerMap;

    public MasterHandler() {
        handlerMap = new HashMap<>();
        registerHandlers();
    }

    // Register all handlers
    private void registerHandlers() {
        handlerMap.put("start", new StartHandler());
        // Future handlers can be added here
        // handlerMap.put("explore", new ExploreHandler());
    }

    // Handle updates, passing in AbsSender from BotMain
    public void handleUpdate(Update update, AbsSender sender) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText().trim().toLowerCase();

            if (messageText.startsWith("/")) {
                messageText = messageText.substring(1);
            }

            BaseHandler handler = handlerMap.get(messageText);
            if (handler != null) {
                handler.handle(update, sender);
            } else {
                SendMessage response = new SendMessage();
                response.setChatId(update.getMessage().getChatId().toString());
                response.setText("Unknown command. Use /start to begin.");
                try {
                    sender.execute(response);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // BaseHandler interface
    public interface BaseHandler {
        void handle(Update update, AbsSender sender);
    }
}
