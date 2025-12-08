# ----- BUILD STAGE -----
FROM maven:3.9.6-eclipse-temurin-17 AS build
WORKDIR /app

# Copy Maven descriptor first (faster rebuilds)
COPY pom.xml .
RUN mvn -q dependency:go-offline

# Now copy the rest of the source
COPY src ./src

# Build shaded JAR
RUN mvn clean package -DskipTests

# ----- RUNTIME STAGE -----
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the shaded JAR (please ensure the filename matches your build)
COPY --from=build /app/target/FOMOYodelBot-1.0.0.jar app.jar

# Render expects your app to listen on the PORT env var; Telegram requires webhook port to be 443/80/88/8443.
# We'll expose 443 so it matches Telegram's allowed port.
EXPOSE 443

ENTRYPOINT ["java","-jar","app.jar"]
