package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.methods.BotApiMethod;
import org.telegram.telegrambots.meta.api.methods.send.SendMessage;
import org.telegram.telegrambots.meta.api.objects.Update;

public class TutorialHandler {

    public BotApiMethod<?> handle(Update update) {
        Long chatId = update.getMessage().getChatId();
        SendMessage sm = new SendMessage();
        sm.setChatId(chatId.toString());
        sm.setText(
            "Welcome to FomoYodlverse! 🎮\n\n" +
            "This game is entirely button-driven. " +
            "You will never need to type anything.\n\n" +
            "Use the buttons below to Fight, Pass, Explore, " +
            "check your Inventory, or view your Stats.\n\n" +
            "Enjoy the adventure!"
        );
        sm.setReplyMarkup(InlineMenuManager.getMainMenu());
        return sm;
    }
}
