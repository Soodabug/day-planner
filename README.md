# Day Planner

A daily planner I made to learn full-stack TypeScript. You write what you want to do today, tick things off, and set reminders that arrive as push notifications (also when the tab is closed).

Try it: https://day-planner-web.onrender.com

It runs on free hosting, so the first load can be slow while the server wakes up.

## What you can do

- Add tasks for today, tomorrow or another date. Works without an account, tasks stay in your browser.
- Sign up to have your tasks on every device. Tasks you already wrote come with you.
- Edit, mark done, undo, delete.
- Overdue tasks (not done, date before today) show up in red.
- Reminders with your own text, date and time. Once, or every day.
- Forgot your password? Reset it by email.

Tasks only have a date, no time. If I need a time I use a reminder.

## Stack

Backend: Node, Hono, PostgreSQL, Drizzle, Zod, JWT, web-push

Frontend (`web/` folder): React, TypeScript, Vite, Tailwind, Motion

## Running it

You need Node 22+ and a Postgres database.

```bash
# backend
npm install
cp .env.example .env     # fill in the values
npm run db:migrate
npm run dev              # localhost:3000

# frontend, second terminal
cd web
npm install
cp .env.example .env.development
npm run dev              # localhost:5174
```

Keep the frontend on port 5174, the API only allows the address set in `WEB_ORIGIN`.

## .env

Everything is listed in `.env.example`. Short version:

- `DATABASE_URL` - Postgres connection string
- `JWT_SECRET` - any long random string
- `WEB_ORIGIN` - where the frontend runs, e.g. `http://localhost:5174`
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` - for push, generate with `npx web-push generate-vapid-keys`
- `VAPID_SUBJECT` - a `mailto:` address
- `CRON_SECRET` - any long random string, protects the reminder job
- `BREVO_API_KEY` / `EMAIL_FROM` - only for password reset emails. If you leave them empty the reset link is printed in the server log, which is fine for local use.

## Reminders

The server checks every minute if a reminder is due and sends it as a push notification.

The problem with free hosting is that the server sleeps. So there is also `POST /jobs/send-reminders`, which does the same check. I call it every 5 minutes from cron-job.org with the header `X-Cron-Secret`, and that wakes the server up.

You can run it yourself too:

```bash
npm run reminders:send
npm run reminders:send -- --force    # send all of them now, for testing
```

## Database changes

Change `src/db/schema.ts`, then

```bash
npm run db:generate
npm run db:migrate
```

On the server `npm start` runs the migrations first.

## Deploy

Neon for the database, Render for the API and the frontend (see `render.yaml`), cron-job.org for the reminder job. All free.

Two things I got wrong the first time: `VITE_API_URL` on the frontend must be the API address (not the frontend one), and after changing it the frontend needs a new deploy.

## API

Example requests are in `request.http`. Errors always look like this:

```json
{ "error": { "code": "...", "message": "...", "details": "...", "requestId": "..." } }
```

## Things that are missing

- no tests
- reminders can't be edited, only deleted
- reminders can be a few minutes late
- on iPhone push only works if you add the site to the home screen
