# Säkerhet & GDPR-efterlevnad

## Översikt

Denna guide beskriver säkerhetsåtgärder och GDPR-krav för att använda Doldadress ticket-systemet i produktion med riktiga kunder.

---

## 🔐 Säkerhetskrav

### 1. Autentisering & Auktorisering

**Implementera:**
- [ ] **Inloggning för agenter** - Använd NextAuth.js eller liknande
- [ ] **Rollbaserad åtkomst** - Agent, Manager, Admin
- [ ] **Session-hantering** - Automatisk utloggning efter inaktivitet
- [ ] **2FA** - Tvåfaktorsautentisering för känsliga operationer

```typescript
// Exempel: NextAuth.js konfiguration
import NextAuth from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

export default NextAuth({
  providers: [
    CredentialsProvider({
      // Din autentiseringslogik
    }),
  ],
  session: {
    maxAge: 8 * 60 * 60, // 8 timmar
  },
});
```

### 2. API-säkerhet

**Implementera:**
- [ ] **Rate limiting** - Begränsa antal requests per användare
- [ ] **API-nycklar** - För externa integrationer
- [ ] **CORS** - Begränsa tillåtna domäner
- [ ] **Input-validering** - Sanera all indata

```typescript
// Exempel: Rate limiting middleware
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuter
  max: 100, // Max 100 requests per fönster
});
```

### 3. Datakryptering

**Implementera:**
- [ ] **HTTPS** - Alltid i produktion
- [ ] **Kryptering i vila** - Kryptera känslig data i databasen
- [ ] **Kryptering av credentials** - Integration-nycklar ska krypteras

```typescript
// Exempel: Kryptera integration credentials
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!;
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
```

---

## 📋 GDPR-efterlevnad

### 1. Rättslig grund för behandling

Du behöver en **rättslig grund** för att behandla personuppgifter:

| Grund | Användning |
|-------|------------|
| **Avtal** | Kundsupport är nödvändig för att fullgöra avtal |
| **Berättigat intresse** | Förbättra kundservice, förhindra bedrägerier |
| **Samtycke** | Om du använder AI för automatiserade beslut |

### 2. Personuppgiftsbiträdesavtal (DPA)

Du behöver **DPA** med alla tredjeparter som behandlar personuppgifter:

- [ ] **OpenAI** - [OpenAI DPA](https://openai.com/policies/data-processing-addendum)
- [ ] **Stripe** - [Stripe DPA](https://stripe.com/legal/dpa)
- [ ] **Google (Gmail)** - [Google Cloud DPA](https://cloud.google.com/terms/data-processing-addendum)
- [ ] **Resend** - Kontakta för DPA
- [ ] **Databas-leverantör** - Neon, Supabase, etc.

### 3. Informationsplikt

Informera kunder om hur deras data behandlas:

**Integritetspolicy ska innehålla:**
- Vilka personuppgifter som samlas in
- Varför de samlas in (ändamål)
- Hur länge de sparas
- Vilka tredjeparter som får tillgång
- Kundens rättigheter

### 4. Kundens rättigheter

Implementera stöd för:

- [ ] **Rätt till tillgång** - Kunden kan begära ut sin data
- [ ] **Rätt till rättelse** - Korrigera felaktig data
- [ ] **Rätt till radering** - "Rätten att bli glömd"
- [ ] **Rätt till dataportabilitet** - Exportera data i maskinläsbart format
- [ ] **Rätt att invända** - Mot automatiserat beslutsfattande

```typescript
// API-endpoints för GDPR-rättigheter
// GET /api/gdpr/export?email=customer@example.com
// DELETE /api/gdpr/delete?email=customer@example.com
```

### 5. Dataminimering

Samla bara in data som är **nödvändig**:

- ✅ Kundens email (för att svara)
- ✅ Ärendehistorik (för kontext)
- ❌ Onödig personlig information
- ❌ Data som sparas längre än nödvändigt

### 6. Lagringstider

Definiera hur länge data sparas:

| Datatyp | Lagringstid | Motivering |
|---------|-------------|------------|
| Aktiva tickets | Tills ärendet är löst | Nödvändigt för support |
| Stängda tickets | 2 år | Dokumentation, reklamationer |
| Kundkontext | Realtid, ej sparad | Hämtas vid behov |
| Loggar | 90 dagar | Felsökning, säkerhet |

---

## 🤖 AI-specifika överväganden

### OpenAI & GDPR

**Viktigt att veta:**

1. **Data skickas till OpenAI** - Ticket-innehåll och kundkontext
2. **OpenAI sparar inte data** (med API) - Men verifiera i deras policy
3. **Ingen träning på din data** - OpenAI API använder inte din data för träning

**Åtgärder:**
- [ ] Signera OpenAI DPA
- [ ] Informera kunder att AI används
- [ ] Ge möjlighet att opt-out från AI-svar

### Automatiserade beslut

Om AI fattar beslut som **väsentligt påverkar** kunden:

- [ ] Informera om att AI används
- [ ] Ge rätt till mänsklig granskning
- [ ] Dokumentera AI:ns beslutslogik

---

## 🛡️ Tekniska säkerhetsåtgärder

### 1. Environment Variables

**Aldrig commit känslig data:**

```bash
# .env.local (ALDRIG i git)
DATABASE_URL="..."
OPENAI_API_KEY="..."
ENCRYPTION_KEY="..."
```

### 2. Audit Logging

Logga alla känsliga operationer:

```typescript
// Exempel: Audit log
interface AuditLog {
  timestamp: Date;
  userId: string;
  action: 'VIEW_TICKET' | 'SEND_RESPONSE' | 'DELETE_DATA';
  resourceId: string;
  ipAddress: string;
}
```

### 3. Backup & Recovery

- [ ] Dagliga backups
- [ ] Krypterade backups
- [ ] Testad återställningsprocess
- [ ] Geografisk redundans

### 4. Incidenthantering

Ha en plan för dataintrång:

1. **Upptäck** - Övervaka för ovanlig aktivitet
2. **Begränsa** - Stoppa intrånget
3. **Rapportera** - Till Datainspektionen inom 72h
4. **Informera** - Drabbade kunder om hög risk
5. **Åtgärda** - Förhindra framtida intrång

---

## ✅ Checklista för produktion

### Innan lansering:

**Juridiskt:**
- [ ] Integritetspolicy uppdaterad
- [ ] DPA signerade med alla leverantörer
- [ ] Rättslig grund dokumenterad
- [ ] Personuppgiftsansvarig utsedd

**Tekniskt:**
- [ ] HTTPS aktiverat
- [ ] Autentisering implementerad
- [ ] Credentials krypterade
- [ ] Rate limiting aktiverat
- [ ] Audit logging aktiverat
- [ ] Backups konfigurerade

**Processer:**
- [ ] Rutin för dataexport (GDPR)
- [ ] Rutin för dataradering (GDPR)
- [ ] Incidenthanteringsplan
- [ ] Regelbunden säkerhetsgranskning

---

## 📚 Resurser

- [Datainspektionen - GDPR](https://www.imy.se/verksamhet/dataskydd/)
- [OpenAI Data Processing Addendum](https://openai.com/policies/data-processing-addendum)
- [OWASP Security Guidelines](https://owasp.org/www-project-web-security-testing-guide/)
- [NextAuth.js Documentation](https://next-auth.js.org/)

---

## ⚠️ Ansvarsfriskrivning

Detta dokument är en **vägledning**, inte juridisk rådgivning. Konsultera en jurist specialiserad på dataskydd för att säkerställa full GDPR-efterlevnad för din specifika situation.
