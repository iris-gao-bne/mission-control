import { execSync } from "child_process";
import path from "path";

const TEST_DB_URL = "file:./prisma/test.db";

// Set before anything else so the Prisma client singleton picks it up
process.env.DATABASE_URL = TEST_DB_URL;
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

const root = path.resolve(__dirname, "../..");

// Pass the env explicitly to the child process so Prisma CLI never falls back
// to reading .env from disk and touching dev.db
execSync("npx prisma db push --force-reset", {
  cwd: root,
  stdio: "pipe",
  env: {
    ...process.env,
    DATABASE_URL: TEST_DB_URL,
  },
});
