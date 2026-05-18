# ביחד — מערכת נגד בדידות

## פריסה ל-Vercel (מומלץ)

### שלב 1 — העלה ל-Vercel
1. פתח https://vercel.com והירשם עם Google
2. לחץ "Add New Project" → "Upload"
3. גרור את תיקיית הפרויקט (ללא node_modules)
4. לחץ Deploy

### שלב 2 — הגדר Environment Variables ב-Vercel
ב-Project Settings → Environment Variables הוסף:

```
VITE_FIREBASE_API_KEY=AIzaSyBDktFMpuQki9R50k-gHyc0W6jTqgMt4Bc
VITE_FIREBASE_AUTH_DOMAIN=bennah-960eb.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=bennah-960eb
VITE_FIREBASE_STORAGE_BUCKET=bennah-960eb.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=705995824315
VITE_FIREBASE_APP_ID=1:705995824315:web:cd4701b327ba6c15da1d9e
VITE_LIVEKIT_URL=wss://ben-604yds96.livekit.cloud
VITE_LIVEKIT_TOKEN_URL=/token
LIVEKIT_API_KEY=APIBSgfBgxqh7Z7
LIVEKIT_API_SECRET=iTlmVzg59mUt1bSjkBjKfWCnnNWeoU1RebzCcg7dPVOB
```

### שלב 3 — Redeploy
אחרי הוספת המשתנים לחץ Redeploy.

## פיתוח מקומי

```bash
# חלון 1 - token server
npm install livekit-server-sdk dotenv
node token-server.js

# חלון 2 - אפליקציה
npm install
npm run dev
```

צור קובץ `.env.local`:
```
VITE_FIREBASE_API_KEY=...
VITE_LIVEKIT_TOKEN_URL=http://localhost:8080/token
```

וקובץ `.env`:
```
LIVEKIT_API_KEY=...
LIVEKIT_API_SECRET=...
```
