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
- A [Neon](https://console.neon.tech) Postgres database
- An S3-compatible bucket and access keys

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

### Run

```bash
npm run dev   # API on http://localhost:3000, web app on http://localhost:5173
```

The API creates its tables on first start.

## Author

**Yusuf Hussain** · [github.com/Yusuf-Hussain25](https://github.com/Yusuf-Hussain25)
