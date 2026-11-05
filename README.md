# Campus Library — Smart Library Management System

A complete frontend prototype for an engineering-college library management system. It is designed so the UI and workflows can be connected to Supabase in the next step.

## Included now
- Official college email login flow (demo validation for `@kgrcet.edu.in`)
- Student, Faculty and Librarian roles
- Student/Faculty dashboard
- Book search, filters, details and reservation/waiting list
- My Books, fines, notifications, profile and resources
- Librarian dashboard
- Book catalogue CRUD with copies/shelf/category data
- Member management
- Issue / Return workflow
- Reservations
- Categories
- Reports & analytics dashboard
- Local persistence using browser localStorage
- Responsive desktop/tablet/mobile UI

## Run
1. Install Node.js LTS.
2. Open this folder in VS Code.
3. Run `npm install`.
4. Run `npm run dev`.
5. Open the Vite URL shown in the terminal.

## Demo accounts
Student: `saketh@kgrcet.edu.in`
Faculty: `anitha.rao@kgrcet.edu.in`
Librarian: `library@kgrcet.edu.in`

Any `@kgrcet.edu.in` address is accepted in this prototype so you can test different users.

## Important
This version deliberately uses a local data layer. The next implementation step should create the Supabase schema, authentication, Row Level Security policies, storage buckets (only if digital files are required), and replace the local DB functions with Supabase queries. The UI does not need to be rebuilt for that migration.


## Current Supabase implementation

The current build uses Supabase Auth and PostgreSQL rather than localStorage.

### Book management

The librarian Books screen now supports real catalogue records with:
- unique accession code
- title, ISBN, author, publisher, publication year, edition and language
- category
- description
- cover URL and eBook URL
- physical copy count
- shelf and rack numbers
- automatic creation of individual `book_copies` records such as `CSE-DS-001-C001`
- automatic available-copy tracking
- editing the catalogue and safely increasing/reducing physical copies
- author records through `authors` and `book_authors`

The project expects the Supabase schema/RLS policies described in the project setup instructions to already exist.

## Library AI Assistant

The authenticated application includes a floating, database-connected assistant for catalogue searches, the signed-in user's loans, reservations and fines, active learning resources, and library process questions. It uses a Supabase Edge Function and Groq for intent classification. Database answers are built from controlled Supabase queries; the model cannot execute SQL, and account queries are filtered to the signed-in user and continue to run under their Supabase JWT/RLS policies.

### Edge Function development

Install the Deno VS Code extension to enable type checking and editor support for `supabase/functions`; the workspace settings scope Deno to that folder so the Vite frontend continues to use its existing TypeScript configuration. The function's `deno.json` pins its Supabase npm import and enables strict, no-implicit-any checking. Validate it locally with:

```sh
deno check --config supabase/functions/library-assistant/deno.json supabase/functions/library-assistant/index.ts
```

### Configure and deploy

1. In the Supabase SQL editor, run [`supabase-library-assistant.sql`](./supabase-library-assistant.sql). This adds a private per-user rate-limit table and an authenticated-only RPC; it does not change existing library tables or RLS policies.
2. Set the Groq key as a Supabase Edge Function secret, never as a Vite or Vercel client variable:

   ```sh
   supabase secrets set GROQ_API_KEY=your-groq-api-key
   ```

   Optionally set `GROQ_MODEL` to a Groq chat-completion model. The default is `llama-3.3-70b-versatile`. Supabase supplies `SUPABASE_URL` and its anon/publishable key to Edge Functions.
3. Link the Supabase CLI to the existing project if needed, then deploy the function:

   ```sh
   supabase functions deploy library-assistant
   ```

   Keep JWT verification enabled for the function. It uses the caller's bearer token and anon/publishable key for all database reads; it does not use a service-role key.
4. Deploy the frontend to Vercel with the existing `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` variables. Do not add `GROQ_API_KEY` to Vercel or any `VITE_*` variable.

The function accepts JSON messages up to 500 characters and allows up to 10 requests per authenticated user per minute. It reads active resources ordered by the schema's `uploaded_at` column. No PDF-based RAG or storage ingestion is included.

### Smoke checks

- Sign in as a student and ask for available books, personal loans/due dates, and pending fines; verify displayed records against that account.
- Ask for an unrelated topic and verify the assistant redirects to library help.
- Sign out and confirm the assistant is not rendered; invoke the Edge Function without a bearer token and confirm it returns HTTP 401.
- Use a second student account to verify the first student's loans and fines are not returned.
- Ask about resources and verify only active resource links are shown.
