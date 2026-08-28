import express, { type Express } from "express";
import cors from "cors";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pinoHttp from "pino-http";
import { clerkMiddleware } from "@clerk/express";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import { logger } from "./lib/logger";
import { pool } from "@workspace/db";

const PgSession = connectPgSimple(session);

const app: Express = express();

// Required so express-rate-limit can read X-Forwarded-For correctly behind Replit's proxy.
app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Clerk proxy MUST come before body parsers (streams raw bytes)
app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

// Restrict CORS to the known frontend origins.
// CORS_ORIGIN env var can be a comma-separated list for production.
// Falls back to the Replit dev domain when available, or localhost.
function buildAllowedOrigins(): string[] | RegExp {
  if (process.env.CORS_ORIGIN) {
    return process.env.CORS_ORIGIN.split(",").map((o) => o.trim());
  }
  if (process.env.REPLIT_DEV_DOMAIN) {
    return [
      `https://${process.env.REPLIT_DEV_DOMAIN}`,
      // Also allow the exact proxy origin in local dev
      "http://localhost:80",
      "http://127.0.0.1:80",
    ];
  }
  return ["http://localhost:80", "http://127.0.0.1:80"];
}

app.use(
  cors({
    origin: buildAllowedOrigins(),
    credentials: true,
  }),
);

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET environment variable is required");
}

// connect-pg-simple's createTableIfMissing reads a SQL file from the package
// directory which is unavailable after esbuild bundling. We create the table
// ourselves with a raw query and keep createTableIfMissing: false.
export async function ensureSessionTable(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "user_sessions" (
      "sid"    varchar        NOT NULL COLLATE "default",
      "sess"   json           NOT NULL,
      "expire" timestamp(6)   NOT NULL,
      CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    );
    CREATE INDEX IF NOT EXISTS "IDX_user_sessions_expire" ON "user_sessions" ("expire");
  `);
}

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "user_sessions",
      createTableIfMissing: false, // we handle this in ensureSessionTable()
    }),
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 8 * 60 * 60 * 1000, // 8 hours
    },
  }),
);

// Keep malformed or unexpectedly large requests from consuming unbounded
// memory. The API only accepts small JSON/form payloads; uploads go directly to
// object storage via signed URLs.
app.use(express.json({ limit: "256kb" }));
app.use(express.urlencoded({ extended: true, limit: "256kb" }));

// Clerk auth middleware — after body parsers, before routes. The app uses the
// owner's external Clerk instance, so use its key directly rather than
// deriving a Replit custom-domain key from the incoming host.
app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
  }),
);

app.use("/api", router);

export default app;
