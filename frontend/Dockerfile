# Use an official Node.js runtime as the base image
FROM node:alpine

# Set the working directory in the container
WORKDIR /app

# Copy package.json and package-lock.json to the container
COPY package*.json ./

# Install application dependencies
RUN npm install --force

# Copy the rest of the application code to the container
COPY . .

ADD  src/  ./src

# Expose the port that the React app will run on
EXPOSE 3000

RUN npm run build

# Command to start the React app
CMD ["npm", "run", "dev"]