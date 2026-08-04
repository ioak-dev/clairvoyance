FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY index.html vite.config.ts tsconfig.json ./
COPY src ./src
COPY assets ./assets

# Browser-reachable URLs (host ports), not Docker-internal hostnames.
ARG VITE_API_URL=http://localhost:4000
ARG VITE_POSTGREST_URL=http://localhost:4001
ARG VITE_POSTGREST_JWT=

ENV VITE_API_URL=$VITE_API_URL \
    VITE_POSTGREST_URL=$VITE_POSTGREST_URL \
    VITE_POSTGREST_JWT=$VITE_POSTGREST_JWT

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
