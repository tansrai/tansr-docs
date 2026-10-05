---
title: 'Getting started: pick a path, run in 5 minutes'
description: 'tansr can be used six ways: the Node SDK, the CLI, a self-hosted session service, Android, iOS and HarmonyOS. This page helps you decide where to start and explains the account and credential model shared by all six.'
zone: docs
category: getting-started
related:
  - getting-started/sdk
  - getting-started/cli
  - getting-started/serve
  - getting-started/android
  - getting-started/harmony
  - security
sources:
  - tansr-cli:doc/11-用户手册.md
  - tansr-cli:packages/sdk/README.md
  - tansr-cli:packages/server/README.md
  - tansr-cli:doc/90-SDK技术手册.md
lastVerified: '2026-10-05'
---

tansr is an agent runtime: one kernel (query loop, tool scheduling, permission engine, context compaction) offered in several different forms. You do not need to learn all of them. Pick one path based on "where do I want the agent to run".

## First question: where does the agent run?

| Your situation | Recommended entry point | Article |
|---|---|---|
| I want to talk to an agent in my terminal, edit code, run scripts | the `tansr` CLI | [CLI in 5 minutes](/en/getting-started/cli/) |
| I am writing a Node.js / Electron program and want to embed the agent in my own process | `@tansr/sdk` | [Node SDK in 5 minutes](/en/getting-started/sdk/) |
| I want to offer an agent to my own mobile or web users and need a multi-user backend | the `@tansr/serve` self-hosted session service | [Session service in 5 minutes](/en/getting-started/serve/) |
| I am writing an Android app and the backend uses (or will use) `@tansr/serve` | Kotlin SDK `com.tansr.sdk` (0.4.0) | [Android and iOS in 5 minutes](/en/getting-started/android/) |
| I am writing an iOS / macOS app, backend as above | Swift binary package `tansr-ios-spm` (0.3.0) | the "Same on iOS" section of the same article |
| I am writing a native HarmonyOS app, backend as above | ArkTS HAR `@tansr/harmony` | [HarmonyOS SDK in 5 minutes](/en/getting-started/harmony/) |

Two rules of thumb:

- **Solo use: the CLI. Building for others: the SDK or the session service.** The CLI is for you as a developer; the SDK and the session service are for your product's users.
- **Mobile always goes through your own backend.** The Android / iOS / HarmonyOS SDKs are thin protocol clients that never hold any platform credential; the agent kernel runs inside the `@tansr/serve` you deploy. Devices that only run the Android-compatible HarmonyOS stack keep using the Android SDK.

## The account model shared by all six paths

Whichever path you take, credentials come in three layers, and the further down the list, the less they may ever leak:

1. **Personal access token (PAT)**: created by you in the console, used only by `tansr init` to sign the CLI in on your machine. It represents you.
2. **App key (appid / appkey)**: issued by you in the console for an "app". The appkey lives only on your backend (a Node process or `@tansr/serve`) and is used to mint short-lived tokens for your end users. **The appkey is never shipped to end-user devices, never logged, never committed.**
3. **Short-lived `app_user` token**: minted by your backend with the appkey and handed to the client (an Electron main process, or held internally by `@tansr/serve`). It expires; a leak is bounded by its TTL.

CLI users only need layer 1; SDK and session-service developers need layers 2 and 3. Placement and rotation advice is in [Security and privacy](/en/security/).

## Every getting-started article follows the same skeleton

The five form articles (Android and iOS share one; HarmonyOS has its own) unfold in the same order so you can compare forms side by side:

1. **Prerequisites**: runtime and version requirements (Node ≥ 22.19 is the common baseline).
2. **Install**: `npm i -g @tansr/cli`, `npm install @tansr/sdk`, `npm install @tansr/serve`, or the Maven / SwiftPM / independently published HAR coordinates.
3. **Credentials**: which credential layer this form needs and where to get it.
4. **First session**: the shortest runnable code.
5. **See the events**: everything the agent produces is an event stream (`msg.text.delta`, `tool.completed`, …); this step lets you see it with your own eyes.
6. **Next steps**: pointers to the in-depth guides.

## Runtime requirements at a glance

| Form | Minimum |
|---|---|
| CLI (npm package) | Node.js ≥ 22.19; Windows / macOS / Linux. The single-file executable (SEA) is not released yet; the npm package is currently the only form |
| `@tansr/sdk` | Node.js ≥ 22.19; Electron ≥ 39; ESM only; TypeScript target ≥ ES2022 |
| `@tansr/serve` | Node.js ≥ 22.19; the only third-party runtime dependency is `zod` |
| Android SDK | minSdk 26; Kotlin coroutines + kotlinx.serialization + OkHttp |
| iOS SDK | iOS 16+ / macOS 13+; SwiftPM |
| HarmonyOS SDK | HarmonyOS 6.0 / API 20; Stage model; independently published HAR `@tansr/harmony` 0.1.0 |

## Once it runs, what to read next

| You care about | Where to go |
|---|---|
| How sessions persist and how to recover after a disconnect | [Checkpoints and resume](/en/sdk/checkpoints/) (SDK) · [v2 protocol and webhooks](/en/serve/v2-and-webhooks/) (session service) |
| What capabilities the platform grants my app and how to toggle them in the console | [Platform assembly and the bundle](/en/sdk/platform-bundle/) |
| What an error code means and whether it is retryable | [Errors and retries](/en/sdk/errors-and-retries/) · [Error codes](/errors/codes) |
| How to deploy the backend, shut it down gracefully, shard across replicas | [Deployment and authentication](/en/serve/deploy-and-auth/) |
| I want to call the session service's HTTP surface (`/api`) directly, or write my own client | [Unified API (/api)](/en/unified-api/) |
| Which parts of the SDK 2.0 extension entry points (archive host, cache host, unified API) are officially released | [SDK 2.0 extension entry points](/en/sdk/sdk2-preview/) |
| How long sessions are kept and when they are reclaimed | [Retention and governance](/en/serve/retention-and-governance/) |
| Where the CLI config files live and how to read `tansr doctor` | [Settings and doctor](/en/cli/settings-and-doctor/) |
| Where data lives, how to rotate keys, where traffic goes | [Security and privacy](/en/security/) |

## If something goes wrong

- On the CLI, run `tansr doctor` first; it is a zero-network assembly self-check. How to read it: [Troubleshooting](/en/support/troubleshooting/).
- Every error carries a stable machine code; look it up in the [error codes table](/errors/codes).
- Account, key and plan questions: [Account and billing](/en/support/account/). Still stuck? [Contact support](/en/support/contact/).
