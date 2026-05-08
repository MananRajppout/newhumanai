# Deploy to Railway — step by step

This is the click-by-click guide. The `railway.json` files in `backend/` already configure the build and start commands, so Railway will mostly auto-detect things.

## Before you start

You need:
- This code pushed to a GitHub repo (private is fine)
- A Railway account (sign up with GitHub at railway.app — gets you $5 free credit)
- Your `backend/.env` file filled in (already done)

---

## 1. Push code to GitHub

From the project root in your VS Code terminal:

```bash
git init
git add .
git status | grep .env
```

The `git status | grep .env` line is the safety check. It must print **nothing** or only `.env.example`. If it shows `backend/.env`, the gitignore failed — STOP and tell me before pushing.

```bash
git commit -m "newhuman.ai POC"
```

Create a new private repo at github.com/new (don't add a README), then:

```bash
git remote add origin https://github.com/YOUR-USERNAME/REPO-NAME.git
git branch -M main
git push -u origin main
```

---

## 2. Create the API service on Railway

1. Go to railway.app → **New Project**
2. Click **Deploy from GitHub repo**
3. (First time only) Click **Configure GitHub App** → grant Railway access to your repo. This is the OAuth grant — required, only happens once.
4. Pick your repo from the list. It deploys.

Now configure it:

1. Click the service tile → **Settings** tab
2. **Service name** (top): rename to `api`
3. Scroll to **Source** section → **Root Directory** → set to `backend` → **Update**
4. The other settings (build/start command) auto-fill from `backend/railway.json`. Don't touch them.

Add the env vars:

1. Click **Variables** tab
2. Click **Raw Editor** (top right)
3. Open `backend/.env` in VS Code, copy the entire contents, paste into the Raw Editor
4. Click **Update Variables**

Generate a public URL:

1. Click **Settings** tab → scroll to **Networking** → **Public Networking**
2. Click **Generate Domain**
3. Copy the URL it gives you (looks like `https://api-production-xxxx.up.railway.app`)

Wait for deploy to finish (~1 min). Open `https://YOUR-URL/health` in a browser. Should show `{"ok":true,"ts":...}`. If yes, the API is live.

---

## 3. Create the agent service (same repo, different config)

The agent uses the same code but a different start command. We do this by adding a **second service** that points at a different config file.

1. From your project page, click **+ New** → **GitHub Repo** → pick the same repo again
2. Click the new service tile → **Settings**
3. **Service name**: rename to `agent`
4. **Root Directory**: `backend`
5. **Config-as-code path**: set to `railway.agent.json` (this is the trick — both services use the same code, this tells the agent service to use a different config that runs the agent worker instead of the API server)
6. Click **Update**

Add env vars:

1. **Variables** tab → **Raw Editor**
2. Paste the same contents from your `.env`
3. **Add one extra line at the bottom**:
   ```
   BACKEND_URL=https://api-production-xxxx.up.railway.app
   ```
   (Use the URL from step 2. No trailing slash.)
4. **Update Variables**

The agent does **not** need a public domain — don't generate one. It only makes outbound connections to LiveKit.

Wait for deploy. Click **Deployments** tab → click the active deploy → check the logs. You're looking for:

```
registered worker
  version: "1.4.0"
```

If you see that, the agent is live.

---

## 4. Initialize the database (one time)

The agent and API are running but the Neon database doesn't have tables yet. Easiest fix — run it from your laptop one time:

```bash
cd backend
npm run init-db
```

You should see `✅ Database schema initialized`. Done forever.

(Alternative: in Railway click the `api` service → **Deployments** → latest deploy → ⋯ menu → **Restart**. No, actually just run it locally, it's faster.)

---

## 5. Update the mobile app config

Open `app/app.json`, replace `https://CHANGE-ME.example.com` with your Railway API URL.

Open `app/eas.json`, replace **both** instances of `CHANGE-ME-TO-YOUR-DEPLOYED-BACKEND.example.com` with the same URL.

Commit and push:

```bash
git add app/app.json app/eas.json
git commit -m "point app at deployed backend"
git push
```

---

## 6. Build the APK

```bash
npm install -g eas-cli
eas login
cd app
npm install
eas build:configure       # answers Yes to everything is fine
eas build -p android --profile preview
```

~12-15 minutes. You get an emailed link to a downloadable signed APK.

---

## Sanity-check: does the whole chain work?

After Railway deploys, before building the APK, you can test the API end-to-end with curl:

```bash
# Replace URL with yours
curl https://YOUR-API-URL.up.railway.app/health
# → {"ok":true,...}

curl -X POST https://YOUR-API-URL.up.railway.app/api/users \
  -H "Content-Type: application/json" \
  -d '{"device_id":"curl-test-1"}'
# → {"user":{"id":"...","device_id":"curl-test-1",...},"onboarded":false,...}
```

If both work, your backend is solid. Move to APK.

---

## What this costs

At demo scale (a handful of users, occasional sessions): roughly $0.50–$2/month on Railway, well inside the free $5 credit. Set a usage alert in Railway billing if you want a safety net.

---

## When something breaks

**API service crashes on boot** → check Railway logs for `api` service. Most likely an env var typo. Compare to your local `.env`.

**Agent service shows "registered worker" but never joins rooms** → the BACKEND_URL env var is wrong, missing, or has a trailing slash. Fix and redeploy.

**App says "Could not reach backend"** → app.json/eas.json still has the placeholder URL, OR you haven't rebuilt the APK since updating them.

**Voice never responds in session** → check `agent` service logs in Railway. Look for OpenAI or Deepgram errors. Most common cause: an API key got rotated and the new one isn't in Railway's variables.
