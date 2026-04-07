"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import PdfPreviewView from "@/components/ui/green_solutions/SidebarDetails/TimelineTab/views/PdfPreviewView";
import {
	deserializeTimelinePrintPayload,
	TIMELINE_PRINT_STORAGE_PREFIX,
	type TimelinePrintPayload,
} from "@/components/ui/green_solutions/SidebarDetails/timelinePrintPayload";

function ScreenMessage({ message }: { message: string }) {
	return (
		<div className="rounded-2xl border border-neutral-200 bg-white px-5 py-4 text-sm text-neutral-600 shadow-sm">
			{message}
		</div>
	);
}

export default function TimelinePrintPage() {
	const searchParams = useSearchParams();
	const [payload, setPayload] = useState<TimelinePrintPayload | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [hasTriggeredPrint, setHasTriggeredPrint] = useState(false);

	useEffect(() => {
		const documentKey = searchParams.get("doc");

		if (!documentKey || !documentKey.startsWith(TIMELINE_PRINT_STORAGE_PREFIX)) {
			setError("Missing printable timeline document.");
			return;
		}

		const raw = window.localStorage.getItem(documentKey);
		if (!raw) {
			setError("Printable timeline data has expired. Reopen export from the timeline panel.");
			return;
		}

		const parsed = deserializeTimelinePrintPayload(raw);
		window.localStorage.removeItem(documentKey);

		if (!parsed) {
			setError("Unable to open the printable timeline document.");
			return;
		}

		setPayload(parsed);
	}, [searchParams]);

	useEffect(() => {
		if (!payload) return;

		document.title = payload.title;
	}, [payload]);

	useEffect(() => {
		if (!payload || hasTriggeredPrint) return;

		const timer = window.setTimeout(() => {
			setHasTriggeredPrint(true);
			window.print();
		}, 250);

		const handleAfterPrint = () => {
			window.close();
		};

		window.addEventListener("afterprint", handleAfterPrint);

		return () => {
			window.clearTimeout(timer);
			window.removeEventListener("afterprint", handleAfterPrint);
		};
	}, [payload, hasTriggeredPrint]);

	return (
		<main className="timeline-print-shell min-h-screen bg-neutral-100 px-4 py-6 text-neutral-900 print:bg-white print:p-0">
			<style jsx global>{`
				@page {
					size: A4 portrait;
					margin: 0;
				}

				@media print {
					html,
					body {
						background: #ffffff;
					}

					.timeline-print-toolbar {
						display: none !important;
					}

					.timeline-print-page {
						margin: 0 !important;
						box-shadow: none !important;
						border-radius: 0 !important;
					}
				}
			`}</style>

			<div className="timeline-print-toolbar mx-auto mb-4 flex w-full max-w-4xl items-center justify-between gap-3 rounded-2xl border border-neutral-200 bg-white px-5 py-4 shadow-sm">
				<div>
					<p className="text-sm font-semibold text-neutral-900">Printable timeline document</p>
					<p className="text-xs text-neutral-500">
						Use Save as PDF in the print dialog to keep selectable text and clickable links.
					</p>
				</div>
				<button
					type="button"
					onClick={() => window.print()}
					className="rounded-full border border-neutral-200 px-4 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50"
				>
					Print
				</button>
			</div>

			{error ? (
				<div className="mx-auto w-full max-w-4xl">
					<ScreenMessage message={error} />
				</div>
			) : payload ? (
				<div className="timeline-print-page mx-auto w-fit rounded-[30px] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)] print:shadow-none">
					<PdfPreviewView plan={payload.plan} costEstimate={payload.costEstimate} />
				</div>
			) : (
				<div className="mx-auto w-full max-w-4xl">
					<ScreenMessage message="Preparing printable timeline document..." />
				</div>
			)}
		</main>
	);
}
