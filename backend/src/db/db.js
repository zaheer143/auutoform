import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("❌ DATABASE_URL is missing");
}

export const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("railway")
    ? { rejectUnauthorized: false }
    : undefined
});

db.on("error", (err) => {
  console.error("Postgres pool error:", err);
});
