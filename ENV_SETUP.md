# Environment Variables Setup

## Create a `.env` file (for local development only)
# DO NOT commit this file to GitHub!

```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/socialconnect
JWT_SECRET=your-super-secret-jwt-key-here
ADMIN_SECRET=Admin@2024
NODE_ENV=development
GOOGLE_CLIENT_ID=your-google-oauth-web-client-id.apps.googleusercontent.com
SUPABASE_URL=https://ppetpuukiffexqoxghnl.supabase.co
SUPABASE_ANON_KEY=sb_publishable_zcSzV9eZI9M7R5OpPg7T8A_xs1aNgxA
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
| `GOOGLE_CLIENT_ID` | Your Google OAuth Web Client ID | Enables "Sign in with Gmail" |

**Important:** Do NOT set `PORT` manually — Render assigns it dynamically via `process.env.PORT`.

## Google Sign-In Setup (Sign in with Gmail)

To enable the "Sign in with Gmail" button, create a **Google OAuth Web Client ID**:

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or use an existing one)
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** user type
   - Fill in the required app info (app name, support email)
   - Add scope: `.../auth/userinfo.email` and `.../auth/userinfo.profile`
   - Add yourself as a test user (until app is verified)
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth Client ID**
   - Application type: **Web application**
   - **Authorized JavaScript origins** (REQUIRED — this app uses the popup flow):
     - `http://localhost:3000` (local dev)
     - `https://your-render-app.onrender.com` (production)
   - **Authorized redirect URIs** (OPTIONAL — NOT used by this app):
     - This app uses the **Google Identity Services popup flow**, where the credential is returned to the browser as a JWT and then sent to our server's `POST /api/auth/google` endpoint for verification.
     - The **authorized redirect URI field can be left empty**. It's only needed for the older server-side "authorization code" flow (e.g., `https://your-app.com/auth/google/callback`), which this app does **not** use.
   - Click **Create**
5. Copy the **Client ID** (ends in `.apps.googleusercontent.com`)
6. Add it to your `.env` as `GOOGLE_CLIENT_ID=...` (local) and to Render's env vars (production)
7. Restart the server. The "Sign in with Gmail" button will now appear on the Login and Sign Up pages.

### How it works
- Clicking the button opens Google's consent flow
- Google returns a **JWT credential** which is sent to `POST /api/auth/google`
- The server verifies it against Google's `tokeninfo` endpoint
- If the email/Google ID is already registered → logs in
- Otherwise → automatically creates a new account (with profile picture from Google)

> **Note:** Google-only accounts have no password. If they try the normal email/password login, they'll be prompted to use the Google button instead.

## Supabase Setup (Live Database)

Your app now uses **Supabase** as the live database. All data (users, posts, chats, reels, notifications, etc.) is stored in Supabase and synced automatically.

### Step 1 — Set up the tables
1. Open your Supabase Dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql`.
3. Click **Run**.

Or run the helper:
```bash
npm run setup:supabase
```

### Step 2 — Configure env vars
Add these to your `.env` (local) and to Render's Environment Variables (production):

| Key | Value | Notes |
|-----|-------|-------|
| `SUPABASE_URL` | `https://ppetpuukiffexqoxghnl.supabase.co` | Your project URL |
| `SUPABASE_ANON_KEY` | `sb_publishable_...` | Publishable key (or service role key) |

### How it works
- On server start, the app **loads** all data from Supabase into memory.
- Every time data changes (`saveDb()`), the app **pushes** the latest state back to Supabase.
- Real-time features (Socket.IO) still work — the server broadcasts changes live to connected clients.
- Existing `data.json` is kept as a fallback if Supabase is not configured.

### Verify
Start the server and check:
```
GET /api/control/status
```
The response includes a `supabase` object showing `enabled`, `loads`, `saves`, and `lastSync`.

## Important:
- `.env` file is in `.gitignore` - it won't upload to GitHub ✅
- Render stores variables securely in dashboard ✅
- Never share your MongoDB URI or Google Client Secret with anyone! ✅
