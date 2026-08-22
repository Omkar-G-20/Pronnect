FROM node:20-alpine
WORKDIR /app
COPY . .
ENV PORT=5000
EXPOSE 5000
CMD ["node", "standalone-server.js"]
