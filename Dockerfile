FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -e -X -DskipTests package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/FOMOYodelBot-1.0-SNAPSHOT.jar app.jar

EXPOSE 4567

CMD ["java", "-jar", "app.jar"]
