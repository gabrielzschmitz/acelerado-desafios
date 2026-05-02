FROM debian:bookworm-slim AS build
ARG ZIG_VERSION=0.13.0
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates wget xz-utils \
    && wget -qO- https://ziglang.org/download/${ZIG_VERSION}/zig-linux-x86_64-${ZIG_VERSION}.tar.xz \
       | tar -xJ -C /opt \
    && mv /opt/zig-linux-x86_64-${ZIG_VERSION} /opt/zig
WORKDIR /app
COPY solution.zig .
RUN /opt/zig/zig build-exe -O ReleaseSafe -femit-bin=/app/solution solution.zig

FROM debian:bookworm-slim
COPY --from=build /app/solution /app/solution
CMD ["/app/solution"]
