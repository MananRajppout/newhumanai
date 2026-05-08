# newhuman.ai — POC

A working proof-of-concept of the newhuman.ai behavioral pattern-interrupt app, built to demo to a client. Two pieces:

- **`backend/`** — Node.js server that mints LiveKit tokens + a LiveKit agent worker that runs the realtime voice AI (Deepgram STT → OpenAI → Deepgram TTS).
- **`app/`** — React Native (Expo) Android app with the dark/violet UI, onboarding, trigger menu, and realtime voice session screen.

**Verification status:** LiveKit credentials, token minting, and agent worker registration with LiveKit Cloud were tested and confirmed working at build time. Postgres connection cannot be tested from the build sandbox (port 5432 is blocked) but will work from your machine and from any deployed backend.

**What is in this POC:**
- Onboarding (6 questions from the spec)
- Personalized trigger menu (uses the user's own onboarding triggers)
- Trigger-specific AI quick question
- Realtime voice session — user can speak, AI responds, both ways
- AI is fully personalized: knows the user's inner-voice phrase, best-self description, grounding preference, and the specific trigger + moment context
- "You have chosen yourself X times this month" counter

**What is NOT in this POC (intentionally):**
- Physical Bluetooth (Flic) button — would be a one-line `flic` SDK pairing
- Voice cloning — neutral Deepgram voice instead
- SMS / chatbot follow-up layer
- Check-ins / homeworks

---

## Step 0 — verify

The `.env` is already filled in with all keys. Before you do anything else, run the smoke test:

```bash
cd backend
npm install
npm run smoketest
```

You should see `✅ All checks passed`. If not, the LiveKit credentials are wrong and nothing else will work.

---

## Step 1 — run the backend locally

```bash
cd backend
npm run init-db        # creates tables in Neon
npm start              # token server on :3000
```

In a second terminal, run the agent worker (this is what joins the LiveKit room and runs the AI):

```bash
cd backend
npm run agent:dev
```

---

## Step 2 — run the app on your phone (development)

```bash
cd app
npm install
```

**Important — backend URL.** The app needs to know where your backend is. When you're testing locally, use one of these:

- Android emulator on your machine: leave it as the default `http://10.0.2.2:3000`
- Physical Android phone on the same Wi-Fi: edit `app/app.json` → `extra.BACKEND_URL` to `http://YOUR-LAN-IP:3000` (find with `ip a` on Linux). The phone has to be able to reach your laptop.
- Production build: see Step 4 — the URL gets baked in via EAS env.

Then:

```bash
npx expo start
```

Scan the QR code with the **Expo Go** app on Android. **One catch** — `@livekit/react-native` is a native module, so Expo Go will not work for the actual session screen. Onboarding and the trigger menu will work in Expo Go, but the live voice session needs a development build:

```bash
npx expo install expo-dev-client
eas build --profile development --platform android
```

Or just skip dev build and go straight to the preview APK in step 4.

---

## Step 3 — deploy the backend so the app can reach it from anywhere

For a real demo to a client, the backend needs a public URL. Easiest options:

- **Railway** — `railway up` from the `backend/` folder. ~3 min. Set the env vars from `.env` in their dashboard.
- **Render** — connect the repo, point at `backend/`, add the env vars.
- **Fly.io** — `fly launch` then `fly deploy`.

Two things to deploy: the API server (`npm start`) and the agent worker (`npm run agent dev` in production mode → `npm run agent start` after `livekit-cli` setup, or just run a second process). Both read the same `.env`.

After deploy, copy the public URL (e.g. `https://newhuman-backend.up.railway.app`) — you need it in step 4.

---

## Step 4 — build the APK with EAS (no Android Studio needed)

```bash
cd app
npm install -g eas-cli
eas login                       # create free Expo account if you don't have one
eas build:configure
```

Edit two files with your deployed backend URL:

- `app/app.json` → `extra.BACKEND_URL`
- `app/eas.json` → `build.preview.env.EXPO_PUBLIC_BACKEND_URL`

Then:

```bash
eas build -p android --profile preview
```

EAS builds in the cloud. Takes ~15 min the first time. You get an email with a link to download the signed APK. Send that to your client.

Free tier gives you ~30 builds/month, more than enough.

---

## Step 5 — demo flow

1. Install APK on Android phone (`Settings → Install unknown apps` for the browser/file manager you use).
2. Open the app → onboarding plays automatically (~2 min).
3. Pick triggers, answer the inner-voice / best-self questions honestly — these get fed to the AI.
4. Land on the home screen. Tap any trigger.
5. Type one sentence in the context screen, hit Begin.
6. Mic permission prompt → allow.
7. Within ~3 seconds you should hear the AI speak, addressing your specific moment in second person. You can speak back — it will pause and respond.

If the agent does not respond:
- Check the agent worker logs in your second terminal — it should log `joining room nh-xxxxxxxx`.
- Make sure the agent worker is actually running with the LiveKit credentials.

---

## File map

```
backend/
  package.json
  .env                          # all secrets — DO NOT commit
  src/
    server.js                   # express API: /api/users, /api/onboarding, /api/session/start, etc
    agent.js                    # LiveKit voice agent worker
    init-db.js                  # creates Postgres tables in Neon

app/
  package.json
  app.json                      # expo config — update extra.BACKEND_URL
  eas.json                      # EAS build profiles — update env.EXPO_PUBLIC_BACKEND_URL
  babel.config.js
  app/                          # expo-router pages
    _layout.js                  # nav stack + LiveKit globals
    index.js                    # bootstrap → onboarding or home
    onboarding.js               # 6-question flow
    home.js                     # trigger menu (the screenshot)
    context.js                  # AI quick question
    session.js                  # realtime voice session (LiveKit)
    profile.js                  # debug / reset
  src/
    theme.js                    # design tokens
    api.js                      # backend client
    components/
      TriggerNode.js            # the glowing circle
      icons.js                  # SVG icons per trigger
```

---

## Cost reality check (POC scale)

- LiveKit Cloud: free tier covers thousands of participant-minutes
- Deepgram: $200 free credit on signup, more than enough for a demo
- OpenAI gpt-4o-mini: ~$0.15 per million input tokens, a 5-min session is well under a cent
- Neon Postgres: free tier
- EAS Build: free tier covers your monthly builds

Total cost to run the demo: ~$0.

---

## Security note

The keys you sent live in `backend/.env` and were also visible in our chat. **Rotate all of them after the demo** — you said you would, this is your reminder. Specifically:

- LiveKit API key + secret → regenerate in LiveKit dashboard
- Deepgram → regenerate at console.deepgram.com
- OpenAI → regenerate at platform.openai.com/api-keys
- Neon password → regenerate in Neon console

For production, none of this should be in `.env` files in a repo — use the host's secrets manager (Railway/Render/Fly all have one).
