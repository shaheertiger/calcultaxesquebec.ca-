# Bing Webmaster export, 2026-11-28: not available

The Bing API key configured for this environment (`BINGAPIKEY2`) belongs to an account
that doesn't list this site. `GetUserSites` returns four other sites, and `GetPageStats` for
`https://www.calcultaxesquebec.ca/` and `https://calcultaxesquebec.ca/` returns
`{"ErrorCode":14,"Message":"ERROR!!! NotAuthorized"}`.

**To fix:** add and verify the site under the account that owns `BINGAPIKEY2`, or
share the site with that account in Bing Webmaster Tools → Settings → User management.
IndexNow is unaffected: it is verified by the key file at
`/74d5a7f9a4cb4affadf38a391aa7dcff.txt`, not by the API key.
