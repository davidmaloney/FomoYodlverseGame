package com.yourname.bot.game.combat;

import java.util.HashMap;
import java.util.Map;

public class EnemyManager {

    private static Map<Long, Integer> enemyHP = new HashMap<>();
    private static Map<Long, Integer> enemyDamage = new HashMap<>();

    public static int getEnemyHP(long chatId) {
        return enemyHP.getOrDefault(chatId, 50);
    }

    public static void dealDamage(long chatId, int dmg) {
        int hp = getEnemyHP(chatId) - dmg;
        enemyHP.put(chatId, Math.max(hp, 0));
    }

    public static int getEnemyDamage(long chatId) {
        return enemyDamage.getOrDefault(chatId, 5);
    }

    public static void setEnemyDamage(long chatId, int dmg) {
        enemyDamage.put(chatId, dmg);
    }
}
