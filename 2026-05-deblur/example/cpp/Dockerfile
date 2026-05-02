FROM gcc:13 AS build
WORKDIR /app
COPY solution.cpp .
RUN g++ -O2 -static-libgcc -static-libstdc++ -o /app/solution solution.cpp

FROM debian:bookworm-slim
COPY --from=build /app/solution /app/solution
CMD ["/app/solution"]
