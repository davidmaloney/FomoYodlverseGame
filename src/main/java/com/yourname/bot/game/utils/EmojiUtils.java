package com.yourname.bot.utils;

public class EmojiUtils {

    public static String getEmoji(String name) {
        switch(name.toLowerCase()) {
            case "sword": return "⚔️";
            case "shield": return "🛡️";
            case "potion": return "🧪";
            case "coin": return "🪙";
            default: return "";
        }
    }
}
