# Filenest

Your files, safely nested. Filenest is a full-stack cloud drive: upload files, organise them in nested folders, preview them in the browser, share public links and restore anything from the trash.

## Tech stack

| Part | Tech |
|---|---|
| Client | React 19, Vite, Tailwind CSS 4, React Router, Axios |
| API | Node.js, Express 5, JWT auth in an httpOnly cookie, Multer |
| Database | Neon Postgres |
| File storage | Any S3-compatible bucket (AWS S3, Cloudflare R2, ...) |

## Getting started

### Prerequisites

- Node.js 20+
- Either **Docker** (runs Postgres and an S3-compatible server locally, no accounts needed)
- Or a [Neon](https://console.neon.tech) Postgres database plus an S3-compatible bucket (Cloudflare R2, AWS S3)

### Install

```bash
git clone https://github.com/Yusuf-Hussain25/filenest.git
cd filenest
npm install && npm run install:all
```

### Configure

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Fill in `server/.env`. Every key is explained in the file:

| Key | Where to find it |
|---|---|
| `DATABASE_URL` | Neon → your project → **Connect** → connection string |
| `JWT_SECRET` | Any long random string (`openssl rand -hex 32`) |
| `AWS_*` | Your bucket's S3 endpoint, access key ID, secret key, region and bucket name |
| `ORIGINS` | Browser origins allowed to call the API |

`client/.env` only needs `VITE_BASE_URL`, the URL of the API.

The defaults in `server/.env.example` already point at the local Docker services, so for local development you only need to set `JWT_SECRET`.

### Run

```bash
npm run services   # Docker: Postgres on :5435 + S3 (RustFS) on :9000, creates the bucket
npm run dev        # API on http://localhost:3000, web app on http://localhost:5173
```

The API creates its tables on first start.

## Author

**Yusuf Hussain** · [github.com/Yusuf-Hussain25](https://github.com/Yusuf-Hussain25)

## Security checks

With the API running, `npm run test:security` creates two throwaway accounts and runs 68 checks: logged-out visitors are refused, users can only reach their own files, folders, links and trash, public links expose only what they should, and storage quotas hold. It deletes everything it created when it finishes.

## Demo data

Set `DEMO_EMAIL`, `DEMO_PASSWORD` and `SEED_PASSWORD` in `server/.env`, start the API, then:

```bash
npm run seed                          # demo account + two other accounts
npm run seed -- --with you@email.com  # also fill your own account
```

Set `VITE_DEMO_EMAIL` in `client/.env` to show "Explore with a demo account" on the login page.
