package com.yourname.bot;

import org.telegram.telegrambots.meta.api.objects.Update;
import com.yourname.bot.handlers.HandlerRouter;

public class BotMain {
    private final String botName;
    private final String botToken;
    private final String optionalId; // Could be guild ID or client ID
    private final HandlerRouter router;

    public BotMain(String botName, String botToken, String optionalId) {
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;
        this.router = new HandlerRouter(this); // Initialize router
    }

    // Forwarded from ApplicationMain
    public void handleUpdate(Update update) {
        // Only process messages with text
        if (update.hasMessage() && update.getMessage().hasText()) {
            router.route(update); // Forward the full Update to the router
        }
    }

    public String getBotName() {
        return botName;
    }

    public String getBotToken() {
        return botToken;
    }

    public String getOptionalId() {
        return optionalId;
    }
}
