# CCAPDEV-ForumFriends Web Application

## Overview

Forum Friends is a full-stack forum web application designed as a Major Course Output (MCO) for CCAPDEV. The application allows users to post, comment, vote on posts, and interact with others. This project is developed under the supervision of Sir Louis Patrice Lu. Please note that the project is only for educational purposes only.

### Features:
- User Registration & Login
- Create, Edit, and Delete Posts
- Comment on Posts
- Upvote/Downvote Posts and Comments
- Tags and Categories for Posts
- User Profile Pages with the ability to edit profiles
- Dark Mode and Light Mode support

## Setup and Installation

### Prerequisites
- **Node.js**: Version 20.x or above
- **MongoDB**: MongoDB Atlas for remote database or a local MongoDB setup

### Installation

1. **Clone the repository:**
Clone the GitHub repository using the command:

git clone https://github.com/Alec718/CCAPDEV-ForumFriends.git
cd CCAPDEV-ForumFriends

2. **Install dependencies:**
Here are the following dependencies needed for this application:
- bcrypt
- connect-mongo
- cookie-parser
- dotenv
- express
- express-handlebars
- express-session
- method-override
- moment
- mongoose

Install the following dependencies using the npm install command:
npm install bcrypt connect-mongo cookie-parser dotenv express express-handlebars express-session method-override moment mongoose

3. **Create a .env File:**
Create a .env file in the root foldder and set up the MongoDB connection string and environment:

If you're using MongoDB Atlas (remote cloud database), use your own connection string as MONGODB_URI:

MONGODB_URI="your_mongodb_atlas_connection_string"
NODE_ENV=development

If you're using local MongoDB (local database), use the default connection string:

MONGODB_URI="mongodb://localhost:27017/forumdb"
NODE_ENV=development

4. **Run the Application**
To start the app, run this command on the root directory:

node app.js

This command will launch the application and you can access the application in your browser at http://localhost:9090
