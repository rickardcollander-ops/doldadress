# Database Setup Guide

## Overview

Doldadress använder PostgreSQL som databas via Prisma ORM.

## Snabbstart

### 1. Installera PostgreSQL

**Windows:**
- Ladda ner från [postgresql.org](https://www.postgresql.org/download/windows/)
- Kör installern och följ instruktionerna
- Kom ihåg lösenordet du sätter för `postgres` användaren

**macOS (med Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. Skapa Databas

```bash
# Logga in som postgres användare
psql -U postgres

# Skapa databas
CREATE DATABASE doldadress;

# Skapa användare (valfritt)
CREATE USER doldadress_user WITH PASSWORD 'ditt_lösenord';
GRANT ALL PRIVILEGES ON DATABASE doldadress TO doldadress_user;

# Avsluta
\q
```

### 3. Konfigurera Environment Variables

Skapa `.env.local` fil i projektets root:

```env
# Database
DATABASE_URL="postgresql://postgres:ditt_lösenord@localhost:5432/doldadress"

# OpenAI
OPENAI_API_KEY="sk-..."

# Stripe (valfritt)
STRIPE_API_KEY="sk_live_..."

# Billecta (valfritt)
BILLECTA_API_KEY="..."
BILLECTA_CREDITOR_ID="..."

# Resend (valfritt)
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="support@doldadress.com"

# Gmail (valfritt)
GMAIL_CLIENT_ID="..."
GMAIL_CLIENT_SECRET="..."
GMAIL_REFRESH_TOKEN="..."

# Retool (valfritt)
RETOOL_API_KEY="..."
RETOOL_WORKSPACE_URL="https://yourcompany.retool.com"
```

### 4. Initiera Prisma

```bash
# Generera Prisma Client
npx prisma generate

# Skapa tabeller i databasen
npx prisma db push

# (Valfritt) Öppna Prisma Studio för att se data
npx prisma studio
```

## Database Schema

Doldadress använder följande tabeller:

### Tenant
- Hanterar olika kunder/tenants
- Varje tenant har sin egen data isolerad

### Ticket
- Support tickets från kunder
- Innehåller original meddelande, AI-svar, och kontext
- Status: new, in_progress, review, sent, closed
- Priority: low, normal, high, urgent

### KnowledgeBase
- Artiklar som AI använder för att generera svar
- Kategorier och tags för organisation
- Kan aktiveras/inaktiveras

### Integration
- Lagrar credentials för externa tjänster
- Typer: stripe, billecta, retool, resend, gmail
- Credentials krypteras (TODO: implementera kryptering)

### Agent
- Användare som hanterar tickets
- Roller: agent, manager, admin

## Migrations

När du uppdaterar schema:

```bash
# Skapa migration
npx prisma migrate dev --name beskrivning_av_ändring

# Applicera migration i produktion
npx prisma migrate deploy
```

## Backup

### Manuell Backup

```bash
# Backup
pg_dump -U postgres doldadress > backup_$(date +%Y%m%d).sql

# Restore
psql -U postgres doldadress < backup_20260206.sql
```

### Automatisk Backup (Cron)

```bash
# Lägg till i crontab (crontab -e)
0 2 * * * pg_dump -U postgres doldadress > /backups/doldadress_$(date +\%Y\%m\%d).sql
```

## Production Setup

### Hosted Database (Rekommenderat)

**Neon (Gratis tier):**
1. Gå till [neon.tech](https://neon.tech)
2. Skapa nytt projekt
3. Kopiera connection string
4. Uppdatera `DATABASE_URL` i `.env.local`

**Supabase:**
1. Gå till [supabase.com](https://supabase.com)
2. Skapa nytt projekt
3. Gå till Settings > Database
4. Kopiera connection string (Pooling mode)
5. Uppdatera `DATABASE_URL`

**Railway:**
1. Gå till [railway.app](https://railway.app)
2. Skapa PostgreSQL service
3. Kopiera DATABASE_URL från variables
4. Uppdatera `.env.local`

### Connection Pooling

För produktion, använd connection pooling:

```env
# Direkt connection
DATABASE_URL="postgresql://user:pass@host:5432/db"

# Med pooling (Supabase/Neon)
DATABASE_URL="postgresql://user:pass@host:6543/db?pgbouncer=true"
```

## Seed Data

För att lägga till initial data:

```bash
# Skapa seed script
npx prisma db seed
```

Exempel seed data (skapa `prisma/seed.ts`):

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Skapa tenant
  const tenant = await prisma.tenant.create({
    data: {
      subdomain: 'doldadress',
      name: 'Doldadress',
    },
  });

  // Skapa kunskapsbasartiklar
  await prisma.knowledgeBase.createMany({
    data: [
      {
        tenantId: tenant.id,
        title: 'Hur man återställer lösenord',
        content: 'För att återställa ditt lösenord...',
        category: 'Account',
        tags: ['password', 'account', 'security'],
        isActive: true,
      },
      {
        tenantId: tenant.id,
        title: 'Fakturafrågor',
        content: 'Om du har frågor om din faktura...',
        category: 'Billing',
        tags: ['invoice', 'billing', 'payment'],
        isActive: true,
      },
    ],
  });

  console.log('Seed data created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

Lägg till i `package.json`:

```json
{
  "prisma": {
    "seed": "ts-node --compiler-options {\"module\":\"CommonJS\"} prisma/seed.ts"
  }
}
```

## Troubleshooting

### "Can't reach database server"
- Kontrollera att PostgreSQL körs: `pg_isready`
- Verifiera DATABASE_URL är korrekt
- Kontrollera firewall-inställningar

### "Schema out of sync"
```bash
npx prisma db push --force-reset
```

### "Too many connections"
- Använd connection pooling
- Stäng connections korrekt med `prisma.$disconnect()`

### "Permission denied"
```bash
# Ge användaren rätt permissions
GRANT ALL PRIVILEGES ON DATABASE doldadress TO doldadress_user;
GRANT ALL ON SCHEMA public TO doldadress_user;
```

## Monitoring

### Prisma Studio
```bash
npx prisma studio
```
Öppnar GUI på http://localhost:5555

### SQL Queries
```bash
# Logga in i databasen
psql -U postgres doldadress

# Visa alla tickets
SELECT * FROM "Ticket";

# Räkna tickets per status
SELECT status, COUNT(*) FROM "Ticket" GROUP BY status;
```

## Security Best Practices

1. **Aldrig commit credentials** - Använd `.env.local` (finns i `.gitignore`)
2. **Använd starka lösenord** för databas-användare
3. **Begränsa network access** - Endast från din app-server
4. **Regular backups** - Automatisera backup-processen
5. **Kryptera credentials** - Implementera kryptering för Integration.credentials
6. **SSL/TLS** - Använd SSL för databas-connections i produktion

```env
# Med SSL
DATABASE_URL="postgresql://user:pass@host:5432/db?sslmode=require"
```
