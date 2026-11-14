# Dividend Tracker

A single-page web app for tracking dividend income, synced with Firebase Firestore.

**Live:** https://mubasheermk.github.io/dividend-tracker/

## Features

- Dashboard: income this year, last 12 months, projected annual income, top payers
- Payments log with search, sort, year filter and CSV export
- Holdings with yield on cost and projected income
- Dark and light themes, responsive layout
- Google sign-in; data is private per account
- Falls back to browser storage if Firestore is unreachable

## Setup

Sign-in is with Google. Each user's data lives under `users/{uid}/dividends` and `users/{uid}/holdings`.

1. Firebase console → Authentication → Sign-in method: enable Google.
2. Authentication → Settings → Authorized domains: add `mubasheermk.github.io`.
3. Firestore Database → Rules: publish

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```

Everything lives in `index.html`; there is no build step.
