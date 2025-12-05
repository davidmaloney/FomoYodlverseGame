package com.formalyodelversegame.bot.handlers;

import com.formalyodelversegame.bot.handlers.StartHandler;
import java.util.HashMap;
import java.util.Map;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;

// MasterHandler acts as the central dispatcher for all bot commands and game interactions
public class MasterHandler {

    private Map<String, BaseHandler> handlerMap;

    public MasterHandler() {
        handlerMap = new HashMap<>();
        registerHandlers();
    }

    // Registers all handlers
    private void registerHandlers() {
        // Command: /start → StartHandler
        handlerMap.put("start", new StartHandler());

        // Future handlers can be added here:
        // handlerMap.put("explore", new ExploreHandler());
        // handlerMap.put("battle", new BattleHandler());
        // handlerMap.put("inventory", new InventoryHandler());
        // handlerMap.put("badge", new BadgeHandler());
    }

    // Entry point: called from BotMain.java
    public void handleUpdate(Update update) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText().trim().toLowerCase();

            // Remove leading slash if exists
            if (messageText.startsWith("/")) {
                messageText = messageText.substring(1);
            }

            // Lookup the handler
            BaseHandler handler = handlerMap.get(messageText);
            if (handler != null) {
                handler.handle(update);
            } else {
                // Optional: default message for unrecognized commands
                if (update.getMessage().getChatId() != null) {
                    try {
                        SendMessage msg = new SendMessage();
                        msg.setChatId(update.getMessage().getChatId().toString());
                        msg.setText("Unknown command. Use /start to begin.");
                        new AbsSender() {
                            @Override
                            public String getBotToken() { return ""; }
                            @Override
                            public String getBotUsername() { return ""; }
                        }.execute(msg);
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                }
            }
        }
    }

    // BaseHandler interface for all future handlers
    public interface BaseHandler {
        void handle(Update update);
    }
}
