# Day Planner

A small daily planner I built to practice full-stack TypeScript. You open it, write what you want to do today, and tick things off. It also sends reminders as push notifications, so they reach you when the tab is closed.

Live version: https://day-planner-web.onrender.com

The backend runs on a free plan and goes to sleep when nobody uses it, so the first request can take up to a minute.

## What it does

- Write tasks for today, tomorrow or any other date. No account needed, tasks are kept in the browser.
- Sign up to keep your tasks on every device. Tasks you wrote before signing up are moved to your account.
- Edit a task, mark it done, undo that, delete it.
- A task is overdue when it is not done and its date is before today. Overdue tasks are shown in red.
- Reminders with your own text, date and time. A reminder fires once, or every day if you tick "Repeat every day".
- Password reset by email. Resetting logs the account out on all devices.

Tasks only have a date. If you need a time, that is what reminders are for.

## Built with

**Backend** (root folder): Node.js, Hono, PostgreSQL with Drizzle ORM, Zod for validation, JWT for login, web-push for notifications.

**Frontend** (`web/`): React, TypeScript, Vite, Tailwind CSS, Motion for the animations.

## Run it locally

You need Node 22 or newer and a PostgreSQL database.

Backend:

```bash
npm install
cp .env.example .env      # then fill in the values, see below
npm run db:migrate        # creates the tables
npm run dev               # http://localhost:3000
```

Frontend, in a second terminal:

```bash
cd web
npm install
cp .env.example .env.development
npm run dev               # http://localhost:5174
```

The frontend port is fixed to 5174 because the API only accepts requests from the address in `WEB_ORIGIN`.

## Environment variables

All of them are listed in `.env.example`.

| Name | What it is |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Long random string used to sign login tokens |
| `WEB_ORIGIN` | Address of the frontend, for example `http://localhost:5174` |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Key pair for web push. Create one with `npx web-push generate-vapid-keys` |
| `VAPID_SUBJECT` | `mailto:` address the push services can contact |
| `CRON_SECRET` | Long random string that protects the reminder job |
| `BREVO_API_KEY`, `EMAIL_FROM` | Optional. Needed to send password reset emails through Brevo |

Without the two Brevo values the reset link is printed in the server log instead of being emailed. That is enough for local development.

The frontend has one variable, `VITE_API_URL`, which is the address of the API.

## How reminders are sent

The browser subscribes to push notifications the first time you add a reminder, not on page load. The server stores that subscription and sends the notification when the reminder is due.

Two things trigger the sending:

1. While the server is awake it checks every minute.
2. `POST /jobs/send-reminders` does the same check on request. It needs the header `X-Cron-Secret` with the value of `CRON_SECRET`. On free hosting the server sleeps, so I let an external cron service call this every five minutes to wake it up.

To trigger it by hand:

```bash
npm run reminders:send              # sends what is due right now
npm run reminders:send -- --force   # sends every reminder, for testing
```

Each reminder is claimed in the database before it is sent, so it cannot go out twice when both triggers run at the same moment.

## API

Every error has the same shape:

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Invalid request", "details": [], "requestId": "..." } }
```

| Method | Path | Login | What it does |
| --- | --- | --- | --- |
| POST | `/auth/signup` | no | Create an account, returns a token |
| POST | `/auth/login` | no | Returns a token |
| POST | `/auth/forgot-password` | no | Sends a reset link if the account exists |
| POST | `/auth/reset-password` | no | Sets a new password with the token from the link |
| GET | `/tasks` | yes | List my tasks |
| POST | `/tasks` | yes | Create a task (`title`, `date`) |
| PUT | `/tasks/:id` | yes | Change `title`, `date` or `done`. Without a body it marks the task done |
| DELETE | `/tasks/:id` | yes | Delete a task |
| GET | `/reminders` | yes | List my reminders |
| POST | `/reminders` | yes | Create a reminder (`text`, `date`, `time`, `repeatDaily`, `timezone`) |
| DELETE | `/reminders/:id` | yes | Delete a reminder |
| GET | `/push/public-key` | no | Public key the browser needs to subscribe |
| POST | `/push/subscriptions` | yes | Save this device |
| DELETE | `/push/subscriptions` | yes | Forget this device |
| POST | `/push/test` | yes | Send a test notification to my devices |
| POST | `/jobs/send-reminders` | secret header | Send due reminders |

Send the token as `Authorization: Bearer <token>`. `request.http` has example requests.

## Project layout

```
src/            API: routes (index.ts), auth, push, email, validation
src/db/         Drizzle schema and database client
drizzle/        generated SQL migrations
scripts/        migrate on start, trigger the reminder job
web/src/        React app
web/src/api.ts  the only file that talks to the server
web/public/     service worker (sw.js)
render.yaml     deployment setup for Render
```

## Changing the database

Edit `src/db/schema.ts`, then:

```bash
npm run db:generate   # writes a new migration into drizzle/
npm run db:migrate    # applies it
```

In production `npm start` applies pending migrations before the server starts.

## Deployment

I host it for free with three services:

- **Neon** for PostgreSQL
- **Render** for the API and the static frontend. `render.yaml` describes both, the secret values are entered in the Render dashboard
- **cron-job.org** to call `/jobs/send-reminders` every five minutes

After the first deploy, set `WEB_ORIGIN` on the API to the frontend address and `VITE_API_URL` on the frontend to the API address, without a slash at the end. The frontend has to be rebuilt after changing `VITE_API_URL`.

## Known limits

- Reminders can arrive a few minutes late, depending on the cron interval and how long the server takes to wake up.
- The notification sound is the one of your operating system. A website cannot choose its own sound while it is closed.
- On iPhone, push only works after adding the site to the Home Screen.
- Reminders cannot be edited yet. Delete it and add a new one.
- No tests yet.
