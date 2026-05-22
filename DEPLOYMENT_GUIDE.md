# 🚀 Complete Deployment Guide for 24/7 Production

## **Step 1: MongoDB Setup (Data Persistence)**

### Option A: MongoDB Atlas (Recommended - Free)
1. Visit: https://www.mongodb.com/cloud/atlas
2. Sign up with email
3. Create a free cluster (choose region closest to you)
4. Go to "Database Access" → Create username & password
5. Go to "Network Access" → Add IP `0.0.0.0/0` (allows all IPs)
6. Click "Databases" → "Connect" → Copy connection string
7. Replace `<password>` with your database password
8. Save connection string for later

### Option B: MongoDB Local (Development Only)
```bash
# Install MongoDB locally or use MongoDB Community
# Not recommended for 24/7 production
```

---

## **Step 2: GitHub Setup**

### Create Repository
```bash
cd c:\Users\ashut\OneDrive\Desktop\havana

# Initialize git (if not done)
git init
git add .
git commit -m "Initial commit: SocialConnect application"

# Create new repo on github.com
# Then:
git remote add origin https://github.com/YOUR_USERNAME/havana.git
git branch -M main
git push -u origin main
```

---

## **Step 3: Render Deployment**

### Deploy via GitHub Integration (AUTO-DEPLOY)
1. Go to https://render.com
2. Sign up with GitHub account
3. Click "New" → "Web Service"
4. Select your GitHub repository
5. **Configuration:**
   - Name: `socialconnect`
   - Environment: `Node`
   - Region: Choose closest to you
   - Build Command: `npm install`
   - Start Command: `npm start`

### Set Environment Variables
6. Click "Advanced" → "Add Environment Variable"
   - **Key:** `MONGODB_URI`
   - **Value:** Your MongoDB connection string from Step 1
   
7. Add other variables:
   - `JWT_SECRET`: (let Render generate)
   - `ADMIN_SECRET`: `Admin@2024`
   - `NODE_ENV`: `production`

8. Click "Create Web Service"

### Enable Auto-Deploy
- Render auto-deploys on every GitHub push!
- No manual deployment needed

---

## **Step 4: Development Workflow (Code → GitHub → Auto Deploy)**

### Every time you make changes:
```bash
# In VS Code terminal:
git add .
git commit -m "Your description of changes"
git push origin main

# Render automatically deploys within 2-3 minutes!
```

### Check deployment status:
- Go to https://dashboard.render.com
- Click your service name
- View logs in real-time

---

## **Step 5: 24/7 Uptime Options**

| Plan | Cost | Uptime | Ideal For |
|------|------|--------|-----------|
| **Free** | $0 | Spins down after 15 min inactivity | Development |
| **Starter** | $7/month | **99.9% Uptime** | Small production |
| **Pro** | $12/month | **99.95% Uptime** | Medium production |

**To upgrade:**
1. Go to dashboard.render.com
2. Click your service
3. Go to "Settings" → "Plan" → Upgrade

---

## **Step 6: Data Backup (Important!)**

### Automatic MongoDB Backups
- MongoDB Atlas provides automatic daily backups (free)
- Go to Clusters → Backups

### Manual Backup (Optional)
```bash
# Install MongoDB tools
# Export data:
mongoexport --uri "your-connection-string" --collection users --out users.json
```

---

## **Step 7: Monitoring & Uptime Checks**

### Add Uptime Monitor (Free)
1. Go to https://uptimerobot.com
2. Create account
3. Add monitor for your Render URL
4. Set interval to 5 minutes
5. Get email alerts if service goes down

### View Logs
1. dashboard.render.com → Your service
2. Click "Logs" tab
3. Real-time monitoring

---

## **Summary Checklist**

- [ ] MongoDB Atlas account created
- [ ] MongoDB connection string copied
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] Render account created
- [ ] Render connected to GitHub repository
- [ ] Environment variables set (MONGODB_URI)
- [ ] Service deployed and running
- [ ] Uptimerobot monitor created
- [ ] Test: Push code → Check auto-deploy
- [ ] Test: Create/update data → Verify persistence

---

## **Troubleshooting**

### Service won't start?
- Check Render logs: dashboard.render.com → Logs tab
- Verify MONGODB_URI is correct
- Ensure MongoDB network allows 0.0.0.0/0

### Data disappearing?
- You're using the JSON file instead of MongoDB
- Update server.js to use MongoDB
- Restart service

### Auto-deploy not working?
- Check GitHub webhook: Your repo → Settings → Webhooks
- Verify branch is `main`

---

## **Questions?**
- Render Docs: https://render.com/docs
- MongoDB Docs: https://docs.mongodb.com
- GitHub Docs: https://docs.github.com
