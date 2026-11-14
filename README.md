# Dividend Tracker

A single-page web app for tracking dividend income, synced with Firebase Firestore.

**Live:** https://mubasheermk.github.io/dividend-tracker/

## Features

- **Dashboard:** portfolio value and gains, income this year, projected annual income with a goal, next payout, income and forecast charts, allocation by holding or sector
- **Portfolio:** holdings with buy/sell transactions, average cost, gains, yield and yield on cost; multiple portfolios with a filter
- **Dividends:** payment log, income-by-month table with yearly growth, CSV import and export
- **Calendar:** paid and expected dividends, ex-dividend dates and earnings, with `.ics` export
- **Watchlist:** live prices and target-price alerts shown in the app
- **Market:** news for your holdings, earnings dates and upcoming IPOs
- Google sign-in; data is private per account
- Dark and light themes, responsive layout

Live prices, earnings, news and IPOs need a free [Finnhub](https://finnhub.io) API key, entered in Settings.
It is stored in the signed-in user's Firestore settings, not in this repo. Without a key the app uses prices you enter.

## Setup

Sign-in is with Google. Each user's data lives under `users/{uid}/` (dividends, holdings, transactions, watchlist, settings, snapshots).

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
