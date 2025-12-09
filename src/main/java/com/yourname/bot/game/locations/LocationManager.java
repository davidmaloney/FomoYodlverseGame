package com.yourname.bot.game.locations;

import java.util.HashMap;
import java.util.Map;

public class LocationManager {

    private static Map<Long, String> locations = new HashMap<>();

    public static void setLocation(long chatId, String location) {
        locations.put(chatId, location);
    }

    public static String getLocation(long chatId) {
        return locations.getOrDefault(chatId, "Starting Zone");
    }
}
