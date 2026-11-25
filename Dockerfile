# Imagen de la API de Studate, en dos etapas (como en el Seminario 10):
#
#   1. build    instala todo (también las dependencias de desarrollo, que hacen falta para compilar)
#               y compila el TypeScript a build/
#   2. runtime  parte de una imagen limpia, instala solo las dependencias de producción y copia lo
#               compilado. Es la imagen que se publica y se ejecuta: sin TypeScript, sin tsx y sin el
#               código fuente
#
# El seed se compila con el resto (build/seed.js), así que se puede ejecutar dentro del contenedor
# con `node build/seed.js`, sin tsx. En el Seminario 10 el seed se quedaba fuera de la imagen.
#
# La imagen no lleva ningún secreto ni .env: la configuración llega en variables de entorno al
# arrancar el contenedor (ver .env.example).

FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/build ./build
EXPOSE 1337
# El proceso corre con el usuario node, no con root: si alguien consiguiera ejecutar algo en el
# contenedor, no tendría permisos de administrador
USER node
CMD ["node", "build/server.js"]
