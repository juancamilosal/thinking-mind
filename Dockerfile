# Etapa 1: Build de Angular
FROM node:20.19.5-bookworm-slim AS builder

WORKDIR /app

# Verificar versiones
RUN node -v
RUN npm -v

# Copiar archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# Instalar dependencias
RUN npm ci --verbose

# Copiar el resto del código
COPY . .

# Compilar Angular
RUN npx ng build --verbose

# Etapa 2: Servir con NGINX
FROM nginx:alpine

RUN rm -rf /usr/share/nginx/html/*

COPY --from=builder /app/dist/thinkingmind-fe/browser /usr/share/nginx/html

COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
