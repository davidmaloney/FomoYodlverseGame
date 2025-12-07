package com.yourname.bot;

public class ApplicationMain {
    public static void main(String[] args) {
        // Create BotMain instance with the required arguments
        String arg1 = "firstArg";
        String arg2 = "secondArg";
        String arg3 = "thirdArg";

        BotMain bot = new BotMain(arg1, arg2, arg3);

        // Start the bot
        bot.start();
    }
}
