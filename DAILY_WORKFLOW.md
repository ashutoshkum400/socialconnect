# 🎯 Daily Workflow: Code → GitHub → Render (Auto-Deploy)

## **Your Daily Routine (Super Simple!)**

### Make changes in VS Code:
```
Edit files in VS Code as usual
```

### Upload to GitHub (3 commands):
```bash
# Step 1: Add all changes
git add .

# Step 2: Save with message
git commit -m "Fixed bug in chat feature"

# Step 3: Push to GitHub
git push origin main
```

### Done! ✅ Render automatically deploys!

**Wait 2-3 minutes** → Your app is live with new code

---

## **Verification Checklist**

### 1️⃣ Check GitHub
- Go to https://github.com/YOUR_USERNAME/havana
- Verify new code is uploaded

### 2️⃣ Check Render Deployment
- Go to https://dashboard.render.com
- Click "socialconnect" service
- Go to "Logs" tab
- Look for: **"Build succeeded"** and **"Service is live"**

### 3️⃣ Test Your App
- Go to https://socialconnect-xxxx.onrender.com
- Test features to ensure they work

---

## **Data is Persistent Because:**

✅ **MongoDB in the cloud stores data** (not on Render server)
✅ **Even if Render restarts, data remains in MongoDB**
✅ **Users can access 24/7 without losing data**
✅ **Multiple users can access simultaneously**

---

## **Troubleshooting**

### ❌ Code isn't updating?
```bash
# Check git status
git status

# Make sure you pushed
git log --oneline -5
```

### ❌ Render shows "Deploy failed"?
- Go to Render dashboard → Logs
- Read error message
- Usually: Missing MONGODB_URI variable

### ❌ Users losing data?
- Data is still in MongoDB!
- Check MongoDB connection in Render env vars
- Verify MONGODB_URI is correct

---

## **Quick Commands Reference**

```bash
# Before pushing, check status
git status

# See your commits
git log --oneline -5

# Push code to GitHub
git push origin main

# Pull latest from GitHub
git pull origin main

# Emergency: Check if everything is committed
git status  # Should show "nothing to commit"
```

---

## **Emergency: Rollback to Previous Version**

If something breaks after deploying:

```bash
# See previous commits
git log --oneline

# Go back to previous version
git revert HEAD
git push origin main

# Render auto-deploys the old version
```

---

## **Success Indicators**

✅ Users can access your app 24/7
✅ User data persists (doesn't disappear)
✅ You can code and push anytime
✅ Changes appear in 2-3 minutes
✅ No errors in Render logs
✅ MongoDB shows your data in Atlas dashboard

You're ready! 🚀
