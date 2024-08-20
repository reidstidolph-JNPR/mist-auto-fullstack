FROM node:18-alpine

WORKDIR /home/node/app

COPY package*.json ./
COPY build.js ./

RUN npm install

# Bundle app source
COPY . .

CMD ["node", "build.js"]