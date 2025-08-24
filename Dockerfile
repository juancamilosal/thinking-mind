# Etapa 1: Build de Angular
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# Instalar dependencias incluyendo dev (necesario para Angular CLI)
RUN npm ci

# Copiar el resto del código fuente
COPY . .

# Compilar la aplicación Angular para producción sin SSR
RUN npx ng build --configuration=production

# Etapa 2: Servir con NGINX
FROM nginx:alpine

# Eliminar la configuración por defecto de NGINX
RUN rm -rf /usr/share/nginx/html/*

# Copiar los archivos compilados desde el builder
COPY --from=builder /app/dist/thinkingmind-fe/browser /usr/share/nginx/html

# Copiar configuración personalizada de NGINX
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
