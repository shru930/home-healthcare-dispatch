# ---- Stage 1: build the Spring Boot jar with the Maven wrapper (JDK 21)
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /src
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src/ src/
RUN ./mvnw -B -q -DskipTests package && cp target/home-healthcare-dispatch-*.jar /app.jar

# ---- Stage 2: small runtime image (JRE only, non-root user)
FROM eclipse-temurin:21-jre-alpine
RUN addgroup -S app && adduser -S app -G app && apk add --no-cache wget
WORKDIR /app
COPY --from=build /app.jar app.jar
USER app
EXPOSE 8090 3025
ENV JAVA_OPTS="-XX:MaxRAMPercentage=75" LOG_FILE=/tmp/backend.log
HEALTHCHECK --interval=15s --timeout=5s --start-period=60s --retries=10 \
  CMD wget -qO- http://localhost:8090/actuator/health | grep -q '"status":"UP"' || exit 1
ENTRYPOINT ["sh", "-c", "java $JAVA_OPTS -jar app.jar"]
