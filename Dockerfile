FROM golang:1.21-alpine AS builder

WORKDIR /app

# Install dependencies required for the build
RUN apk add --no-cache git

# Copy go mod and sum files
COPY go.mod go.sum ./

# Download all dependencies
RUN go mod download

# Copy the source code
COPY . .

# Build the Go app
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/api

# Start a new stage from scratch
FROM alpine:3.18  

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /root/

# Copy the Pre-built binary file from the previous stage
COPY --from=builder /app/main .
# Copy .env file if available, otherwise pass environment variables
# COPY --from=builder /app/.env .

EXPOSE 8080

CMD ["./main"]
