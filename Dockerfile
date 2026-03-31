# Build Stage
FROM node:20-slim AS build

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build the frontend (Vite)
RUN npm run build

# Production Stage
FROM node:20-slim

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy built assets from build stage
COPY --from=build /app/dist ./dist
# Copy backend source
COPY --from=build /app/backend ./backend
# Copy configuration files
COPY --from=build /app/firebase-applet-config.json ./
COPY --from=build /app/firebase-blueprint.json ./
COPY --from=build /app/firestore.rules ./

# Expose the port the bot runs on
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production

# Start the bot
CMD ["npm", "start"]
