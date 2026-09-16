---
title: Account, keys, plans and billing
description: 'Sign-in methods, personal access tokens and device keys, app keys, organizations and members, plan tiers and how concurrency is counted, balance top-ups, bills and invoices, email notifications and account deletion — Q&A limited to what the console offers today.'
zone: support
category: support
related:
  - support
  - support/troubleshooting
  - support/contact
  - security
  - getting-started/cli
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:doc/90-SDK技术手册.md
  - tansr-api:openapi/openapi.json
lastVerified: '2026-09-09'
---

This page answers the most common account-side questions. Anything that requires an "action" is done in the console; the CLI only signs this machine in and shows status.

## Sign-in and account

**Which sign-in methods does the console support?** Email verification code, SMS verification code, WeChat; an organization can additionally configure an SSO identity source for its members. The CLI itself does not sign in — it initializes with a personal access token (PAT) you create in the console.

**What is the account email used for?** The platform sends four kinds of email: approval to-dos and results, organization invitations, low-balance warnings (at most one per account per day), and new-app-key notifications (including how it was derived, never the key itself). Without an email on file these are silently skipped; nothing else is affected.

**Can one person belong to several organizations?** Yes. A personal account can create or join organizations; an organization has members, invitations, teams and governance policies; plans are attached to an account (personal or organization).

**How do I delete my account?** The console offers an anonymization flow (a challenge to confirm first, then execution). Settle any remaining balance and open bills before you do.

## Personal access tokens (PAT) and device keys

**Where do I create a PAT and what is it for?** On the console "API keys" page; it is shown once, copy it immediately. Its single purpose is `tansr init`, signing the CLI in on your machine (masked input, or the `TANSR_PAT` environment variable in CI). A PAT represents you personally.

**What happens after `tansr init`?** The wizard verifies the PAT → derives an app key for **this device** (named `cli:<hostname>:<device id>`) → writes it to the OS keychain → shows a summary card (account fingerprint, balance, recent usage, number of available models, derived-key expiry). From then on `tansr` just works; the model list and price list are pushed by the platform.

**I lost my PAT / I suspect it leaked.** Delete or deactivate that PAT in the console (two levels: recoverable and permanent), create a new one, and sign each device in again with `tansr init --fresh`.

**Do device keys expire?** Yes. Near expiry the session shows a "key about to expire" notice; running `tansr init` again rotates and extends it. For a device you no longer use, deactivate its device key in the console, or run `tansr logout` on that device. `tansr logout` **does not revoke the PAT**.

**Will several computers with the same hostname overwrite each other?** No. Every device has an 8-character random device id in its key name; cloned VMs and a company-wide image each keep their own key.

**The summary card says the credential fell back to a plaintext file.** The OS keychain is unavailable on this machine (common on Linux without a desktop session, or in containers), so the credential was written to a file with mode 0600. The credential-storage section of `tansr doctor` keeps attributing it; fix the keychain if you can, otherwise make sure no other user can read that directory.

## Apps and app keys (developers)

**How is an app key different from a PAT?** An app key (appid / appkey) represents your **app**. You issue it on the console "Apps" page, keep it only on your backend, and use it to mint short-lived tokens for your end users; end users do not need a tansr account. A PAT represents you personally and is only for the CLI.

**Which app type should I choose?** Desktop app (Electron and the like) / mobile app (Android / iOS / HarmonyOS, through the session service) / server app. One app per platform: several clients, several appids, so revocation and usage attribution stay separate.

**My appkey leaked.** Rotate it on the console "Apps" page, update the server's environment variable and restart; the old appkey is invalidated at once. You can also revoke a specific end user's existing tokens, or deactivate the whole app. An app can also be given an IP allowlist (requests from outside it get `app_ip_denied`).

**Newly issued app keys require request signing?** Yes, enforced by default; your mint endpoint must send the three headers `x-tansr-ts` / `x-tansr-nonce` / `x-tansr-sign`, and unsigned requests always get `401 signature_invalid`. The official sample `examples/token-server` has a ready-to-use implementation.

## Plans and concurrency

**Are capabilities tiered?** No. Adjudicator, memory, context schemes, media, MCP and organization governance are the same product across all tiers; tiers differ only in concurrency, number of apps, number of members, model pricing and service. What you build during the Trial tier needs zero changes when you upgrade.

| Tier | Who it is for | Concurrency cap | Apps | Model pricing |
|---|---|---|---|---|
| Personal | Individual users, CLI only | Not tiered | 0 (creating an app moves you to Trial) | List price |
| Trial | Integration testing, companies getting started | 10 | 3 | List price; the whole plan fee is converted to model balance |
| Small | Independent software makers | 100 | 10 | List price |
| Medium | Entry-level companies | 1,000 | 32 | Negotiated price |
| Large | Flagship companies | 10,000 | 100 | Negotiated price; dedicated upstream optional |

Prices, monthly / yearly options and the purchase entry point are whatever the console "Plans" page says.

**How is concurrency counted?** The peak number of **sessions active within a 5-minute heartbeat window** under the account (personal / organization): CLI member sessions and your SDK / session-service end-user sessions are counted together, de-duplicated by session id within the account. The hard cap is tier × 1.1 (a 10% jitter allowance); the 80% and 100% watermarks each trigger one platform alert per day.

**What happens when I hit the cap?** The platform returns `429 plan_concurrency_exceeded` with `Retry-After: 30`. **Only new sessions are rejected; existing sessions are not cut off.** The CLI TUI shows a banner with a link to the plans page and does not retry automatically — send again by hand after 30 seconds. In the session-service form, end users only see "try again later"; the quota fact goes to your server logs.

**What other caps does the Trial tier have?** 100 distinct end users per month (the token-minting path only); exceeding it gives `plan_end_users_exceeded`. When the number of apps or organization members reaches the tier limit, only creation is blocked; existing ones keep working.

**What happens at expiry?** A 14-day grace period; afterwards you fall back to the Trial tier limits and apps do not disappear. The plan line in `tansr doctor` shows one of three states: active / expired but in grace period / fallen back to Trial limits (with the original tier name). The console shows plan, quote and plan usage, and also supports redeeming a card code.

**Why does doctor say "no plan fee" for the Personal tier?** Personal CLI use has no plan fee; models are charged at list price from your balance. This line is not a fault and does not count as a blocking issue.

## Balance, bills and invoices

**How do I top up?** Place an order on the console "Balance" page (the orders page shows past order status). When the balance is zero or unavailable, the `tansr init` summary card warns and points to a first top-up; it does not block.

**How am I warned when the balance is low?** The balance segment of the TUI status bar turns into a persistent warning below 1 yuan; the console shows a banner at the warning threshold; with an email on file you get a warning email (at most one per day). Once the balance is exhausted, platform model calls are rejected by the server-side billing gate (`insufficient_balance`); local features are unaffected.

**Where do I see usage and bills?** The console usage page (broken down per app / per member) and the monthly bills page; `/cost` and `/usage` in the CLI cover the current session. Developers reconcile per end user with `GET /v1/app-usage/by-end-user` (includes amounts); end users checking themselves via `GET /v1/my-usage` never see amount fields.

**How do I get an invoice?** Fill in your invoicing details in the console (the invoice header page), then request an invoice against a bill.

**Can a plan be refunded?** Eligibility conditions apply; if they are not met the response is `refund_not_eligible`, and the console message is authoritative.

## Still not working

- Sign-in / key problems: run `tansr doctor` first and take a screenshot or copy of the credential-storage and `localProviders` sections (they contain no key values).
- Billing problems: have your account fingerprint ready (as shown on the `tansr init` summary card, not the PAT itself), plus the order number or billing month.
- Then [contact support](/en/support/contact/).
