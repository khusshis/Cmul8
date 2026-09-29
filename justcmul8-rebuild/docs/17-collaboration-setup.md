# Real-time Collaboration — Setup Checklist

Sharing works like Google Drive / Canva: invite people by email as **Editor** or **Viewer**,
or set **General access** to *Anyone with the link*. The code is already in place; these are the
one-time steps to switch it on.

---

## 1. Run the database migration (required)

1. Open **Supabase Dashboard → SQL Editor → New query**.
2. Paste the whole of [`supabase/collaboration.sql`](../supabase/collaboration.sql) and click **Run**.
   - Safe to run more than once.
   - It is also appended to the end of `supabase/schema.sql`.
3. Check it worked: **Table Editor** should now list `project_members`, and `project_shares`
   should have the new columns `link_access` and `link_role`.

What it adds:

| Piece | Purpose |
|---|---|
| `project_members` table | Who has access, by email, with role `viewer` / `editor` |
| `project_role(pid)` | Returns `owner` / `editor` / `viewer` / NULL for the current user |
| `project_collaborators(pid)` | People-with-access list for the Share dialog |
| `accept_share_link(token)` | Joins a signed-in user through an "Anyone with the link" URL |
| New RLS policies | Owners + editors can edit, viewers can only read, strangers get nothing |
| Realtime policies | Collaborators can send and receive cursors, presence and edits |

> **Until this runs, nobody except the owner can open a shared project.**

---

## 2. Invite emails through Gmail SMTP (required for emails)

1. Sign in to the Gmail account the invites should come from.
2. **Google Account → Security → 2-Step Verification** → turn it on.
3. Open <https://myaccount.google.com/apppasswords>, create an app password named `JustCmul8`,
   and copy the 16-character password.
4. Add these to `.env.local` (no spaces in the password):

   ```env
   GMAIL_USER=yourname@gmail.com
   GMAIL_APP_PASSWORD=abcdefghijklmnop
   ```

5. Restart the dev server (`npm run dev`) so it picks up the new variables.

Notes:
- Limit: about **500 emails/day** on a personal Gmail account.
- The first few invites may land in **Spam**. Ask the recipient to mark them "Not spam".
- If an email fails, the person **still gets access**. The Share dialog shows a warning, so you
  can send them the link yourself.

---

## 3. Supabase Auth settings (required)

In **Supabase Dashboard → Authentication**:

1. **Providers → Email → Confirm email** must be **ON**.
   Invites match on a *confirmed* email; with confirmation off, anyone could sign up using an
   invited address and get that access.
2. **URL Configuration → Redirect URLs** must include your callback, e.g.
   - `http://localhost:3000/auth/callback`
   - `https://<your-production-domain>/auth/callback`

   (Invite links send people through login/signup and back to the project via this callback.)

---

## 4. Test it (two browsers or one normal + one incognito window)

Use two different accounts: **A** = owner, **B** = invited person.

- [ ] A opens a project → **Share** → invites B's email as **Editor** → B receives the email.
- [ ] B clicks **Open simulation**, signs in or signs up with that email, and lands in the live workspace.
- [ ] A and B see each other's **avatars and live cursors**.
- [ ] B drags a block, edits a property, and adds or removes a block → A sees each change live.
- [ ] Reload both → changes are saved.
- [ ] A switches B to **Viewer** → B's tab shows **View only** and can't edit.
- [ ] A removes B → B is sent back to the dashboard.
- [ ] **General access → Anyone with the link → Editor**, copy the link, open it with a third account C → C joins as editor.
- [ ] Switch back to **Restricted** → C loses access. Try the link signed out → you're asked to sign in.
- [ ] **Reset link** → the old URL shows "This Share Link Was Revoked".
- [ ] B's dashboard shows the project under **Shared with me**.

---

## Known limits

- If two people edit the **same field at the same moment**, the last change wins (no Yjs/CRDT merging).
- Shared users do not see the owner's run history or AI chat; they get the canvas and their own runs.
- Viewers can run simulations locally, but can't change the model.
