import { execSync } from "child_process";
import path from "path";

// Point all tests at an isolated test database
process.env.DATABASE_URL = "file:./prisma/test.db";
process.env.JWT_SECRET = "test-secret";
process.env.NODE_ENV = "test";

// Drop and recreate schema before the test run
execSync("npx prisma db push --force-reset", {
  cwd: path.resolve(__dirname, "../.."),
  stdio: "pipe",
});
