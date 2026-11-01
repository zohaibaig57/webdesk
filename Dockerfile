
FROM mcr.microsoft.com/playwright:v1.56.1-noble

WORKDIR /app

COPY package.json ./

RUN npm install

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV MAX_SESSIONS=1

EXPOSE 3000

CMD ["npm", "start"]
