# =============================
# Etapa 1: Build de Angular
# =============================
FROM node:20-alpine AS builder

WORKDIR /app

# Dependencias necesarias para compilar paquetes nativos (lightningcss, etc.)
RUN apk add --no-cache python3 make g++ libc6-compat

# Copiar archivos necesarios para instalar dependencias
COPY package.json package-lock.json ./

# Instalar dependencias incluyendo dev (Angular CLI y demás)
RUN npm ci

# Recompilar lightningcss desde fuente (porque no hay binarios precompilados para musl)
RUN npm rebuild lightningcss --build-from-source

# Copiar el resto del código fuente
COPY . .

# Compilar la aplicación Angular
RUN npx ng build

# =============================
# Etapa 2: Servir con NGINX
# =============================
FROM nginx:alpine

# Eliminar la configuración por defecto de NGINX
RUN rm -rf /usr/share/nginx/html/*

# Copiar los archivos compilados desde el builder
COPY --from=builder /app/dist/thinkingmind-fe/browser /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
