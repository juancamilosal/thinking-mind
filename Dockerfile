# Etapa 1: Build de Angular
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# Instalar dependencias incluyendo dev (necesario para Angular CLI)
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Compilar la aplicación Angular usando npx para evitar problemas con ng global
RUN npx ng build

# Etapa 2: Servir con NGINX
FROM nginx:alpine

# Eliminar la configuración por defecto de NGINX si es necesario
RUN rm -rf /usr/share/nginx/html/*

# Copiar los archivos compilados desde el builder
COPY --from=builder /app/dist/n/browser /usr/share/nginx/html

# Copiar configuración personalizada de NGINX si la tienes
# COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
