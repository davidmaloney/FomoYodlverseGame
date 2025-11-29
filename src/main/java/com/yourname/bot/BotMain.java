// File: BotMain.java
import com.pengrad.telegrambot.TelegramBot;
import com.pengrad.telegrambot.model.Update;
import com.pengrad.telegrambot.request.SendMessage;
import com.pengrad.telegrambot.response.SendResponse;
import com.pengrad.telegrambot.TelegramBotListener;

public class BotMain {
    public static void main(String[] args) {
        // Replace "YOUR_BOT_TOKEN" with your BotFather token
        TelegramBot bot = new TelegramBot("YOUR_BOT_TOKEN");

        bot.setUpdatesListener(updates -> {
            for (Update update : updates) {
                if (update.message() != null && update.message().text() != null) {
                    String chatId = update.message().chat().id().toString();
                    String receivedText = update.message().text();

                    if (receivedText.equalsIgnoreCase("/start")) {
                        bot.execute(new SendMessage(chatId, "Bot is alive! 🚀"));
                    } else {
                        bot.execute(new SendMessage(chatId, "You said: " + receivedText));
                    }
                }
            }
            return updates.size();
        });

        System.out.println("Bot is running...");
    }
}
