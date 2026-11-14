# Dividend Tracker

A single-page web app for tracking dividend income, synced with Firebase Firestore.

**Live:** https://mubasheermk.github.io/dividend-tracker/

## Features

- Dashboard: income this year, last 12 months, projected annual income, top payers
- Payments log with search, sort, year filter and CSV export
- Holdings with yield on cost and projected income
- Dark and light themes, responsive layout
- Falls back to browser storage if Firestore is unreachable

## Setup

The app reads and writes two Firestore collections: `dividends` and `holdings`.
Create a Firestore database in the Firebase project and set rules that allow access to them.

Everything lives in `index.html`; there is no build step.
