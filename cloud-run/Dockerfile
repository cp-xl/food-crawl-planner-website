FROM node:22-alpine

WORKDIR /app

# Copy manifests first — Docker caches this layer separately from source.
# A code-only change won't re-run npm install.
COPY package*.json ./
RUN npm ci --omit=dev

COPY src/ ./src/

ENV NODE_ENV=production
EXPOSE 8080

CMD ["node", "src/index.js"]
