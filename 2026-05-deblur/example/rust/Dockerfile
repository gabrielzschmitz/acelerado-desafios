FROM rust:1.83-slim AS build
WORKDIR /app
COPY solution.rs .
RUN rustc -O solution.rs -o /app/solution

FROM debian:bookworm-slim
COPY --from=build /app/solution /app/solution
CMD ["/app/solution"]
