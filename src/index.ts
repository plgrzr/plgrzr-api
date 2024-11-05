import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth } from "./lib/auth.js";
import { cors } from "hono/cors";
import { MathpixService } from "./services/mathpixService.js";
import { TextConverter } from "./services/textConverter.js";

const app = new Hono<{
  Variables: {
    user: any;
    session: any;
  };
}>();

const APP_ID = process.env.APP_ID || "";
const API_KEY = process.env.API_KEY || "";

const mathpixService = new MathpixService(APP_ID, API_KEY);

app.use(
  "*",
  cors({
    origin: ["http://localhost:3000", "https://plgrzr.suryavirkapur.com"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["POST", "GET", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
    credentials: true,
  })
);

app.use("*", async (c, next) => {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

app.get("/api/auth/*", (c) => auth.handler(c.req.raw));
app.post("/api/auth/*", (c) => auth.handler(c.req.raw));

app.post("/process-pdf", async (c) => {
  const message = c.get("session");
  console.log(message);
  if (!message) return c.json({ error: "Unauthorized" }, 401);

  const formData = await c.req.formData();

  const file = formData.get("file") as File;

  if (!file || !file.name.endsWith(".pdf")) {
    return c.json({ error: "Only PDF files are allowed" }, 400);
  }

  try {
    const fileBuffer = await file.arrayBuffer();
    const result = await mathpixService.processPdf(fileBuffer);
    const processedResult = new TextConverter(result).convertPagewise();

    return c.json(JSON.parse(processedResult));
  } catch (error) {
    if (error instanceof Error) {
      return c.json({ error: error.message }, 500);
    }
    return c.json({ error: "An unknown error occurred" }, 500);
  }
});

app.get("/health", (c) => {
  return c.json({ status: "healthy" });
});

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

const port = 3001;
console.log(`Server is running on http://localhost:${port}`);

serve({
  fetch: app.fetch,
  port,
});
