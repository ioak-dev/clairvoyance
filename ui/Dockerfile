FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY assets ./assets

# Browser-reachable URLs (host ports / public hostnames), not Docker-internal names.
ARG VITE_API_URL=http://plan-api.ioak.io
ARG VITE_POSTGREST_URL=http://plan-pg.ioak.io
ARG VITE_POSTGREST_JWT=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_POSTGREST_URL=$VITE_POSTGREST_URL \
    VITE_POSTGREST_JWT=$VITE_POSTGREST_JWT

RUN npm run build

# Alpine + nginx (avoids official nginx image EXPOSE 80 metadata).
FROM alpine:3.21 AS runtime

RUN apk add --no-cache nginx \
    && mkdir -p /run/nginx /usr/share/nginx/html

COPY nginx.conf /etc/nginx/http.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
