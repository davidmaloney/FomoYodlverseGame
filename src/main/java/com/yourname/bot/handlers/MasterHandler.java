package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;

import java.util.HashMap;
import java.util.Map;

public class MasterHandler {

    private final Map<String, BaseHandler> handlerMap;

    public MasterHandler() {
        handlerMap = new HashMap<>();
        registerHandlers();
    }

    // Registers all handlers
    private void registerHandlers() {
        handlerMap.put("start", new StartHandler());
        // Future handlers:
        // handlerMap.put("explore", new ExploreHandler());
        // handlerMap.put("battle", new BattleHandler());
    }

    // Entry point from BotMain
    public void handleUpdate(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText().trim().toLowerCase();

            if (messageText.startsWith("/")) {
                messageText = messageText.substring(1);
            }

            BaseHandler handler = handlerMap.get(messageText);
            if (handler != null) {
                handler.handle(update);
            } else {
                // Default response for unknown commands
                String chatId = update.getMessage().getChatId().toString();
                SendMessage response = new SendMessage();
                response.setChatId(chatId);
                response.setText("Unknown command. Use /start to begin.");
                try {
                    AbsSender sender = new AbsSender() {
                        @Override
                        public String getBotToken() {
                            return null; // placeholder, not used here
                        }
                    };
                    sender.execute(response);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
        }
    }

    // BaseHandler interface
    public interface BaseHandler {
        void handle(Update update);
    }
}
