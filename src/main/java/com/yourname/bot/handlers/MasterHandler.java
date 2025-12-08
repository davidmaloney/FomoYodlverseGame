package com.yourname.bot.handlers;

import org.telegram.telegrambots.meta.api.objects.Update;

public class MasterHandler {

    public MasterHandler() {
        // original constructor
    }

    public void handle(Update update) {
        System.out.println("MasterHandler received an update.");
    }
}
