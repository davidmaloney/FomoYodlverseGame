# Use Maven + JDK for building
FROM maven:3.9.3-eclipse-temurin-17 AS build

WORKDIR /app

# Copy pom.xml and install dependencies
COPY pom.xml .
RUN mvn dependency:resolve

# Copy source code
COPY src ./src

# Build fat JAR
RUN mvn clean package -DskipTests

# Run stage
FROM eclipse-temurin:17-jdk-jammy

WORKDIR /app

# Copy fat JAR
COPY --from=build /app/target/FOMOYodelBot-1.0-SNAPSHOT.jar ./FOMOYodelBot.jar

EXPOSE 10000

CMD ["java", "-jar", "FOMOYodelBot.jar"]
