package com.yourname.bot.game.combat;

import java.util.HashMap;
import java.util.Map;

public class BossManager {

    private static Map<Long, Integer> bossHP = new HashMap<>();

    public static int getBossHP(long chatId) {
        return bossHP.getOrDefault(chatId, 100); // Default 100 HP
    }

    public static void setBossHP(long chatId, int hp) {
        bossHP.put(chatId, hp);
    }

    public static void resetBoss(long chatId) {
        bossHP.put(chatId, 100);
    }
}
