FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src ./src
RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/FOMOYodelBot-1.0.0.jar ./FOMOYodelBot.jar
CMD ["java", "-jar", "FOMOYodelBot.jar"]
