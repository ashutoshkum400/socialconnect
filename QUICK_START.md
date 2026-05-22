# ⚡ QUICK START: 5 Steps to 24/7 Production

## **STEP 1: Setup MongoDB (5 minutes)**
```
1. Go to: https://www.mongodb.com/cloud/atlas
2. Sign up with email
3. Create FREE cluster
4. Create user (username & password)
5. Network Access: Add 0.0.0.0/0
6. Copy connection string
   mongodb+srv://username:password@cluster.mongodb.net/socialconnect
```

## **STEP 2: Setup GitHub (3 minutes)**
```bash
# In VS Code Terminal:
cd c:\Users\ashut\OneDrive\Desktop\havana

# Initialize git
git init
git add .
git commit -m "Initial commit"

# Create repo on github.com, then:
git remote add origin https://github.com/YOU/havana.git
git branch -M main
git push -u origin main
```

## **STEP 3: Deploy to Render (5 minutes)**
```
1. Go to: https://render.com
2. Sign up with GitHub
3. Click "New" → "Web Service"
4. Select your GitHub repo
5. Fill form:
   - Name: socialconnect
   - Build Command: npm install
   - Start Command: npm start
6. Click "Advanced"
7. Add Env Variables:
   MONGODB_URI = [Your MongoDB connection string]
8. Click "Create Web Service"
```

## **STEP 4: Enable Auto-Deploy (Done!)**
- Render automatically deploys when you push to GitHub
- No extra setup needed! ✅

## **STEP 5: Test Everything**
```bash
# Make a small change to test
# In VS Code, edit any file, then:
git add .
git commit -m "Test deployment"
git push origin main

# Wait 2-3 minutes
# Check: https://dashboard.render.com → Logs
# You'll see: "Build succeeded" ✅
```

---

## **From Now On: Your Daily Workflow**

**Every time you make changes:**
```bash
git add .
git commit -m "Your description"
git push origin main
# 2-3 minutes later: Your changes are LIVE! 🚀
```

---

## **Important Notes**

✅ **Data persists** - MongoDB stores all user data in cloud
✅ **24/7 availability** - Free plan has limits, upgrade for guaranteed uptime
✅ **Auto-deployment** - Push code → Render deploys automatically
✅ **No downtime** - Users keep working while you deploy new code
✅ **GitHub = Backup** - All your code is safe on GitHub

---

## **Upgrade for Better Uptime (Optional)**

| Plan | Cost | Uptime | Good For |
|------|------|--------|----------|
| Free | $0 | Spins down if idle | Dev/Testing |
| **Starter** | **$7/mo** | **99.9% Uptime** | **Small Apps** |
| Pro | $12/mo | 99.95% Uptime | Growing Apps |

To upgrade: Render dashboard → Your app → Settings → Plan

---

## **Common Issues**

| Problem | Solution |
|---------|----------|
| Build fails | Check Render logs, verify MONGODB_URI |
| Data lost | Data is in MongoDB, not on Render |
| Changes not showing | Did you `git push`? Check Render logs |
| Can't access app | Wait 3-5 minutes for deployment to finish |

---

**You're all set! Start coding and pushing to GitHub! 🎉**
