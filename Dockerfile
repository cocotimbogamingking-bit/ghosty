FROM node:bookworm-slim
ENV NODE_ENV=production

WORKDIR /app

COPY ["package.json", "./"]
COPY ["scripts/patch-scramjet.mjs", "./scripts/patch-scramjet.mjs"]

RUN npm install

COPY . .

CMD [ "node", "index.js" ]
