package com.yourname.bot.services;

import java.util.Timer;
import java.util.TimerTask;

public class Scheduler {

    private static final Timer timer = new Timer();

    // Schedules recurring tasks, e.g., timed buffs or events
    public static void scheduleRecurring(long intervalMs, Runnable task) {
        timer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                task.run();
            }
        }, 0, intervalMs);
    }
}
