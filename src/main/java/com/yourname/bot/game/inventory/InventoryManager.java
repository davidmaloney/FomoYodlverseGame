package com.yourname.bot.game.inventory;

public class InventoryManager {

    public static String listInventory(long chatId) {
        String[] items = ItemManager.getInventory(chatId);
        if (items.length == 0) {
            return "Your inventory is empty.";
        }
        StringBuilder sb = new StringBuilder("Inventory:\n");
        for (String item : items) {
            sb.append("- ").append(item).append("\n");
        }
        return sb.toString();
    }
}
