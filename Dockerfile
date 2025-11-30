# Use official Maven + JDK 17 image for building
FROM maven:3.9.3-eclipse-temurin-17 AS build

# Set working directory
WORKDIR /app

# Copy pom.xml and download dependencies
COPY pom.xml .
RUN mvn dependency:go-offline -B

# Copy source code
COPY src ./src

# Build the project and package the jar
RUN mvn clean package -DskipTests

# Use official JDK 17 runtime image for execution
FROM eclipse-temurin:17-jdk

# Set working directory
WORKDIR /app

# Copy the jar from the build stage
COPY --from=build /app/target/FOMOYodelBot-1.0-SNAPSHOT.jar ./FOMOYodelBot.jar

# Expose the port for Render (match PORT environment variable)
EXPOSE 10000

# Command to run the bot
ENTRYPOINT ["java", "-jar", "FOMOYodelBot.jar"]
