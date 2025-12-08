package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import org.telegram.telegrambots.bots.DefaultAbsSender;
import org.telegram.telegrambots.bots.DefaultBotOptions;
import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends DefaultAbsSender {

    private final String botName;
    private final String botToken;
    private final String optionalId; // Could be guild ID or client ID

    private final HandlerRouter router;

    public BotMain(String botName, String botToken, String optionalId) {
        super(new DefaultBotOptions()); // Minimal options
        this.botName = botName;
        this.botToken = botToken;
        this.optionalId = optionalId;

        // Initialize the router with this bot
        this.router = new HandlerRouter(this);
    }

    @Override
    public String getBotToken() {
        return botToken;
    }

    public void handleUpdate(Update update) {
        try {
            // Route the update through the router
            BotApiMethod<?> method = router.route(update);

            if (method != null) {
                execute(method); // Sends the message via Telegram API
            }
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

    public String getBotName() {
        return botName;
    }

    public String getOptionalId() {
        return optionalId;
    }
}
