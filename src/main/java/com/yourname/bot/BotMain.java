import org.telegram.telegrambots.bots.TelegramWebhookBot;
import org.telegram.telegrambots.meta.api.objects.Update;
import org.telegram.telegrambots.meta.exceptions.TelegramApiException;

public class BotMain extends TelegramWebhookBot {

    private final MasterHandler masterHandler;

    public BotMain() {
        this.masterHandler = new MasterHandler(); // Delegator to master
    }

    @Override
    public String getBotUsername() {
        return "FOMOYodlVerseBot"; // Replace with your bot's exact username
    }

    @Override
    public String getBotToken() {
        return "8278589036:AAGdjUb7BCQf9KtYA_fkgaopfIiEM8fH6CM"; // Your current token
    }

    @Override
    public void onWebhookUpdateReceived(Update update) {
        try {
            masterHandler.handleUpdate(update); // Send everything to Master Handler
        } catch (TelegramApiException e) {
            e.printStackTrace();
        }
    }

    @Override
    public String getBotPath() {
        return "/"; // Default webhook path
    }
}
