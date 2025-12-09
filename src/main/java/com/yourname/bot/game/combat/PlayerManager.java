package com.yourname.bot.game.combat;

import java.util.HashMap;
import java.util.Map;

public class PlayerManager {

    private static Map<Long, Integer> playerHP = new HashMap<>();
    private static Map<Long, Integer> playerDamage = new HashMap<>();

    public static int getPlayerHP(long chatId) {
        return playerHP.getOrDefault(chatId, 100);
    }

    public static void dealDamage(long chatId, int damage) {
        int hp = getPlayerHP(chatId) - damage;
        playerHP.put(chatId, Math.max(hp, 0));
    }

    public static int getPlayerDamage(long chatId) {
        return playerDamage.getOrDefault(chatId, 10); // Default 10 damage
    }

    public static void setPlayerDamage(long chatId, int dmg) {
        playerDamage.put(chatId, dmg);
    }
}
