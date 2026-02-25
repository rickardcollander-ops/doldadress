# Säkerhetsrekommendationer

## KRITISKT: Kryptering av Credentials

### Nuvarande Problem
Integration credentials (Billecta API keys, Stripe keys, etc.) och API-nycklar sparas för närvarande i **klartext** i databasen:

1. **Integration.credentials** (JSON) - innehåller API-nycklar för Billecta, Stripe, Resend etc.
2. **ApiKey.key** (String) - utvecklar-API-nycklar

### Rekommenderad Lösning

#### 1. Kryptera Integration Credentials
```typescript
// lib/crypto.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY!; // 32 bytes
const ALGORITHM = 'aes-256-gcm';

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    Buffer.from(ENCRYPTION_KEY, 'hex'),
    Buffer.from(ivHex, 'hex')
  );
  
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

#### 2. Uppdatera Integration API
```typescript
// app/api/integrations/route.ts
import { encrypt, decrypt } from '@/lib/crypto';

// Vid sparande:
const encryptedCredentials = encrypt(JSON.stringify(credentials));
await prisma.integration.create({
  data: {
    credentials: encryptedCredentials, // Spara krypterad sträng
  }
});

// Vid läsning:
const integration = await prisma.integration.findUnique(...);
const decryptedCreds = JSON.parse(decrypt(integration.credentials));
```

#### 3. Miljövariabel
Lägg till i Vercel Environment Variables:
```
ENCRYPTION_KEY=<64 hex characters - generera med: openssl rand -hex 32>
```

### Alternativ: Använd Vercel KV eller Secret Manager
- Spara credentials i Vercel KV (Redis)
- Använd AWS Secrets Manager / Google Secret Manager
- Referera bara till secret-ID i databasen

### Implementeringssteg
1. Generera ENCRYPTION_KEY och lägg till i Vercel
2. Skapa crypto.ts med encrypt/decrypt
3. Uppdatera integrations API för att kryptera vid save
4. Uppdatera alla services som läser credentials för att dekryptera
5. Migrera befintliga credentials (en-gångs-skript)

### Status
⚠️ **INTE IMPLEMENTERAT** - Credentials sparas för närvarande i klartext
✅ **DOKUMENTERAT** - Rekommendationer finns här

### Prioritet
**HÖG** - Bör implementeras innan production-användning med riktiga API-nycklar
