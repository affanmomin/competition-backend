ARG PORT=3000
FROM node:20-slim

ENV PORT=3000
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY src ./src
COPY tsconfig.json ./

# Install dev dependencies and build
RUN npm install && npm run build

EXPOSE ${PORT}
CMD [ "node", "dist/index.js" ]

