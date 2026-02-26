# Zeabur-friendly Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
# Force development environment so npm install always installs devDependencies (like vite)
ENV NODE_ENV=development
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-alpine AS run
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/server.js ./server.js
EXPOSE 8080
CMD ["node","server.js"]
