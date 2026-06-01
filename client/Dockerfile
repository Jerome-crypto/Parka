FROM node:20-alpine as builder

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install --ignore-scripts

COPY . .
RUN npm run build

# Stage 2: Serve static files using a light HTTP server
FROM alpine:3.19
RUN apk add --no-cache busybox-extras
WORKDIR /app
COPY --from=builder /usr/src/app/dist .

EXPOSE 5173
CMD ["httpd", "-f", "-v", "-p", "5173"]
