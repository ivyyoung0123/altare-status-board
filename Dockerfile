# Fallback for Altare Docker Apps: bypasses npm install entirely.
# Build: docker build -t status-ivy:latest .
# Altare Docker App: image status-ivy, port $PORT (3000), start: node server.js
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY server.js ./
EXPOSE 3000
CMD ["node", "server.js"]
