# 🍩 Going live: every step

This guide takes Dani’s Donut Island from “preview” to a real site on **your own domain**, where **everyone’s notes are saved** and **you can approve, hide or delete any note**.

The site starts **completely empty**. The example notes only exist in Preview Mode and disappear the moment you connect the database.

**What you’ll set up**

| Piece | What it does | Cost |
|---|---|---|
| **GitHub Pages** | Hosts the website. Already working. | Free |
| **Supabase** | The database that saves everyone’s notes and your organizer login. | Free plan is plenty |
| **Your domain** | e.g. `danisdonutisland.com` instead of `nickwinters1.github.io/DanisDonutsv2` | About $10–15 a year |

Plan on about **30–45 minutes**, plus waiting for the domain to switch over (usually under an hour).

> Menus in Supabase, GitHub and your domain registrar change their wording now and then. If a button is named slightly differently, look for the closest match.

---

## Part 1: Create the database (Supabase)

1. Go to **https://supabase.com** and click **Start your project**. Sign in with GitHub.
2. Click **New project**.
   - **Name:** `danis-donut-island`
   - **Database password:** click **Generate a password**, then **copy it and keep it somewhere safe**. You won’t need it for the site, but you’ll want it if you ever contact Supabase support.
   - **Region:** pick the one closest to most of the community (e.g. *East US*).
   - **Plan:** Free.
3. Click **Create new project** and wait about 2 minutes while it sets up.
4. In the left sidebar open **SQL Editor**, then click **New query** (the **+**).
5. Open this file in a new tab, select **all** of its text and copy it:
   **https://github.com/nickwinters1/DanisDonutsv2/blob/main/supabase/setup.sql** (click the **Raw** button, then select all).
6. Paste it into the Supabase query box and click **Run**. If Supabase asks you to confirm, choose **Run query**. You should see **Success. No rows returned**.
7. Click **New query** again and repeat with the second file:
   **https://github.com/nickwinters1/DanisDonutsv2/blob/main/supabase/upgrade.sql**. Paste it, then click **Run** and look for **Success**.

✅ Your database now has the island’s tables and its security rules. Visitors can only *send* notes; nobody can see a note until you approve it.

## Part 2: Make yourself the organizer

8. In the left sidebar open **Authentication → Users**, then click **Add user → Create new user**.
   - Enter **your email** and a **strong password**. This is your organizer login for the site.
   - Tick **Auto Confirm User**, then click **Create user**.
9. Click your new user in the list and **copy the User UID** (a long code like `4f1c…-…`).
10. Go back to **SQL Editor → New query**, paste this with **your** UID in place of the placeholder, and click **Run**:
    ```sql
    insert into public.island_admins(user_id) values ('PASTE-YOUR-USER-UID-HERE');
    ```
11. Visitors never need accounts, so turn off sign-ups. Go to **Authentication → Sign In / Providers** (sometimes under *Authentication → Settings*), switch **off** **Allow new users to sign up**, and click **Save**.

> **More moderators?** Repeat steps 8–10 for each person, with their own email, password and UID.

## Part 3: Connect the website to the database

12. In Supabase, open **Project Settings** (the ⚙️ at the bottom of the sidebar).
    - Under **Data API** (or the **Connect** button at the top), copy the **Project URL**. It looks like `https://abcdefghijk.supabase.co`.
    - Under **API Keys**, copy the **Publishable key** (starts with `sb_publishable_`). If you only see **Legacy API keys**, copy the **anon public** key instead.
    - ⚠️ **Never** copy the **secret** or **service_role** key. The site refuses to use one anyway.
13. Open your repo on GitHub: **https://github.com/nickwinters1/DanisDonutsv2**, then go to **Settings → Secrets and variables → Actions**.
14. Click the **Variables** tab (not *Secrets*), then **New repository variable**. Add two:
    | Name | Value |
    |---|---|
    | `VITE_SUPABASE_URL` | your Project URL from step 12 |
    | `VITE_SUPABASE_ANON_KEY` | your publishable (or anon) key from step 12 |
15. Rebuild the site: open the **Actions** tab, click **Deploy to GitHub Pages** on the left, then **Run workflow → Branch: main → Run workflow**. Wait until it shows a green ✓ (about 1–2 minutes).
16. Open your site (**https://nickwinters1.github.io/DanisDonutsv2/** for now). The strip under the big title should say **Community edition**, not *Preview*, and the example notes should be **gone**.

## Part 4: Sign in, test it, and choose “surprise” or “open”

17. Scroll to the very bottom of the site and click **Organizer**, or add `#organizer` to the end of the address. Sign in with the email and password from step 8.
18. In **Edition**, set the **Celebration title** (e.g. *Dani’s 3-year anniversary*) and click **Save edition settings**.
19. **Choose how the island opens:**
    - **Keep it a surprise (default):** leave **Open the surprise** unticked. People can leave notes and play the island, but notes stay hidden until reveal day. On the big day, tick it and save, and every open page lights up within about 30 seconds.
    - **Open it now:** tick **Open the surprise** and click **Save**. Approved notes then appear straight away: on the wall, as little Donuts walking the island, in bottles, packs, crystals and the cinema.
20. **Test it:** on your phone (or a private/incognito window) open the site, click **✉ Leave a note**, and send one.
21. Back in the Organizer dashboard, your note is in **Pending**. Click **Approve**. If the island is open, it appears on the wall and as a Donut on the island.
22. Delete your test note before you share the link (see below).

### How moderation works

- **Every new note waits for you.** Nothing appears publicly until you click **Approve**, so a bad note never shows up unless you let it.
- **Hide** (the same as *Reject*) takes a note off the island but keeps it. You can bring it back from the **Rejected** tab.
- **Delete** removes it forever.
- While you’re signed in, every note on the wall and on the island has its own **Hide / Delete** buttons, so you can clean up without opening the dashboard.
- Private notes (“organizers deliver it to Dani separately”) are **never** shown publicly, even if approved.
- Your sign-in lasts until you close or reload the tab. That’s a safety feature; just sign in again.

> **Want notes to appear instantly, without approval?** In Supabase → SQL Editor, run `supabase/optional-auto-approve.sql`. You can still Hide/Delete anything afterwards, and `supabase/optional-require-approval.sql` switches approval back on. For a big public Twitch community, **keeping approval on is safer**, especially if you show notes on stream.

## Part 5: Your own domain

23. **Buy a domain** from any registrar, e.g. **Cloudflare Registrar**, **Porkbun**, **Namecheap** or **Squarespace Domains**. In the steps below, `yourdomain.com` stands for whatever you buy.
24. **Tell GitHub about it.** Go to the repo’s **Settings → Pages**. Under **Custom domain**, type `yourdomain.com` and click **Save**. GitHub will say the DNS check is unsuccessful at first; that’s expected until step 25 is done.
25. **Point the domain at GitHub.** At your registrar, open the domain’s **DNS settings**. **Delete** any existing parking records for `@` and `www` (A, AAAA, CNAME or “URL forwarding”), then add these:
    | Type | Name / Host | Value / Points to |
    |---|---|---|
    | A | `@` | `185.199.108.153` |
    | A | `@` | `185.199.109.153` |
    | A | `@` | `185.199.110.153` |
    | A | `@` | `185.199.111.153` |
    | AAAA | `@` | `2606:50c0:8000::153` |
    | AAAA | `@` | `2606:50c0:8001::153` |
    | AAAA | `@` | `2606:50c0:8002::153` |
    | AAAA | `@` | `2606:50c0:8003::153` |
    | CNAME | `www` | `nickwinters1.github.io` |

    - Some registrars want the name blank instead of `@`.
    - On **Cloudflare**, set each record’s proxy to **DNS only** (grey cloud).
    - The four AAAA rows add IPv6; they’re recommended, but the A rows alone also work.
26. **Wait** for DNS to spread. It’s often 10–60 minutes and can take up to 24 hours. Refresh **Settings → Pages** until it says **DNS check successful**.
27. Tick **Enforce HTTPS**. If it’s greyed out, GitHub is still creating your security certificate; check back in a little while.
28. **Recommended: verify the domain** so nobody else can ever attach it to their GitHub site.
    1. Click your **profile picture → Settings → Pages** (in the *Code, planning, and automation* section), then **Add a domain**.
    2. Enter `yourdomain.com`. GitHub shows a **TXT** record.
    3. Add that TXT record at your registrar, then click **Verify**.
29. **Make link previews use your domain.** Go back to **Settings → Secrets and variables → Actions → Variables** and add:
    | Name | Value |
    |---|---|
    | `SITE_URL` | `https://yourdomain.com/` |

    Then **Actions → Deploy to GitHub Pages → Run workflow** once more.

🎉 Your island is now at **https://yourdomain.com**. The old github.io address redirects there automatically. The OBS overlay is at **https://yourdomain.com/obs-overlay.html** (see the README for the OBS steps).

## Part 6: Launch checklist

- [ ] The site says **Community edition** (not *Preview*) and shows **no example notes**.
- [ ] A test note from your phone shows up in **Pending**; approving it works; **Hide** and **Delete** work.
- [ ] You can sign in as organizer on your phone too.
- [ ] `https://yourdomain.com` loads with the 🔒 padlock.
- [ ] You decided: **surprise** (sealed until reveal day) or **open now**.
- [ ] Test notes are deleted.
- [ ] Share the link! (The README has a suggested community post.)

## Day to day

- **Approve new notes:** open `yourdomain.com/#organizer`, sign in, and check the **Pending** tab.
- **Remove a bad note:** **Hide** or **Delete**, either in the dashboard or right on the note while signed in.
- **Backups:** in the Organizer dashboard, click **Export all messages** now and then. Keep the file private; it includes private notes.
- **Keep the database awake:** Supabase’s free plan pauses a project after about a week with **no visits at all**. If the site ever says *“Island temporarily unavailable”*, sign in to Supabase and click **Restore project**. Visitors keep it awake, but check it a day before any big moment.
- **Change the finale letter or links:** on GitHub open `src/config.ts`, click the ✏️ pencil, edit, and click **Commit changes**. The site rebuilds itself in about a minute.
- **Rename the celebration** any time in the Organizer dashboard (no code needed).

## Troubleshooting

| Problem | Fix |
|---|---|
| The site still says **Preview** | The two variables went in **Secrets** instead of **Variables**, or you didn’t re-run the deploy (step 15). |
| **Island temporarily unavailable** | Wrong `VITE_SUPABASE_URL`, or the Supabase project is paused. Check the URL, or click **Restore project** in Supabase. |
| Organizer sign-in says **This account is not authorized** | Step 10 wasn’t run for that user, or the UID was pasted wrong. |
| Sign-in says **Invalid login credentials** | Wrong email or password. Reset it in Supabase → Authentication → Users. |
| Notes never show up | They’re waiting in **Pending** (approve them), or the surprise isn’t open yet (step 19). |
| **DNS check unsuccessful** for a long time | Re-check the records in step 25. Remove any old parking or forwarding records. Use **DNS only** on Cloudflare. |
| **Enforce HTTPS** is greyed out | The certificate is still being issued. Wait, then refresh Settings → Pages. |
