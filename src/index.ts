import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { auth } from "./lib/auth.js";
import { cors } from "hono/cors";
import { MathpixService } from "./services/mathpixService.js";
import { TextConverter } from "./services/textConverter.js";
import { z } from "zod";
import { fromBuffer } from "pdf2pic";
import { existsSync, mkdir, writeFileSync } from "node:fs";
import { compareDocumentPair } from "./lib/compareDocumentPair.js";
import { generateUniquePairs } from "./lib/generateUniquePairs.js";

const app = new Hono<{
	Variables: {
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		user: any;
		// biome-ignore lint/suspicious/noExplicitAny: <explanation>
		session: any;
	};
}>();

const requestSchema = z.object({
	files: z.array(z.instanceof(File)).min(2),
	weightText: z.number().default(0.5),
});

const APP_ID = process.env.APP_ID || "";
const API_KEY = process.env.API_KEY || "";

const mathpixService = new MathpixService(APP_ID, API_KEY);
const options = {
	origin: ["http://localhost:3000", "https://plgrzr.suryavirkapur.com", "https://plgrzr-web.pages.dev"], // replace with your origin
	allowHeaders: ["Content-Type", "Authorization"],
	allowMethods: ["POST", "GET", "OPTIONS"],
	exposeHeaders: ["Content-Length"],
	maxAge: 600,
	credentials: true,
};
app.use("*", cors(options));

app.get("/api/auth/*", (c) => auth.handler(c.req.raw));
app.post("/api/auth/*", (c) => auth.handler(c.req.raw));

app.post("/process-pdf", async (c) => {
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

app.post("/pdf2img", async (c) => {
	const formData = await c.req.formData();
	const file = formData.get("file") as File;

	if (!file || !file.name.endsWith(".pdf")) {
		return c.json({ error: "Only PDF files are allowed" }, 400);
	}

	try {
		// Create images directory if it doesn't exist
		const imagesDir = "./images";
		if (!existsSync(imagesDir)) {
			await mkdir(imagesDir, { recursive: true }, () => { });
		}

		const fileBuffer = (await file.bytes()).buffer;
		const buffer = Buffer.from(fileBuffer);
		const options = {
			density: 100,
			saveFilename: "untitled",
			savePath: "./images",
			format: "png",
			width: 600,
			height: 800,
		};

		const convert = fromBuffer(buffer, options);
		const pageToConvertAsImage = 1;

		const imageResult = await convert(pageToConvertAsImage, {
			responseType: "image",
		});

		// Set appropriate headers for image response
		c.header("Content-Type", "image/png");
		return c.json({ finished: true });
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

app.post("/compare-multiple", async (c) => {
	try {
		const formData = await c.req.parseBody();
		const files = Array.from(Object.values(formData)).filter(
			(file) => file instanceof File,
		) as File[];
		const weightText = 0.5;

		// Validate request
		const validated = requestSchema.parse({ files, weightText });

		// Generate unique pairs
		const pairs = generateUniquePairs(validated.files);

		// Compare all pairs
		const comparisons = await Promise.all(
			pairs.map(([file1, file2]) =>
				compareDocumentPair(file1, file2, validated.weightText)
					.then((result) => ({
						file1: file1.name,
						file2: file2.name,
						result,
					}))
					.catch((error) => ({
						file1: file1.name,
						file2: file2.name,
						error: error.message,
					})),
			),
		);

		const res = {
			total_comparisons: pairs.length,
			comparisons,
		};
		writeFileSync("comparisons.json", JSON.stringify(res));
		return c.json(res);
	} catch (error) {
		return c.json(
			{
				error:
					error instanceof Error ? error.message : "Unknown error occurred",
			},
			400,
		);
	}
});

const port = 3001;
console.log(`Server is running on http://localhost:${port}`);

serve({
	fetch: app.fetch,
	port,
});
