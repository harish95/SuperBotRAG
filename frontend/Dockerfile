FROM node:20-alpine AS build

WORKDIR /app

COPY package.json .
RUN npm install

COPY . .

# Pass the production API URL at build time:
#   docker build --build-arg VITE_API_URL=https://api.example.com -t rag-frontend .
ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
