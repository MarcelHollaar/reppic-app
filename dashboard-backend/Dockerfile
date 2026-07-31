FROM node:20

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm install

COPY . .

# API-only image: Reppic serves /dashboards/*; skip Vite client build.
RUN npm run build:api

EXPOSE 5001

CMD ["sh", "-c", "npm run db:ensure && npm run start"]
