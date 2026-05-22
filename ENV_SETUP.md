# Environment Variables Setup

## Create a `.env` file (for local development only)
# DO NOT commit this file to GitHub!

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/socialconnect
JWT_SECRET=your-super-secret-jwt-key-here
ADMIN_SECRET=Admin@2024
NODE_ENV=development
PORT=3000
```

## On Render Dashboard:
Go to your service → Settings → Environment Variables

Add these exactly as they appear:

| Key | Value | Notes |
|-----|-------|-------|
| `MONGODB_URI` | Your MongoDB connection string | Copy from MongoDB Atlas |
| `JWT_SECRET` | (Leave blank - Render generates) | Security token |
| `ADMIN_SECRET` | `Admin@2024` | Admin password |
| `NODE_ENV` | `production` | Production environment |
| `PORT` | `3000` | Server port |

## Important:
- `.env` file is in `.gitignore` - it won't upload to GitHub ✅
- Render stores variables securely in dashboard ✅
- Never share your MongoDB URI with anyone! ✅
