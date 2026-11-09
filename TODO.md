# TODO

What's left, roughly in priority order. The backup, the dashboard and invite-only sign-in work today.

## Stock visibility

RRR's "Sandėlyje" column is not a quantity. Each part row is one physical item, and RRR's API has no quantity field. It was worked out by comparing RRR's list with our data:

- **"N prekės"** is how many parts are in stock with the same category and the same car model. This matched 24 of 26 rows in RRR's list, and any other grouping matched far fewer.
- **The € figure** is the average price of those parts, leaving out parts with no price. For example, 41,08 € is the average of 10,40, 13, 149, 20 and 13.

The two rows that didn't match, and a few € figures, are most likely prices or stock that changed after the reference screenshot was taken. Still to confirm: whether reserved parts are counted.

- [x] Add a "Sandėlyje" column showing the count and average price
- [x] Link each row to the matching parts
- [x] Show the matching parts on the part detail page
- [ ] Add an index if the grouped query slows down as stock grows
- [ ] Stock overview: total parts, total value, unpriced parts, models with the most stock

## List

- [ ] Column sorting (newest-first only for now)
- [x] Filters: status, price, manufacturer, model, car, part code and quality
- [ ] More filters from RRR's list: category, reservation, reservation date, created by, created date
- [ ] Add an index on price if the price filter slows down as stock grows
- [ ] Thumbnails: the list loads full-size photos, about 5 MB per page
- [ ] Save table settings per user, so they follow people across devices (a cookie for now)

## Missing columns

- [ ] **Pardavimo kaina, data, kanalas:** needs an orders sync from `/v2/get/orders`. Those records include customer names, addresses and phone numbers, so store only sale details.
- [ ] **Vieta (storage location):** removed for now, because the API only gives a code (`73` is "VAIRO KOLONĖLĖS A"). Bring it back with a list of codes and names from RRR or the team.
- [ ] **Sukūrė, Rezervavo:** RRR has no user list. Names for user IDs `9` and `1` are missing from `USER_NAMES` in `apps/web/src/lib/part-format.ts`.
- [ ] **Suderinama pagal regioną, Šaltinis:** not in the parts data the API gives us. Ask RRR whether they're available anywhere.
- [ ] **Veiksmai:** comes with phase 2, because the dashboard is read-only for now.

## Pages

- [x] Cars list with Likutis and Parduota counts, filters and search (by ID, car or VIN)
- [x] Car detail page
- [ ] Column settings for the cars table
- [ ] Copy car photos to R2: they still load from Ovoko's car image server, and only 331 of 819 cars have any
- [ ] Car columns and filters RRR shows but the API doesn't provide: purchase date, dismantling date, status (also its filter), created by
- [x] Sidebar navigation like RRR's
- [ ] "Last synced" time, so people can see how fresh the data is
- [ ] Check our totals per status against RRR's

## Sign-in and access

Invite-only sign-in with emailed codes, built to replace Cloudflare Access.

- [x] Resend: `deremika.lt` added as a sending domain, with its DNS records in Cloudflare
- [x] Worker secrets: `BETTER_AUTH_SECRET` and `RESEND_API_KEY`
- [x] Admin Users page: invite, resend, remove
- [x] Non-admins don't see reservations or parts without a price
- [ ] Deploy, sign in as the first admin, and invite the team
- [ ] Once sign-in works on `stock.deremika.lt`, remove Cloudflare Access from it, then retire `app.vidasstirbys.com`
- [ ] A customer role for outside guests: in-stock parts only, without internal notes, creator or car statistics
- [ ] Change someone's role from the Users page (only at invite time now)
- [ ] After sign-in, return to the page that was asked for instead of always the parts list
- [ ] A PNG logo in the emails (only text now: SVG doesn't show in Gmail)

## Security

- [ ] Redeploy with `pnpm web:deploy`: earlier deploys carried the root `.env` values inside the Worker
- [ ] Rotate the RRR password, and when convenient the database password, R2 keys and RRR token
- [ ] Revoke the GitHub token left as a comment in `.env`

## Infrastructure

- [ ] Ask RRR support for a higher image limit or a bulk photo export, and whether photos may be reused on other marketplaces
- [ ] Turn off the `r2.dev` address now that `images.vidasstirbys.com` works
- [ ] Renew the scheduler's GitHub token before it expires. All scheduled jobs stop when it does.
- [ ] Upgrade Supabase before phase 2, for daily backups
- [ ] Move the jobs off GitHub Actions to a small server before phase 2

## On hold

- [ ] Edit stock from the dashboard and push changes to RRR
- [ ] List parts on several marketplaces, with our database as the source of truth
