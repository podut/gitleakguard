FROM node:18-alpine

RUN apk add --no-cache git

RUN npm install -g gitleakguard

WORKDIR /repo

ENTRYPOINT ["gitleakguard"]
CMD ["scan"]
