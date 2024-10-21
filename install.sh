#!/bin/bash

# Exit on error
set -e

# Update package list
echo "Updating package list..."
sudo apt-get update

# Install Node.js and npm
echo "Installing Node.js and npm..."
sudo apt-get install -y nodejs npm

# Install SQLite
echo "Installing SQLite..."
sudo apt-get install -y sqlite3

# Navigate to your app's directory
APP_DIR="/root/myapp"  # Change to your desired application directory
mkdir -p "$APP_DIR"           # Create the app directory if it doesn't exist
cd "$APP_DIR"

# Download your script
echo "Downloading app.js..."
curl -O https://raw.githubusercontent.com/wayangkulit95/utube/main/app.js

# Install project dependencies
echo "Installing project dependencies..."
npm install node-fetch sqlite3

echo "Installation completed successfully!"
echo "You can start the server by running: node app.js"
