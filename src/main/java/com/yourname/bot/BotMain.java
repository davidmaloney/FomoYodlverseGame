package com.yourname.bot;

import org.telegram.telegrambots.bots.DefaultAbsSender;
import org.telegram.telegrambots.bots.DefaultBotOptions;
import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import com.yourname.bot.handlers.HandlerRouter;

public class BotMain extends DefaultAbsSender {
    private final String botName;
    private final String botToken;
    private final String optionalId; // Could be guild ID or client ID
    private final HandlerRouter router;

    public BotMain(String botName, String botToken, String optionalId) {
        super(new DefaultBotOptions());
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;

        // Initialize router
        this.router = new HandlerRouter(this);
    }

    @Override
    public String getBotToken() {
        return botToken;
    }

    // This method receives updates from ApplicationMain
    public void handleUpdate(Update update) {
        if (update == null) return;

        // Route the update to the appropriate handler
        BotApiMethod<?> response = router.route(update);

        // Execute the response if it exists
        if (response != null) {
            try {
                execute(response);  // <-- THIS sends the message to Telegram
            } catch (TelegramApiException e) {
                e.printStackTrace();
            }
        }
    }

    public String getBotName() {
        return botName;
    }

    public String getOptionalId() {
        return optionalId;
    }
}
