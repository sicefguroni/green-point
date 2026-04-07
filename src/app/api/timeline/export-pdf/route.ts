import puppeteer from "puppeteer";
import { buildTimelinePdfDocumentHtml } from "@/components/ui/green_solutions/SidebarDetails/TimelineTab/views/TimelinePdfDocument";
import { deserializeTimelinePrintPayload } from "@/components/ui/green_solutions/SidebarDetails/timelinePrintPayload";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function safeFileName(fileName: string) {
	const sanitized = fileName
		.replace(/[<>:"/\\|?*]+/g, "-")
		.replace(/\s+/g, " ")
		.trim();

	if (!sanitized) {
		return "timeline.pdf";
	}

	return sanitized.toLowerCase().endsWith(".pdf") ? sanitized : `${sanitized}.pdf`;
}

export async function POST(request: Request) {
	const raw = await request.text();
	const payload = deserializeTimelinePrintPayload(raw);

	if (!payload) {
		return Response.json({ error: "Invalid timeline PDF payload." }, { status: 400 });
	}

	const html = buildTimelinePdfDocumentHtml(payload);
	const browser = await puppeteer.launch({
		headless: true,
		args: process.platform === "linux" ? ["--no-sandbox", "--disable-setuid-sandbox"] : [],
	});

	try {
		const page = await browser.newPage();
		await page.setContent(html, { waitUntil: "networkidle0" });
		const pdf = await page.pdf({
			format: "A4",
			printBackground: true,
			preferCSSPageSize: true,
		});
		const pdfBuffer = new Uint8Array(pdf).buffer as ArrayBuffer;

		return new Response(pdfBuffer, {
			status: 200,
			headers: {
				"Content-Type": "application/pdf",
				"Content-Disposition": `attachment; filename="${safeFileName(payload.title)}"`,
				"Cache-Control": "no-store",
			},
		});
	} catch (error) {
		console.error("Failed to export timeline PDF", error);
		return Response.json({ error: "Failed to generate timeline PDF." }, { status: 500 });
	} finally {
		await browser.close();
	}
}
