import { createDb, loadRootEnv } from "@drum-tutor/db";
import { buildApp } from "./app";
import { loadEnv } from "./env";

loadRootEnv();
const env = loadEnv();
const { db, close } = createDb(env.DATABASE_URL);
const app = await buildApp({
  db,
  cookieSecret: env.COOKIE_SECRET,
  isProduction: env.NODE_ENV === "production",
  logger: true,
});

const shutdown = async () => {
  await app.close();
  await close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

await app.listen({ port: env.API_PORT, host: "127.0.0.1" });
