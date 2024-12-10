import type { z } from "zod";
import compareResponseSchema from "../schemas.js";

type CompareResponse = z.infer<typeof compareResponseSchema>;

export async function compareDocumentPair(
	file1: File,
	file2: File,
	weightText: number,
): Promise<CompareResponse> {
	const formData = new FormData();
	formData.append("file1", file1);
	formData.append("file2", file2);
	formData.append("weight_text", weightText.toString());

	const response = await fetch("https://ygsoc4sow8kcwkcogwsckook.13.76.121.152.sslip.io/compare", {
		method: "POST",
		body: formData,
	});

	if (!response.ok) {
		const error = await response.json();
		throw new Error(error.error || "Comparison failed");
	}

	const data = await response.json();
	return compareResponseSchema.parse(data);
}
