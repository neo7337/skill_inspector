FROM node:22-alpine

WORKDIR /app

# Install dependencies first (layer-cached)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source
COPY . .

EXPOSE 5173

# Start Vite dev server bound to 0.0.0.0 so it's reachable from outside the container
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
