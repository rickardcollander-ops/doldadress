# Vercel Environment Variables Setup

## Kritiska Miljövariabler

Lägg till följande i Vercel Dashboard → Settings → Environment Variables:

### 1. Database
```
DATABASE_URL=postgresql://neondb_owner:npg_GuEe9BOY3Srv@ep-rapid-bird-akvjmjl9-pooler.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
DATABASE_URL_UNPOOLED=postgresql://neondb_owner:npg_GuEe9BOY3Srv@ep-rapid-bird-akvjmjl9.c-3.us-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 2. Security - Encryption Key ⚠️ KRITISK
```
ENCRYPTION_KEY=a74fa64ce3d2d95be9979282fa540690ddd4c3388cddf8c93f64390f18fda2bc
```

**VIKTIGT:** Denna nyckel krypterar alla API-nycklar och integration credentials i databasen. Utan denna kommer appen inte fungera.

### 3. NextAuth
```
NEXTAUTH_URL=https://doldadress.vercel.app
NEXTAUTH_SECRET=[generera med: openssl rand -base64 32]
AUTH_SECRET=[samma som NEXTAUTH_SECRET]
```

### 4. OpenAI
```
OPENAI_API_KEY=sk-...
```

### 5. Google OAuth
```
GOOGLE_CLIENT_ID=461289086029-7vbhlhcm56he55u1mm9gikalepfdlugt.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=[från Google Cloud Console]
```

## Deployment Checklist

- [x] Kryptering implementerad för credentials
- [x] Befintliga credentials krypterade i databasen
- [x] ENCRYPTION_KEY tillagd i .env.local
- [ ] **ENCRYPTION_KEY tillagd i Vercel Environment Variables**
- [ ] Alla andra miljövariabler verifierade i Vercel
- [ ] Deploy och testa att integrations fungerar

## Säkerhetsnoteringar

1. **ENCRYPTION_KEY** är 64 hex-tecken (32 bytes) för AES-256-GCM kryptering
2. Credentials krypteras automatiskt vid sparande i Settings
3. Credentials dekrypteras automatiskt vid läsning
4. Gamla okrypterade credentials stöds fortfarande (fallback)
5. Migrations-script har kört och krypterat alla befintliga credentials

## Om du behöver rotera ENCRYPTION_KEY

1. Generera ny nyckel: `openssl rand -hex 32`
2. Dekryptera alla credentials med gamla nyckeln
3. Uppdatera ENCRYPTION_KEY
4. Kryptera om alla credentials med nya nyckeln
5. Använd `scripts/encrypt-existing-credentials.cjs` för bulk-uppdatering
