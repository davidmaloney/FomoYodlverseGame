package com.yourname.bot.services;

import java.util.HashMap;
import java.util.Map;

// Placeholder for external storage integration
public class DatabaseManager {

    private static Map<String, String> kvStore = new HashMap<>();

    public static void put(String key, String value) {
        kvStore.put(key, value);
    }

    public static String get(String key) {
        return kvStore.getOrDefault(key, "");
    }

    public static boolean exists(String key) {
        return kvStore.containsKey(key);
    }
}
