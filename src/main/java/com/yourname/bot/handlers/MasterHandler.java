package com.yourname.bot.handlers;

import com.yourname.bot.BotMain;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.api.objects.Message;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

import java.util.HashMap;
import java.util.Map;

public class MasterHandler {

    private final BotMain bot;

    // Map to keep track of registered handlers by command
    private final Map<String, HandlerInterface> commandHandlers;

    public MasterHandler(BotMain bot) {
        this.bot = bot;
        this.commandHandlers = new HashMap<>();

        // Register handlers here
        registerHandlers();
    }

    private void registerHandlers() {
        // Example: register "start" command to StartHandler
        commandHandlers.put("/start", new StartHandler(bot));
        // Additional handlers can be registered here
        // commandHandlers.put("/explore", new ExploreHandler(bot));
        // commandHandlers.put("/battle", new BattleHandler(bot));
    }

    public void handleUpdate(Update update) {
        if (update.hasMessage()) {
            Message message = update.getMessage();
            String command = message.getText();

            if (commandHandlers.containsKey(command)) {
                commandHandlers.get(command).handle(message);
            } else {
                // Default behavior if no handler found
                sendMessage(message.getChatId(), "Sorry, I didn't understand that command.");
            }
        }
    }

    private void sendMessage(Long chatId, String text) {
        SendMessage msg = new SendMessage();
        msg.setChatId(chatId.toString());
        msg.setText(text);
        try {
            bot.execute(msg);
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

}
