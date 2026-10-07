// Triggers the reminder job, the same way the external cron service does.
//
//   npm run reminders:send             send to everyone who is due right now
//   npm run reminders:send -- --force  send to everyone with reminders on (testing)
//
// API_URL can point at a deployed server; the default is the local one.

const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
const secret = process.env.CRON_SECRET;

if (!secret) {
    console.error('CRON_SECRET is missing. Add it to .env (see .env.example).');
    process.exit(1);
}

const force = process.argv.includes('--force');
const url = `${apiUrl}/jobs/send-reminders${force ? '?force=1' : ''}`;

const response = await fetch(url, {
    method: 'POST',
    headers: { 'X-Cron-Secret': secret },
});

console.log(response.status, await response.text());
process.exit(response.ok ? 0 : 1);

export {};
