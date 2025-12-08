package com.yourname.bot;

import com.yourname.bot.handlers.HandlerRouter;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sun.net.httpserver.HttpServer;
import org.telegram.telegrambots.meta.api.objects.Update;

import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;

public class ApplicationMain {

    public static void main(String[] args) throws Exception {
        // Read port from environment or default to 10000
        int port = 10000;
        String portEnv = System.getenv("WEBHOOK_PORT");
        if (portEnv != null && !portEnv.isEmpty()) {
            try {
                port = Integer.parseInt(portEnv);
            } catch (NumberFormatException e) {
                System.err.println("Invalid WEBHOOK_PORT, using default 10000");
            }
        }

        // Initialize BotMain with placeholders
        String botToken = System.getenv("TELEGRAM_BOT_TOKEN");
        String botUsername = "FOMO_Yodel_Bot"; // Optional
        String botOwner = "BotOwner"; // Optional
        BotMain botInstance = new BotMain(botToken, botUsername, botOwner);
