package com.formalyodelversegame.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.bots.AbsSender;

// MasterHandler acts as the central dispatcher for all bot commands and game interactions
public class MasterHandler {

    private BaseHandler startHandler;

    public MasterHandler() {
        // Initialize handlers
        startHandler = new StartHandler();
    }

    // Entry point: called from BotMain.java
    public void handleUpdate(Update update, AbsSender sender) {
        if (update.hasMessage() && update.getMessage().hasText()) {
            String messageText = update.getMessage().getText().trim().toLowerCase();

            // Remove leading slash if exists
            if (messageText.startsWith("/")) {
                messageText = messageText.substring(1);
            }

            // Route commands
            switch (messageText) {
                case "start":
                    startHandler.handle(update, sender);
                    break;

                // Future commands:
                // case "explore":
                //     exploreHandler.handle(update, sender);
                //     break;

                default:
                    // Send unknown command message
                    try {
                        sender.execute(new org.telegram.telegrambots.meta.api.methods.send.SendMessage(
                                update.getMessage().getChatId().toString(),
                                "Unknown command. Use /start to begin."
                        ));
                    } catch (Exception e) {
                        e.printStackTrace();
                    }
                    break;
            }
        }
    }

    // BaseHandler interface for all handlers
    public interface BaseHandler {
        void handle(Update update, AbsSender sender);
    }
}
