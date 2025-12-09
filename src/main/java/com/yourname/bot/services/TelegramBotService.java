package com.yourname.bot.services;

import com.yourname.bot.game.combat.CombatEngine;
import com.yourname.bot.game.combat.PlayerManager;
import com.yourname.bot.game.combat.EnemyManager;
import com.yourname.bot.game.inventory.InventoryManager;
import com.yourname.bot.game.progression.RewardsManager;
import com.yourname.bot.game.locations.ExplorationManager;

public class TelegramBotService {

    // Called by MasterHandler when "Fight" is pressed
    public static String handleFight(long chatId) {
        return CombatEngine.fightTurn(chatId);
    }

    // Called when "Pass" is pressed
    public static String handlePass(long chatId) {
        return "You chose to pass your turn. Nothing happens.";
    }

    // Called when "Explore" is pressed
    public static String handleExplore(long chatId) {
        String result = ExplorationManager.explore(chatId);
        String reward = RewardsManager.grantReward(chatId);
        return result + "\n" + reward;
    }

    // Called when "Inventory" is pressed
    public static String handleInventory(long chatId) {
        return InventoryManager.listInventory(chatId);
    }

    // Called when "Stats" is pressed
    public static String handleStats(long chatId) {
        return "HP: " + PlayerManager.getPlayerHP(chatId) +
               "\nDamage: " + PlayerManager.getPlayerDamage(chatId);
    }
}
