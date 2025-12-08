package com.yourname.bot;

import org.telegram.telegrambots.meta.api.objects.Update;
import com.yourname.bot.handlers.HandlerRouter;

public class BotMain {
    private final String botName;
    private final String botToken;
    private final String optionalId;

    // Add Router
    private final HandlerRouter router;

    public BotMain(String botName, String botToken, String optionalId) {
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;
        this.router = new HandlerRouter(this); // initialize router
    }

    public void handleUpdate(Update update) {
        // Minimal change: forward all updates to router
        router.route(update);
    }

    public String getBotName() { return botName; }
    public String getBotToken() { return botToken; }
    public String getOptionalId() { return optionalId; }
}
