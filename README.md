# MR Engines – Warranty Claims Management System

A local-first, testable web application for handling engine warranty claims for MR Engines. Built with Next.js, TypeScript, Prisma, and shadcn/ui.

## Features

- **Email Integration**: IMAP/SMTP integration for syncing emails from a dedicated warranty mailbox
- **Incremental Mail Sync**: Manual and scheduled email synchronization (not triggered on every HTTP request)
- **Claim Management**: Full CRUD operations for warranty claims with MR1234/25 style claim codes
- **Work Order Tracking**: Link claims to work orders (RN – radni nalog)
- **Translation Support**: Pluggable translation providers (DeepL, OpenAI, Google) for translating documents, summaries, and captions
- **File Management**: Store and preview images and PDFs with text extraction capabilities
- **Client Documents**: Extract and translate text from PDF documents
- **Photo Management**: Organize and caption photos with translation support
- **Report Sections**: Structured findings with translation capabilities

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui components
- **ORM**: Prisma
- **Database**: SQLite (local dev), PostgreSQL (production-ready)
- **Email**: imapflow (IMAP), nodemailer (SMTP), mailparser (MIME parsing)
- **PDF**: pdf-parse (text extraction), react-pdf (viewing)
- **Translation**: Pluggable providers (DeepL, OpenAI, Google)

## Prerequisites

- Node.js 18+ and npm
- SQLite (for local development)
- IMAP/SMTP email account credentials
- (Optional) Translation API key (DeepL, OpenAI, or Google)

## Installation

1. Clone the repository and navigate to the project directory:
```bash
cd mr-engines-warranty
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` with your configuration (see Environment Variables section below).

4. Set up the database:
```bash
npx prisma migrate dev
```

This will:
- Create the SQLite database file at `prisma/dev.db`
- Run all migrations to set up the schema
- Generate the Prisma Client

5. (Optional) Seed initial data:
You can manually create users, customers, and work orders through the UI or by using Prisma Studio:
```bash
npx prisma studio
```

6. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

All configuration is done via environment variables (12-factor style). See `.env.example` for a template.

### Database
- `DATABASE_URL`: Database connection string
  - SQLite (dev): `file:./dev.db`
  - PostgreSQL (prod): `postgresql://user:password@localhost:5432/dbname`

### Email (IMAP)
- `IMAP_HOST`: IMAP server hostname (e.g., `imap.example.com`)
- `IMAP_PORT`: IMAP port (typically 993 for TLS)
- `IMAP_USER`: IMAP username (e.g., `warranty@mrgroup.rs`)
- `IMAP_PASS`: IMAP password
- `IMAP_TLS`: Enable TLS (`true` or `false`)

### Email (SMTP)
- `SMTP_HOST`: SMTP server hostname
- `SMTP_PORT`: SMTP port (typically 587 for TLS, 465 for SSL)
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `SMTP_TLS`: Enable TLS (`true` or `false`)

### File Storage
- `FILE_ROOT_PATH`: Root path for storing attachments (absolute or relative)
  - Example: `./storage` (relative) or `/var/app/storage` (absolute)
  - Files are organized by claim year and claim code

### Translation
- `TRANSLATION_PROVIDER`: Provider to use (`deepl`, `openai`, `google`, or `none`)
- `TRANSLATION_API_KEY`: API key for the chosen provider
- `TRANSLATION_BASE_URL`: (Optional) Custom base URL for the API
- `TRANSLATION_MODEL`: (Optional) Model name for OpenAI (e.g., `gpt-3.5-turbo`)

### Mail Sync
- `MAIL_SYNC_ENABLED`: Enable mail sync (`true` or `false`, default: `true`)
- `MAIL_SYNC_INTERVAL_SECONDS`: Interval for scheduled sync (default: 300)
- `MAIL_SYNC_MAX_MESSAGES_PER_RUN`: Maximum messages to process per sync (default: 50)

## Project Structure

```
mr-engines-warranty/
├── app/                    # Next.js App Router pages and API routes
│   ├── api/               # API routes
│   │   ├── admin/         # Admin endpoints (mail sync)
│   │   ├── claims/        # Claims CRUD and operations
│   │   ├── files/         # File serving
│   │   ├── inbox/         # Email thread endpoints
│   │   └── work-orders/   # Work order endpoints
│   ├── claims/            # Claims UI pages
│   ├── inbox/             # Inbox UI page
│   ├── work-orders/       # Work orders UI pages
│   └── layout.tsx         # Root layout
├── components/            # React components
│   ├── layout/            # Layout components (Sidebar, MainLayout)
│   └── ui/                # shadcn/ui components
├── lib/                   # Core business logic
│   ├── config/           # Configuration (env.ts)
│   ├── db/               # Database client (prisma.ts)
│   ├── domain/           # Domain logic (claimCode.ts)
│   ├── email/            # Email integration
│   │   ├── imapClient.ts
│   │   ├── smtpClient.ts
│   │   └── mailSyncService.ts
│   ├── files/            # File storage and PDF extraction
│   │   ├── fileStorage.ts
│   │   └── pdfTextExtractor.ts
│   └── translation/      # Translation providers
│       └── translator.ts
├── prisma/               # Prisma schema and migrations
│   └── schema.prisma
└── storage/              # File storage root (created at runtime)
```

## Database Schema

The application uses Prisma with the following main models:

- **User**: Internal users/workers (Admin, Operator, Technician, Worker)
- **Customer**: External customers
- **WorkOrder**: Work orders (RN – radni nalog)
- **Claim**: Warranty claims with MR1234/25 style codes
- **EmailThread**: Email conversation threads
- **EmailMessage**: Individual email messages (inbound/outbound)
- **Attachment**: File attachments from emails or manual uploads
- **ClientDocument**: Extracted text from client documents with translations
- **Photo**: Photos with captions and translations
- **ReportSection**: Structured report sections with translations
- **MailSyncState**: Mail synchronization state tracking

See `prisma/schema.prisma` for the complete schema.

## Usage

### Mail Sync

1. Configure IMAP credentials in `.env`
2. Navigate to the Inbox page (`/inbox`)
3. Click "Sync emails now" to manually sync emails
4. New emails will create email threads and can be linked to claims

### Creating Claims

1. Navigate to Claims (`/claims`)
2. Click "New claim" or create from an email thread
3. Fill in claim details (claim code, customer, work order, etc.)
4. Claim codes are automatically parsed (e.g., "MR1234/25" → prefix: "MR", number: 1234, year: 2025)

### Managing Claims

- **Overview**: View and edit summaries (Serbian/English)
- **Emails**: View email threads and send replies
- **Client Documents**: Extract text from PDFs and translate
- **Findings**: Manage report sections with translations
- **Photos**: View photos with captions
- **Work Order**: View linked work order details

### Translation

Translation is user-initiated to avoid quota usage:

1. Navigate to the content you want to translate (summary, document, section, photo caption)
2. Click the "Translate" button
3. Translation is stored in the database and won't be re-translated unless explicitly requested

### File Storage

- Files are stored under `FILE_ROOT_PATH/<year>/<claimCode>/<subfolder>/`
- Unassigned email threads store files under `FILE_ROOT_PATH/_unassigned/<threadId>/`
- Files are served via `/api/files/[attachmentId]`

## Development

### Database Migrations

After changing the Prisma schema:
```bash
npx prisma migrate dev --name your_migration_name
```

### Prisma Studio

View and edit database records:
```bash
npx prisma studio
```

### Building for Production

```bash
npm run build
npm start
```

## Deployment

The application is structured for easy deployment:

1. **Environment Variables**: Set all required environment variables
2. **Database**: Use PostgreSQL in production (update `DATABASE_URL`)
3. **File Storage**: Mount a volume for `FILE_ROOT_PATH` or use cloud storage
4. **Docker**: Create a Dockerfile and docker-compose.yml (not included, but straightforward)
5. **Background Jobs**: Implement a scheduler for mail sync (e.g., using node-cron or a job queue)

## Future Enhancements

- PDF report generation (HTML → PDF)
- Advanced email threading and conversation view
- User authentication and authorization
- Background job scheduler for mail sync
- NAS integration for file storage
- Advanced search and filtering
- Bulk operations
- Export functionality

## License

Private - MR Engines internal use only.
