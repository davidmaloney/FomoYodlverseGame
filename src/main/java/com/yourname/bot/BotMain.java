package com.yourname.bot;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.bots.DefaultAbsSender;
import org.telegram.telegrambots.bots.DefaultBotOptions;

import com.yourname.bot.handlers.HandlerRouter;

public class BotMain extends DefaultAbsSender {
    private final String botName;
    private final String botToken;
    private final String optionalId; // Could be guild ID or client ID
    private final HandlerRouter router;

    // Constructor
    public BotMain(String botName, String botToken, String optionalId) {
        super(new DefaultBotOptions());
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;
        this.router = new HandlerRouter(this);
    }

    @Override
    public String getBotToken() {
        return botToken;
    }

    public String getBotName() {
        return botName;
    }

    public String getOptionalId() {
        return optionalId;
    }

    // Handle incoming updates and forward to router
    public void handleUpdate(Update update) {
        BotApiMethod<?> response = router.route(update);

        if (response != null) {
            try {
                execute(response);
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
