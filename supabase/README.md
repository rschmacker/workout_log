# Database (Supabase)

- `schema.sql` – the complete database for a fresh setup (tables, sharing rules, functions,
  built-in exercises). Safe to run again.
- `migrations/` – the changes that were run one by one on the existing database, in date
  order. All of them have been run already; they are kept as a record.
- `tests/privacy_and_sharing_test.sql` – checks what users can see and change (changes
  nothing). Run it after database changes: SQL Editor → New query → paste → Run.
  Every row should say PASS.

All SQL is run in Supabase under **SQL Editor → New query → paste → Run**.

## Shared with the kleinkind-essen app

This Supabase project is also used by the **kleinkind-essen** app. Both apps share the
same accounts (Authentication → Users), the same `public` database schema and the same
login settings (Site URL, Redirect URLs, "Allow new users to sign up"). So:

- The invite-only list below applies to **both** apps: a new kleinkind-essen user also
  needs their email on `allowed_emails`.
- "Shared with all signed-in users" also includes kleinkind-essen accounts (they could
  read workouts, exercises and display names - never anyone's sets or notes).
- New tables and functions need names that can't clash with the other app.

## Who sees what

- **Shared** between all signed-in users: workouts, all exercises (built-in and custom),
  display names. Everyone can edit workouts; only the creator can delete a workout or
  rename/delete their custom exercise.
- **Private** per user: logged sets, Besonderheiten/notes, history, the CSV export.
- **Invite-only**: an account can only be created for an email address on the list
  `allowed_emails` (and "Allow new users to sign up" stays switched off).

## Adding a person

1. In the SQL editor, put their email address on the list. It must be the **primary
   email of their GitHub account**:

   ```sql
   insert into public.allowed_emails (email) values ('their.address@example.com');
   ```

2. **Authentication → Sign In / Providers**: switch on **Allow new users to sign up**.
3. They open https://rschmacker.github.io/workout_log/ in Safari, tap Share → **Add to
   Home Screen**, open the app from the Home Screen and tap **Sign in with GitHub**.
4. Switch **Allow new users to sign up** off again.
5. They can set their name in the app under **Settings → Your name**.

Use GitHub to log in: it works in the Home Screen app. The email link only works in
Safari (not the Home Screen app), and Supabase's "Invite user" email uses a login method
this app doesn't accept.

If someone with an address that is not on the list tries to sign up, Supabase refuses
with "Database error saving new user".

## Removing a person

1. Delete their address from the list:
   `delete from public.allowed_emails where email = 'their.address@example.com';`
2. **Authentication → Users** → their account → **Delete user**. Their sets and notes are
   deleted with it; workouts they created stay (as read-only workouts without a creator).
   If deleting fails because others use one of their custom exercises, that exercise has
   to be handed over first (`update public.exercises set user_id = '<your id>' where …`).
