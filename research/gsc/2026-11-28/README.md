# Search Console export, 2026-11-28: not available

No export was possible. The Google service account configured for this environment
(`GOOGLE_CLIENT_EMAIL`) can only see one property, and it isn't this site.
Every query for this site returned HTTP 403 "User does not have sufficient permission":

- `sc-domain:calcultaxesquebec.ca`
- `https://www.calcultaxesquebec.ca/`
- `https://calcultaxesquebec.ca/`

**To fix:** in Search Console → Settings → Users and permissions, add the service-account
address from `GOOGLE_CLIENT_EMAIL` as a user ("Restricted" is enough to read data; "Owner"
is needed to request indexing through the API).

The "before" figures in `docs/fix-2026-11-28.md` are the Nov 1–27 numbers given in the
task brief, from the owner's own Search Console view. Nothing in them was re-derived here.
