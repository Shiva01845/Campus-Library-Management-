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
