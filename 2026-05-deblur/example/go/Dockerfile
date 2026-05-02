FROM golang:1.23-bookworm AS build
COPY solution.go /src/
WORKDIR /src
RUN CGO_ENABLED=0 go build -o /app/solution solution.go

FROM scratch
COPY --from=build /app/solution /app/solution
CMD ["/app/solution"]
