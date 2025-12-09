package com.yourname.bot.utils;

public class ExternalAssets {

    public static String getPlaceholderImage(String type) {
        switch (type.toLowerCase()) {
            case "boss": return "https://example.com/images/boss.png";
            case "enemy": return "https://example.com/images/enemy.png";
            case "item": return "https://example.com/images/item.png";
            default: return "https://example.com/images/default.png";
        }
    }
}
