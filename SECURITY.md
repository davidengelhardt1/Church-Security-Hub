# Security Policy

## Reporting a vulnerability

Please report security problems privately. Do not open a public issue.

Use GitHub's **Report a vulnerability** button on this repository's Security tab.
Include what you found, how to reproduce it, and the impact you think it has.

I will acknowledge your report within 7 days and keep you updated until it is fixed.

## Scope

In scope: the code in this repository, the deployed site at
https://church-security-hub.vercel.app, and the database access rules in `supabase/`.

Out of scope: Vercel, Supabase, GitHub and the news sources themselves (report those
to the vendor), denial-of-service testing, and automated scanning that generates heavy
traffic.

## Supported versions

Only the latest version on `main` is supported.

## Notes for reporters

The Supabase URL and the publishable (anon) key may appear in the browser. That is
expected: row-level security decides what any visitor can read or write. A report that
only says those values are visible is not a vulnerability.
