# Sathi Backend

Production-ready social media backend built with Node.js, Express.js, and Amazon DynamoDB.

## Features
- JWT authentication
- bcrypt password hashing
- DynamoDB single-table design
- REST APIs for auth, users, posts, comments, friends, notifications, reels, chat, media, and admin
- Swagger/OpenAPI-ready structure
- Postman collection template

## Setup
1. Install dependencies
   ```bash
   npm install
   ```
2. Configure environment variables
   ```bash
   AWS_REGION=us-east-1
   AWS_ACCESS_KEY_ID=your-key
   AWS_SECRET_ACCESS_KEY=your-secret
   TABLE_NAME=Sathi
   JWT_SECRET=change-me
   PORT=3001
   ```
3. Start the service
   ```bash
   npm start
   ```

## API
- Health: GET /health
- Auth: /api/auth/*
- Users: /api/users/*
- Posts: /api/posts/*
- Comments: /api/comments/*
- Friends: /api/friends/*
- Notifications: /api/notifications/*
- Reels: /api/reels/*
- Chat: /api/chat/*
- Media: /api/media/*
- Admin: /api/admin/*
