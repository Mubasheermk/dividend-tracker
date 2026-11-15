# Dividend Tracker

A single-page web app for tracking dividend income, synced with Firebase Firestore.

**Live:** https://mubasheermk.github.io/dividend-tracker/

## Features

- **Dashboard:** portfolio value and gains, income this year, projected annual income with a goal, next payout, income and forecast charts, allocation by holding or sector
- **Portfolio:** holdings with buy/sell transactions, average cost, gains, yield and yield on cost; multiple portfolios with a filter
- **Dividends:** payment log, income-by-month table with yearly growth, CSV import and export; reinvested dividends (DRIP) add a buy transaction
- **Broker import:** reads position and activity CSV exports (tested with Fidelity, Schwab and Robinhood style files); re-importing doesn't duplicate
- **Tax view:** tax withheld per payment, a yearly summary by portfolio, and a downloadable report
- **Mark as paid:** expected dividends that have come due can be confirmed or skipped in one click
- **Backup:** download everything as one JSON file and restore it (merge or replace); API keys are not included
- **Calendar:** paid and expected dividends, ex-dividend dates and earnings, with `.ics` export
- **Insights:** expected income by calendar month with thin months flagged, dividend health per holding (change vs a year ago, 5-year growth, payout ratio), and a 20-year income projection
- **Watchlist:** live prices and target-price alerts shown in the app
- **Market:** news for your holdings, earnings dates and upcoming IPOs
- Google sign-in; data is private per account
- Dark and light themes, responsive layout

Live prices, earnings, news and IPOs need a free [Finnhub](https://finnhub.io) API key, entered in Settings.
It is stored in the signed-in user's Firestore settings, not in this repo. Without a key the app uses prices you enter.

Dividend amounts and dates can be filled in automatically with a free [Massive](https://massive.com) API key, also entered in Settings.

## Setup

Sign-in is with Google. Each user's data lives under `users/{uid}/` (dividends, holdings, transactions, watchlist, settings, snapshots).

1. Firebase console → Authentication → Sign-in method: enable Google.
2. Authentication → Settings → Authorized domains: add `mubasheermk.github.io`.
3. Firestore Database → Rules: publish the contents of [`firestore.rules`](firestore.rules). They limit each user to their own data and check every field that is written.

The app is plain HTML, CSS and JavaScript (`index.html`, `styles.css`, `app.js`); there is no build step.
