# Use an official Maven + JDK image to build the project
FROM maven:3.9.1-eclipse-temurin-17 AS build

# Set working directory
WORKDIR /app

# Copy pom.xml and source code
COPY pom.xml .
COPY src ./src

# Build the project
RUN mvn clean package -DskipTests

# Use a lighter JDK image for running the bot
FROM eclipse-temurin:17-jre

# Set working directory
WORKDIR /app

# Copy the built jar from the build stage
COPY --from=build /app/target/*.jar bot.jar

# Set environment variables (placeholders, you can override in Render)
ENV BOT_TOKEN=your-telegram-bot-token

# Command to run the bot
CMD ["java", "-jar", "bot.jar"]
