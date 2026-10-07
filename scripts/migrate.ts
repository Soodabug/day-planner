// Applies the Drizzle migrations in ./drizzle that the database does not have yet.
// Runs before the server starts in production (see "start" in package.json),
// so a deploy never needs manual SQL. Running it again changes nothing.

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error('DATABASE_URL is missing (see .env.example).');
    process.exit(1);
}

const db = drizzle(databaseUrl);

await migrate(db, { migrationsFolder: './drizzle' });
console.log('Database is up to date');

// The connection pool would keep the process alive otherwise.
process.exit(0);
