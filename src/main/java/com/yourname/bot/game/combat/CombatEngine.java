package com.yourname.bot.game.combat;

import com.yourname.bot.game.combat.PlayerManager;
import com.yourname.bot.game.combat.EnemyManager;

public class CombatEngine {

    public static String fightTurn(long chatId) {
        // Placeholder logic for a fight
        int playerDamage = PlayerManager.getPlayerDamage(chatId);
        int enemyDamage = EnemyManager.getEnemyDamage(chatId);

        PlayerManager.dealDamage(chatId, enemyDamage);
        EnemyManager.dealDamage(chatId, playerDamage);

        return "You dealt " + playerDamage + " damage!\n" +
               "Enemy dealt " + enemyDamage + " damage!\n" +
               "Your HP: " + PlayerManager.getPlayerHP(chatId) +
               "\nEnemy HP: " + EnemyManager.getEnemyHP(chatId);
    }
}
