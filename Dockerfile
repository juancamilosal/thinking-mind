# Etapa 1: Build de Angular
FROM node:20-bullseye AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx ng build

# Etapa 2: Servir con NGINX
FROM nginx:stable

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist/thinkingmind-fe/browser /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
