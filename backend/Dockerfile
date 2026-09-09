FROM node:20

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma/
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src/
RUN npm run build

ENV NODE_ENV=production

EXPOSE 3000

CMD ["node", "dist/server.js"]
