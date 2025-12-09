package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.replykeyboard.InlineKeyboardMarkup;
import org.telegram.telegrambots.meta.api.objects.replykeyboard.buttons.InlineKeyboardButton;

import java.util.ArrayList;
import java.util.List;

public class InlineMenuManager {

    public static InlineKeyboardMarkup getMainMenu() {
        InlineKeyboardMarkup markup = new InlineKeyboardMarkup();
        List<List<InlineKeyboardButton>> rows = new ArrayList<>();

        List<InlineKeyboardButton> row1 = new ArrayList<>();
        row1.add(new InlineKeyboardButton().setText("Fight").setCallbackData("ACTION_FIGHT"));
        row1.add(new InlineKeyboardButton().setText("Pass").setCallbackData("ACTION_PASS"));

        List<InlineKeyboardButton> row2 = new ArrayList<>();
        row2.add(new InlineKeyboardButton().setText("Explore").setCallbackData("ACTION_EXPLORE"));
        row2.add(new InlineKeyboardButton().setText("Inventory").setCallbackData("ACTION_INVENTORY"));

        List<InlineKeyboardButton> row3 = new ArrayList<>();
        row3.add(new InlineKeyboardButton().setText("Stats").setCallbackData("ACTION_STATS"));

        rows.add(row1);
        rows.add(row2);
        rows.add(row3);

        markup.setKeyboard(rows);
        return markup;
    }
}
