public void handleUpdate(Update update) {
    System.out.println("=== BotMain.handleUpdate called ===");
    System.out.println("Update received! ChatId: " +
            update.getMessage().getChatId() + ", Text: " +
            update.getMessage().getText());
    System.out.println("=================================");

    BotApiMethod<?> response = router.route(update);

    if (response != null) {
        try {
            var result = execute(response); // <-- capture Telegram API response
            System.out.println("Message sent to chatId: " + update.getMessage().getChatId());
            System.out.println("Telegram API response: " + result); // <-- NEW debug line
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
