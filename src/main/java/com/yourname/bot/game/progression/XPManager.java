package com.yourname.bot.game.progression;

import java.util.HashMap;
import java.util.Map;

public class XPManager {

    private static Map<Long, Integer> xp = new HashMap<>();

    public static int getXP(long chatId) {
        return xp.getOrDefault(chatId, 0);
    }

    public static void addXP(long chatId, int amount) {
        xp.put(chatId, getXP(chatId) + amount);
    }

    public static int getLevel(long chatId) {
        return getXP(chatId) / 100 + 1; // Every 100 XP = 1 level
    }
}
