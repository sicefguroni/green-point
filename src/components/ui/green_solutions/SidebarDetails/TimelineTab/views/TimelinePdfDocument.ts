import type { CostEstimate } from "@/types/green_solutions";
import type { TimelinePrintPayload } from "../../timelinePrintPayload";

function escapeHtml(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/\"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

function formatDate(value: Date) {
	return value.toLocaleDateString("en-PH", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function formatCurrency(amount: number) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(amount);
}

function renderList(items: string[]): string {
	return items.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function renderTasks(payload: TimelinePrintPayload): string {
	return payload.plan.phases
		.map((phase, phaseIndex) => {
			const tasks = phase.tasks
				.map(
					(task) => `<li><strong>${escapeHtml(task.title)}: </strong>${escapeHtml(task.description)}</li>`,
				)
				.join("");

			return `
				<article class="phase-card">
					<div class="phase-header keep-with-next">
						<h2 class="phase-title">${phaseIndex + 1}. ${escapeHtml(phase.title)}</h2>
						<p class="phase-dates">${escapeHtml(formatDate(phase.startDate))} - ${escapeHtml(formatDate(phase.endDate))}</p>
					</div>
					<p class="phase-subtitle">${escapeHtml(phase.subtitle)}</p>
					<ol class="number-list">${tasks}</ol>
				</article>
			`;
		})
		.join("");
}

function renderCostEstimate(costEstimate: CostEstimate | null): string {
	if (!costEstimate) {
		return "";
	}

	const totalEstimate = Math.max(costEstimate.totalEstimate, 1);
	const percentOfTotal = (amount: number) => `${((amount / totalEstimate) * 100).toFixed(0)}%`;
	const extraLineItems = (costEstimate.lineItems ?? []).filter(
		(item) => !["materials", "labor", "contingency"].includes(item.category),
	);

	const extraCostDrivers = extraLineItems.length
		? `
			<div class="box">
				<h3 class="box-title keep-with-next">Additional Cost Drivers</h3>
				<div class="stack-sm">
					${extraLineItems
						.map(
							(item) => `
								<div class="inner-box">
									<div class="key-value-row gap-top">
										<div>
											<p class="item-title">${escapeHtml(item.label)}</p>
											${item.rationale ? `<p class="muted-copy">${escapeHtml(item.rationale)}</p>` : ""}
											${item.sourceStudy ? `<p class="source-note">${escapeHtml(item.sourceStudy)}</p>` : ""}
										</div>
										<p class="item-value">${escapeHtml(formatCurrency(item.estimatedCost))}</p>
									</div>
								</div>
							`,
						)
						.join("")}
				</div>
			</div>
		`
		: "";

	const technicalConsiderations = costEstimate.technicalConsiderations?.length
		? `
			<div class="box">
				<h3 class="box-title keep-with-next">Technical Considerations</h3>
				<div class="stack-sm">
					${costEstimate.technicalConsiderations
						.map(
							(item) => `
								<div class="inner-box">
									<div class="key-value-row gap-top">
										<p class="item-title">${escapeHtml(item.title)}</p>
										<span class="pill">${escapeHtml(item.phaseHint)}</span>
									</div>
									<p class="muted-copy">${escapeHtml(item.detail)}</p>
									${item.sourceStudy ? `<p class="source-note">${escapeHtml(item.sourceStudy)}</p>` : ""}
								</div>
							`,
						)
						.join("")}
				</div>
			</div>
		`
		: "";

	const assumptionsAndCitations = costEstimate.assumptions?.length || costEstimate.citations?.length
		? `
			<div class="two-column-grid">
				${costEstimate.assumptions?.length ? `
					<div class="box keep-together">
						<h3 class="box-title keep-with-next">Planning Assumptions</h3>
						<ul class="plain-list">${renderList(costEstimate.assumptions)}</ul>
					</div>
				` : ""}
				${costEstimate.citations?.length ? `
					<div class="box keep-together">
						<h3 class="box-title keep-with-next">Research Grounding</h3>
						<ul class="plain-list">${renderList(costEstimate.citations)}</ul>
					</div>
				` : ""}
			</div>
		`
		: "";

	const marketReferences = costEstimate.marketReferences?.length
		? `
			<div class="box">
				<h3 class="box-title keep-with-next">Local Market References</h3>
				<div class="stack-sm">
					${costEstimate.marketReferences
						.map(
							(reference) => `
								<div class="inner-box">
									<div class="key-value-row gap-top">
										<div class="stack-xs">
											<a href="${escapeHtml(reference.url)}" target="_blank" rel="noreferrer" class="reference-link">${escapeHtml(reference.title)}</a>
											${reference.locality ? `<p class="source-note">${escapeHtml(reference.locality)}</p>` : ""}
											<p class="muted-copy">${escapeHtml(reference.snippet)}</p>
										</div>
										${typeof reference.score === "number" ? `<span class="pill">${(reference.score * 100).toFixed(0)}%</span>` : ""}
									</div>
								</div>
							`,
						)
						.join("")}
				</div>
			</div>
		`
		: "";

	return `
		<section class="stack section-block">
			<h2 class="section-eyebrow keep-with-next">Grounded Cost Context</h2>
			<div class="cost-hero keep-together">
				<div class="stack-sm">
					<p class="section-eyebrow">Cost Estimate</p>
					<p class="cost-total">${escapeHtml(formatCurrency(costEstimate.totalEstimate))}</p>
					<p class="muted-copy">
						${escapeHtml(costEstimate.perUnit)}
						${typeof costEstimate.quantity === "number" && costEstimate.quantity > 1 ? ` • ${escapeHtml(costEstimate.quantity.toFixed(0))} units` : ""}
						${costEstimate.area ? ` • ${escapeHtml(costEstimate.area.toFixed(2))} m²` : ""}
					</p>
					${costEstimate.lifecycleYears ? `<p class="muted-copy">Lifecycle horizon: ${escapeHtml(String(costEstimate.lifecycleYears))} years</p>` : ""}
					${costEstimate.locationMultiplier !== 1 ? `<p class="muted-copy">Location adjustment: ${escapeHtml(((costEstimate.locationMultiplier - 1) * 100).toFixed(0))}%</p>` : ""}
					${costEstimate.confidence ? `<p class="muted-copy">Confidence: ${escapeHtml(costEstimate.confidence)}</p>` : ""}
				</div>
			</div>

			<div class="box keep-together">
				<h3 class="box-title keep-with-next">Cost Breakdown</h3>
				<div class="stack-sm">
					<div class="key-value-row">
						<div>
							<p class="item-title">Materials</p>
							<p class="muted-copy">${escapeHtml(percentOfTotal(costEstimate.breakdown.materials))}</p>
						</div>
						<p class="item-value">${escapeHtml(formatCurrency(costEstimate.breakdown.materials))}</p>
					</div>
					<div class="key-value-row">
						<div>
							<p class="item-title">Labor</p>
							<p class="muted-copy">${escapeHtml(percentOfTotal(costEstimate.breakdown.labor))}</p>
						</div>
						<p class="item-value">${escapeHtml(formatCurrency(costEstimate.breakdown.labor))}</p>
					</div>
					<div class="key-value-row">
						<div>
							<p class="item-title">Contingency</p>
							<p class="muted-copy">${escapeHtml(percentOfTotal(costEstimate.breakdown.contingency))}</p>
						</div>
						<p class="item-value">${escapeHtml(formatCurrency(costEstimate.breakdown.contingency))}</p>
					</div>
					${typeof costEstimate.breakdown.maintenance === "number" ? `
						<div class="key-value-row">
							<div>
								<p class="item-title">Lifecycle Maintenance</p>
								<p class="muted-copy">${escapeHtml(percentOfTotal(costEstimate.breakdown.maintenance))}</p>
							</div>
							<p class="item-value">${escapeHtml(formatCurrency(costEstimate.breakdown.maintenance))}</p>
						</div>
					` : ""}
				</div>
				<p class="meta-note">Base cost: ${escapeHtml(formatCurrency(costEstimate.basePrice))} • ${escapeHtml(costEstimate.estimateBasis || "Estimate may vary based on site conditions")}</p>
			</div>

			${extraCostDrivers}
			${technicalConsiderations}
			${assumptionsAndCitations}
			${marketReferences}
		</section>
	`;
}

export function buildTimelinePdfDocumentHtml(payload: TimelinePrintPayload): string {
	const { plan, costEstimate } = payload;
	const firstPhase = plan.phases[0];
	const lastPhase = plan.phases[plan.phases.length - 1];
	const totalDays =
		firstPhase && lastPhase
			? Math.round((lastPhase.endDate.getTime() - firstPhase.startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1
			: 0;

	return `<!DOCTYPE html>
		<html lang="en">
			<head>
				<meta charSet="utf-8" />
				<title>${escapeHtml(payload.title)}</title>
				<style>
					@page {
						size: A4 portrait;
						margin: 14mm 12mm;
					}

					* { box-sizing: border-box; }
					html, body {
						margin: 0;
						padding: 0;
						font-family: "Segoe UI", Arial, sans-serif;
						color: #171717;
						background: #ffffff;
					}
					body {
						font-size: 13px;
						line-height: 1.5;
					}
					main > * + * {
						margin-top: 18px;
					}
					a {
						color: #047857;
						text-decoration: none;
					}
					main {
						display: block;
					}
					.stack, .stack-sm, .stack-xs {
						display: block;
					}
					.stack > * + * { margin-top: 16px; }
					.stack-sm > * + * { margin-top: 10px; }
					.stack-xs > * + * { margin-top: 4px; }
					.overview-title { font-size: 34px; font-weight: 800; line-height: 1.1; margin: 0; }
					.subtle-location { margin: 0; font-size: 15px; color: #737373; }
					.metrics-row { display: flex; flex-wrap: wrap; gap: 18px; }
					.metric-label, .section-eyebrow, .box-title, .source-note { text-transform: uppercase; letter-spacing: 0.18em; }
					.metric-label, .section-eyebrow { font-size: 10px; font-weight: 700; color: #a3a3a3; margin: 0 0 4px; }
					.metric-value { margin: 0; font-size: 14px; font-weight: 600; color: #404040; }
					.cost-hero, .box, .phase-card { border: 1px solid #e5e5e5; border-radius: 18px; padding: 16px; background: #ffffff; }
					.cost-hero { background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%); border-color: #bbf7d0; }
					.cost-total { margin: 0; font-size: 30px; font-weight: 800; color: #15803d; }
					.muted-copy { margin: 0; font-size: 12px; color: #6b7280; }
					.meta-note { margin: 12px 0 0; padding-top: 10px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #6b7280; }
					.box-title { margin: 0 0 10px; font-size: 11px; font-weight: 700; color: #9ca3af; }
					.inner-box, .key-value-row { border: 1px solid #f0f0f0; border-radius: 12px; background: #fafafa; }
					.inner-box { padding: 12px; }
					.key-value-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding: 12px; }
					.key-value-row.gap-top { padding: 0; border: 0; background: transparent; }
					.item-title, .item-value { margin: 0; font-size: 14px; font-weight: 700; color: #171717; }
					.pill { display: inline-flex; align-items: center; border-radius: 999px; padding: 4px 8px; background: #f5f5f5; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #525252; }
					.plain-list, .number-list { margin: 0; padding-left: 18px; }
					.plain-list li, .number-list li { margin-bottom: 6px; }
					.two-column-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
					.phase-card { display: flex; flex-direction: column; gap: 14px; }
					.phase-header { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; }
					.phase-title { margin: 0; font-size: 24px; font-weight: 800; line-height: 1.15; }
					.phase-dates { margin: 0; font-size: 12px; color: #737373; }
					.phase-subtitle { margin: 0; font-size: 14px; line-height: 1.6; color: #525252; }
					.reference-link { font-size: 14px; font-weight: 700; text-decoration: underline; }
					.source-note { margin: 0; font-size: 10px; font-weight: 700; color: #9ca3af; }
					.keep-together { break-inside: avoid-page; page-break-inside: avoid; }
					.keep-with-next { break-after: avoid-page; page-break-after: avoid; }
					.section-block { break-inside: auto; page-break-inside: auto; }
					.phase-card > * + * { margin-top: 14px; }
					.section-eyebrow + .plain-list { margin-top: 8px; }
					@media print {
						h1, h2, h3 { orphans: 3; widows: 3; }
						p, li { orphans: 3; widows: 3; }
					}
				</style>
			</head>
			<body>
				<main>
					<header class="stack keep-together">
						<div>
							<p class="section-eyebrow">Overview</p>
							<h1 class="overview-title">${escapeHtml(plan.objective)}</h1>
							<p class="subtle-location">${escapeHtml(plan.locationLabel)}</p>
						</div>
						<div class="metrics-row">
							<div><p class="metric-label">Duration</p><p class="metric-value">${totalDays} days</p></div>
							<div><p class="metric-label">Phases</p><p class="metric-value">${plan.phases.length}</p></div>
							<div><p class="metric-label">Generated</p><p class="metric-value">${escapeHtml(formatDate(plan.generatedAt))}</p></div>
						</div>
					</header>
					${renderCostEstimate(costEstimate)}
					${plan.constraints.length ? `<section class="stack section-block"><h2 class="section-eyebrow keep-with-next">AI-Aligned Constraints</h2><ul class="plain-list">${renderList(plan.constraints)}</ul></section>` : ""}
					<section class="stack section-block">
						<h2 class="section-eyebrow keep-with-next">Implementation Timeline</h2>
						${renderTasks(payload)}
					</section>
				</main>
			</body>
		</html>`;
}
