package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.meta.api.objects.Update;

public class BotMain {
    private final HandlerRouter router;

    // Constructor now receives token/name if needed in future
    public BotMain(String botToken, String botUsername, String botOwner) {
        this.router = new HandlerRouter(this);
        // Any additional initialization if needed
    }

    // Method to process updates coming from webhook
    public void handleUpdate(Update update) {
        try {
            router.route(update); // Existing routing logic
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
