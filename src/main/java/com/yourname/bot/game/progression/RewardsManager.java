package com.yourname.bot.game.progression;

public class RewardsManager {

    public static String grantReward(long chatId) {
        XPManager.addXP(chatId, 20);
        return "You gained 20 XP! Level: " + XPManager.getLevel(chatId);
    }
}
