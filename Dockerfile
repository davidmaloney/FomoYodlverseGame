# Stage 1: build
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

# Stage 2: runtime
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/FOMOYodelBot-1.0.0.jar /app/FOMOYodelBot.jar
ENTRYPOINT ["java","-jar","FOMOYodelBot.jar"]
