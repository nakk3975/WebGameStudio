FROM maven:3.9.11-eclipse-temurin-21 AS build
WORKDIR /build
COPY apps/api/pom.xml ./pom.xml
COPY apps/api/maven-settings.xml ./settings.xml
RUN mvn -B -s settings.xml dependency:go-offline
COPY apps/api/src ./src
RUN mvn -B -s settings.xml verify

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
RUN groupadd --system app && useradd --system --gid app app
COPY --from=build /build/target/ghostdesk-api.jar /app/app.jar
USER app
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=65 -XX:InitialRAMPercentage=20 -XX:+ExitOnOutOfMemoryError"
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
