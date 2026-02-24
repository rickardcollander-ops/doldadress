# Gmail Integration Setup

## Overview

The Gmail integration allows Doldadress to automatically convert unread emails from your Gmail inbox into support tickets.

## Setup Steps

### 1. Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Gmail API**:
   - Go to "APIs & Services" > "Library"
   - Search for "Gmail API"
   - Click "Enable"

### 2. Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. Configure the OAuth consent screen if prompted
4. Select "Web application" as the application type
5. Add authorized redirect URIs:
   - `https://developers.google.com/oauthplayground`
6. Save and note down:
   - **Client ID**
   - **Client Secret**

### 3. Get Refresh Token

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your Client ID and Client Secret
5. In Step 1, select:
   - `https://www.googleapis.com/auth/gmail.readonly`
   - `https://www.googleapis.com/auth/gmail.modify`
6. Click "Authorize APIs"
7. Sign in with your Gmail account
8. In Step 2, click "Exchange authorization code for tokens"
9. Copy the **Refresh Token**

### 4. Configure in Doldadress

1. Go to **Settings** in Doldadress
2. Find the **Gmail** integration card
3. Enter:
   - **OAuth Client ID**: Your Client ID from step 2
   - **OAuth Client Secret**: Your Client Secret from step 2
   - **Refresh Token**: Your Refresh Token from step 3
4. Click **Save**
5. Toggle **Enable** to activate the integration

## Usage

### Automatic Ticket Creation

To check for new emails and create tickets:

**API Endpoint:**
```
POST /api/gmail/check-inbox
```

**Response:**
```json
{
  "success": true,
  "ticketsCreated": 3,
  "tickets": [...]
}
```

### Set Up Automatic Polling

You can set up a cron job or scheduled task to automatically check for new emails:

**Example (using cron):**
```bash
# Check every 5 minutes
*/5 * * * * curl -X POST https://your-domain.com/api/gmail/check-inbox
```

**Example (using Vercel Cron):**
```json
{
  "crons": [{
    "path": "/api/gmail/check-inbox",
    "schedule": "*/5 * * * *"
  }]
}
```

### How It Works

1. **Fetch Unread Emails**: The system fetches up to 10 unread emails from your Gmail inbox
2. **Create Tickets**: Each email is converted into a ticket with:
   - Customer email extracted from sender
   - Subject line as ticket subject
   - Email body as ticket message
   - Customer context gathered from all active integrations
3. **Mark as Read**: Once a ticket is created, the email is marked as read to prevent duplicates
4. **Duplicate Prevention**: Tickets are not created if one already exists for the same customer/subject in the last 24 hours

## Integration Info Cards

When viewing a ticket, you'll see colored info cards showing data from all connected integrations:

- **Stripe** (Blue): Subscriptions, invoices, charges
- **Billecta** (Green): Invoice information
- **Resend** (Purple): Email history
- **Gmail** (Red): Total emails, recent threads
- **Retool** (Orange): Custom data

## Troubleshooting

### "Gmail integration not configured"
- Make sure you've entered all three credentials in Settings
- Verify the integration is enabled (toggle switch)

### "Invalid credentials"
- Double-check your Client ID and Client Secret
- Make sure the Refresh Token hasn't expired
- Try generating a new Refresh Token

### Emails not creating tickets
- Check that emails are actually unread in Gmail
- Verify the API endpoint is being called
- Check server logs for errors

## Security Notes

- **Never commit credentials** to version control
- Store credentials in environment variables or secure database
- Refresh tokens can expire - you may need to regenerate them periodically
- Use the minimum required OAuth scopes

## Permissions Required

- `gmail.readonly`: Read emails from inbox
- `gmail.modify`: Mark emails as read after processing
