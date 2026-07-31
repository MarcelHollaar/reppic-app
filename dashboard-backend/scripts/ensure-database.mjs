/**
 * Creates the target database from DATABASE_URL if it does not exist yet.
 * Connects to the default "postgres" database to run CREATE DATABASE.
 * Safe to run on every container start (existing volumes, fresh deploys).
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

function adminConnectionString(url) {
  const normalized = url.replace(/^postgresql:\/\//, "http://");
  const parsed = new URL(normalized);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\//, "").split("/")[0] || "");
  if (!dbName) {
    throw new Error("No database name found in DATABASE_URL");
  }
  parsed.pathname = "/postgres";
  return {
    dbName,
    adminUrl: parsed.toString().replace(/^http:\/\//, "postgresql://"),
  };
}

const { dbName, adminUrl } = adminConnectionString(connectionString);
const client = new pg.Client({ connectionString: adminUrl });

try {
  await client.connect();
  const { rowCount } = await client.query(
    "SELECT 1 FROM pg_database WHERE datname = $1",
    [dbName],
  );

  if (rowCount === 0) {
    // dbName comes from our own DATABASE_URL config, not user input.
    await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
    console.log(`Created database: ${dbName}`);
  } else {
    console.log(`Database already exists: ${dbName}`);
  }
} finally {
  await client.end();
}
