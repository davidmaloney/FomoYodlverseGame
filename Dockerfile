# Build stage: maven + JDK 17
FROM maven:3.9.3-eclipse-temurin-17 AS build
WORKDIR /app

# Copy pom first to leverage caching for dependencies
COPY pom.xml ./

# Download dependencies and build (skip tests)
RUN mvn clean package -DskipTests

# Copy source and build again (source may already be compiled by previous step)
COPY src ./src
RUN mvn clean package -DskipTests

# Run stage: lean JRE
FROM eclipse-temurin:17-jre
WORKDIR /app

# Copy the shaded jar produced by maven-shade plugin
COPY --from=build /app/target/FOMOYodelBot.jar ./FOMOYodelBot.jar

# Expose port (Render needs a port to detect web service; render sets PORT env variable)
EXPOSE 10000

CMD ["java", "-jar", "FOMOYodelBot.jar"]
