package com.yourname.bot.game.inventory;

import java.util.HashMap;
import java.util.Map;

public class ItemManager {

    private static Map<Long, String[]> items = new HashMap<>();

    public static void addItem(long chatId, String item) {
        String[] inv = items.getOrDefault(chatId, new String[0]);
        String[] newInv = new String[inv.length + 1];
        System.arraycopy(inv, 0, newInv, 0, inv.length);
        newInv[inv.length] = item;
        items.put(chatId, newInv);
    }

    public static String[] getInventory(long chatId) {
        return items.getOrDefault(chatId, new String[0]);
    }
}
