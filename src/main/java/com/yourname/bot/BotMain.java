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

    public void handleUpdate(Update update) {
        System.out.println("=== BotMain.handleUpdate called ===");
        System.out.println("Update received! ChatId: " +
                update.getMessage().getChatId() + ", Text: " +
                update.getMessage().getText());
        System.out.println("=================================");

        BotApiMethod<?> response = router.route(update);

        if (response != null) {
            try {
                execute(response);
                System.out.println("Message sent to chatId: " + update.getMessage().getChatId());
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
