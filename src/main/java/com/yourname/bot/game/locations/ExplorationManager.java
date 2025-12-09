package com.yourname.bot.game.locations;

import java.util.Random;

public class ExplorationManager {

    private static final String[] EVENTS = {
            "You found a hidden treasure!",
            "A wild enemy appears!",
            "Nothing here... just a peaceful path."
    };

    public static String explore(long chatId) {
        Random rand = new Random();
        int idx = rand.nextInt(EVENTS.length);
        return EVENTS[idx];
    }
}
