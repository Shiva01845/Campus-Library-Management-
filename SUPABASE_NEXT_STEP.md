# Supabase connection map

The downloaded project currently uses browser localStorage so the UI is fully demoable without credentials.

When connecting Supabase, create these tables first:

- profiles: id, name, email, role, department, year, status
- books: id, title, author, isbn, category_id, publisher, year, shelf, total_copies, available_copies, description, cover_url
- categories: id, name
- loans: id, book_id, user_id, issued_at, due_at, returned_at, status
- reservations: id, book_id, user_id, created_at, status
- fines: id, user_id, loan_id, amount, reason, status
- notifications: id, user_id, title, message, created_at, read, type

Recommended Supabase additions:
- Auth with college email domain restriction
- Row Level Security so students/faculty only see their own loans, reservations, fines and notifications
- Librarian role policy for catalogue/circulation/member management
- Storage bucket only if the college later decides to host PDFs/e-books

Do not upload 10,000 e-books just to make the catalogue work. The catalogue should store metadata; digital resources can be linked separately.
