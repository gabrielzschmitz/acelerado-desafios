FROM gcc:13 AS build
WORKDIR /app
COPY solution.c .
RUN gcc -O2 -o /app/solution solution.c

FROM debian:bookworm-slim
COPY --from=build /app/solution /app/solution
CMD ["/app/solution"]
