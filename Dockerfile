# Use an official Maven + JDK image
FROM maven:3.9.3-eclipse-temurin-17 AS build

# Set working directory
WORKDIR /app

# Copy pom.xml first for dependency caching
COPY pom.xml .

# Install dependencies (without go-offline)
RUN mvn clean package -DskipTests

# Copy the source code
COPY src ./src

# Build the project
RUN mvn clean package -DskipTests

# Run stage
FROM eclipse-temurin:17-jdk-jammy

# Set working directory
WORKDIR /app

# Copy built jar from build stage
COPY --from=build /app/target/FOMOYodelBot-1.0-SNAPSHOT.jar ./FOMOYodelBot.jar

# Expose port for Render HTTP endpoint (optional)
EXPOSE 10000

# Command to run bot
CMD ["java", "-jar", "FOMOYodelBot.jar"]
