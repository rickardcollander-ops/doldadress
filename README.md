# Doldadress Ticket System

AI-powered customer support system that replaces Zendesk.

## Quick Start

1. **Install dependencies:**
```bash
npm install
```

2. **Set up database:**
See `DATABASE_SETUP.md` for detailed PostgreSQL setup instructions.

Quick version:
```bash
# Create database
createdb doldadress

# Set environment variable
echo 'DATABASE_URL="postgresql://postgres:password@localhost:5432/doldadress"' > .env.local
```

3. **Set up environment variables:**
Create a `.env.local` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/doldadress"
OPENAI_API_KEY="sk-..."
```

4. **Initialize database:**
```bash
npx prisma generate
npx prisma db push
```

5. **Start development server:**
```bash
npm run dev
```

6. **Open:** http://localhost:3001

## Features

- ✅ **Tickets** - AI-powered ticket management
- ✅ **Knowledge Base** - Manage articles for AI responses
- ✅ **Reports** - Analytics and statistics dashboard
- ✅ **Settings** - Configure integrations
- ✅ **Gmail Integration** - Convert emails to tickets
- ✅ **Dark/Light Mode** - Theme toggle

## Integrations

- **Stripe** - Payment and subscription data
- **Billecta** - Invoice information
- **Resend** - Email sending
- **Gmail** - Email to ticket conversion
- **Retool** - Custom data workflows

## Tech Stack

- Next.js 16
- TypeScript
- Prisma (PostgreSQL)
- OpenAI GPT-4
- Tailwind CSS
- Lucide Icons

## Documentation

- `DATABASE_SETUP.md` - Database configuration and setup
- `GMAIL_SETUP.md` - Gmail OAuth integration guide
- `TICKET_SYSTEM_SETUP.md` - Complete system documentation

## Project Structure

```
doldadress/
├── app/
│   ├── tickets/        # Ticket management
│   ├── knowledge/      # Knowledge base
│   ├── reports/        # Analytics dashboard
│   ├── settings/       # Integration settings
│   └── api/           # API routes
├── components/         # React components
├── lib/
│   ├── integrations/  # External service integrations
│   ├── services/      # Business logic
│   └── types/         # TypeScript types
└── prisma/            # Database schema
```
