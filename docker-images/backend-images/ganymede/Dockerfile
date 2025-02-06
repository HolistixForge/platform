FROM node:lts-alpine3.17

WORKDIR /usr/app
RUN mkdir -p /usr/app/app

COPY ./package.json /usr/app
COPY ./package-lock.json /usr/app

COPY ./main.js /usr/app
COPY ./main.js.map /usr/app
COPY ./app /usr/app/app

RUN npm ci --omit=dev

EXPOSE 443

CMD node ./main.js