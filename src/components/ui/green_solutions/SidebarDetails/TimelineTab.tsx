"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
	BadgeCheck,
	CalendarDays,
	ChevronDown,
	Download,
	FileDown,
	FileText,
	Hammer,
	LayoutPanelTop,
	Loader2,
	ListChecks,
	Package,
	Scale,
	Sprout,
	Wrench,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { type BarangayData } from "@/context/BarangayContext";
import {
	type ChatHistoryMessage,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import CostEstimateCard from "./CostEstimateCard";
import {
	type Phase as TimelinePhaseContract,
	type TimelineCategory,
	type TimelineGenerateRequest,
	type TimelineGenerateResponse,
	type TimelineApproveResponse,
	type TimelineRegenerateRequest,
	type TimelineRegenerateResponse,
	type TimelineRecord,
} from "@/types/timeline";
import RoadmapView from "./TimelineTab/views/RoadmapView";
import GanttView from "./TimelineTab/views/GanttView";
import PdfPreviewView from "./TimelineTab/views/PdfPreviewView";
import {
	PDF_EXPORT_SCALE,
	PDF_PAGE_HEIGHT_MM,
	PDF_PAGE_WIDTH_MM,
	PDF_PREVIEW_WIDTH_PX,
	PDF_PREVIEW_HEIGHT_PX,
	} from "./timelinePdfLayout";
import {
	type TimelineBadge,
	type TimelinePlan,
	type TimelinePhase,
	type TimelineTask,
} from "./TimelineTab/types";

type ViewMode = "DEFAULT" | "GANTT" | "PDF";

interface TimelineTabProps {
	selectedRecommendation: UIRecommendation;
	selectedFeature?: SelectedFeature;
	selectedBarangayData?: BarangayData | null;
	chatHistory?: ChatHistoryMessage[];
	displayMode?: "sidebar" | "fullscreen";
	timelineRecord: TimelineRecord | null;
	onTimelineRecordChange: (record: TimelineRecord | null) => void;
	onGeneratingChange?: (isGenerating: boolean) => void;
}

const VIEW_OPTIONS: {
	id: ViewMode;
	label: string;
}[] = [
	{ id: "DEFAULT", label: "Step-by-Step"},
	{ id: "GANTT", label: "Gantt Chart"},
	{ id: "PDF", label: "PDF Preview"},
];

const DAY_MS = 1000 * 60 * 60 * 24;

const CATEGORY_META: Record<
	TimelineCategory,
	{ Icon: LucideIcon; label: string }
> = {
	planning: { Icon: LayoutPanelTop, label: "Planning" },
	legal: { Icon: Scale, label: "Legal" },
	procurement: { Icon: Package, label: "Procurement" },
	construction: { Icon: Hammer, label: "Construction" },
};

function addDays(start: Date, days: number) {
	const value = new Date(start);
	value.setDate(value.getDate() + days);
	return value;
}

function addWeeks(start: Date, weeks: number) {
	return addDays(start, weeks * 7);
}

function normalizeText(messages: ChatHistoryMessage[] = []) {
	return messages.map((message) => message.content).join(" ").toLowerCase();
}

function extractConstraints(messages: ChatHistoryMessage[] = []) {
	const context = normalizeText(messages);
	const constraints: string[] = [];

	if (/budget|cost|cheap|afford/i.test(context)) {
		constraints.push("Prioritize budget-sensitive materials and phased roll-out.");
	}
	if (/rain|flood|drainage|storm/i.test(context)) {
		constraints.push("Account for drainage and flood resilience in placement and maintenance.");
	}
	if (/heat|shade|temperature/i.test(context)) {
		constraints.push("Focus on canopy coverage and heat-mitigation zones.");
	}
	if (/community|resident|volunteer|participation/i.test(context)) {
		constraints.push("Include community engagement milestones before and after planting.");
	}
	if (/permit|approval|lgu|barangay hall/i.test(context)) {
		constraints.push("Schedule local permits and barangay coordination as early dependencies.");
	}

	return constraints;
}

function createPhaseTasks(
	phaseId: string,
	phaseTitle: string,
	startDate: Date,
	durationDays: number,
	recommendation: UIRecommendation,
): TimelineTask[] {
	const taskStart = startDate;
	const half = Math.max(4, Math.floor(durationDays / 2));
	const taskMid = addDays(startDate, half);
	const endDate = addDays(startDate, durationDays);

	return [
		{
			id: `${phaseId}-task-1`,
			phaseId,
			title: `${phaseTitle} kickoff`,
			description: `Align scope, site conditions, and resource needs for ${recommendation.solutionTitle}.`,
			startDate: taskStart,
			endDate: addDays(taskStart, Math.max(3, Math.floor(half * 0.7))),
		},
		{
			id: `${phaseId}-task-2`,
			phaseId,
			title: `${phaseTitle} execution`,
			description: `Deliver field activities and quality checks for ${recommendation.solutionTitle}.`,
			startDate: taskMid,
			endDate,
		},
	];
}

function buildTimelinePlan(
	recommendation: UIRecommendation,
	chatHistory: ChatHistoryMessage[] = [],
	selectedFeature?: SelectedFeature,
): TimelinePlan {
	const constraints = extractConstraints(chatHistory);
	const kickoff = new Date();

	const phaseBlueprints = [
		{
			id: "P1",
			title: "Preparation",
			subtitle: "Permits, baseline checks, and implementation planning",
			icon: LayoutPanelTop,
			categoryLabel: "Planning",
			days: 14,
		},
		{
			id: "P2",
			title: "Planting and Installation",
			subtitle: "Execute site work and intervention deployment",
			icon: Sprout,
			categoryLabel: "Construction",
			days: 28,
		},
		{
			id: "P3",
			title: "Maintenance and Monitoring",
			subtitle: "Stabilize outcomes through routine care and tracking",
			icon: Wrench,
			categoryLabel: "Construction",
			days: 60,
		},
	] as const;

	const phases: TimelinePhase[] = [];
	let cursor = kickoff;

	phaseBlueprints.forEach((phase) => {
		const phaseStart = cursor;
		const phaseEnd = addDays(phaseStart, phase.days);
		phases.push({
			id: phase.id,
			title: phase.title,
			subtitle: phase.subtitle,
			icon: phase.icon,
			startDate: phaseStart,
			endDate: phaseEnd,
			badges: [
				{ label: phase.categoryLabel, tone: "info" },
				{ label: "Preview", tone: "neutral" },
				{ label: `${phase.days} days`, tone: "neutral" },
			],
			approvalNote: "Preview timeline only. Generate the AI-backed draft to review approval metadata.",
			tasks: createPhaseTasks(
				phase.id,
				phase.title,
				phaseStart,
				phase.days,
				recommendation,
			),
		});

		cursor = addDays(phaseEnd, 1);
	});

	return {
		objective: recommendation.solutionTitle,
		locationLabel:
			selectedFeature?.barangay
				? `Barangay ${selectedFeature.barangay}, Mandaue City`
				: selectedFeature?.name || "Mandaue City",
		generatedAt: new Date(),
		constraints,
		reviewStatus: "Preview only",
		phases,
	};
}

function formatApprovalNote(record: TimelineRecord) {
	if (record.reviewStatus === "approved") {
		const approvedAt = record.approvedAt
			? new Date(record.approvedAt).toLocaleDateString("en-PH", {
				year: "numeric",
				month: "short",
				day: "numeric",
			})
			: "Unknown date";
		return `Approved on ${approvedAt}.`;
	}

	return "Draft timeline awaiting human review and approval.";
}

function buildPhaseBadges(
	phase: TimelinePhaseContract,
	record: TimelineRecord,
): TimelineBadge[] {
	return [
		{ label: CATEGORY_META[phase.category].label, tone: "info" },
		{
			label: record.reviewStatus === "approved" ? "Approved" : "Draft",
			tone: record.reviewStatus === "approved" ? "success" : "warning",
		},
		{ label: `${phase.duration_weeks} weeks`, tone: "neutral" },
	];
}

function createServerPhaseTasks(
	phase: TimelinePhaseContract,
	phaseStart: Date,
	phaseEnd: Date,
): TimelineTask[] {
	const halfDays = Math.max(7, Math.floor((phase.duration_weeks * 7) / 2));
	const midpoint = addDays(phaseStart, halfDays);
	const dependencyText = phase.dependencies.length
		? `Complete dependencies: ${phase.dependencies.join(", ")} before ${phase.name.toLowerCase()} begins.`
		: `Confirm baseline scope and kickoff approvals for ${phase.name.toLowerCase()}.`;

	return [
		{
			id: `${phase.id}-dependencies`,
			phaseId: phase.id,
			title: `${phase.name} readiness`,
			description: dependencyText,
			startDate: phaseStart,
			endDate: addDays(phaseStart, Math.max(5, halfDays - 2)),
		},
		{
			id: `${phase.id}-delivery`,
			phaseId: phase.id,
			title: `${phase.name} delivery`,
			description: phase.reasoning_for_duration,
			startDate: midpoint,
			endDate: phaseEnd,
		},
	];
}

function adaptTimelineRecord(record: TimelineRecord): TimelinePlan {
	const generatedAt = new Date(record.generatedAt);

	return {
		objective: record.timeline.project_title,
		locationLabel: record.locationLabel,
		generatedAt,
		constraints: record.timeline.risks,
		reviewStatus:
			record.reviewStatus === "approved"
				? "Approved"
				: "Draft awaiting review",
		approvedAt: record.approvedAt ? new Date(record.approvedAt) : undefined,
		reviewerNotes: record.reviewerNotes,
		threadId: record.threadId,
		phases: record.timeline.phases.map((phase) => {
			const startDate = addWeeks(generatedAt, phase.start_week - 1);
			const endDate = addDays(startDate, phase.duration_weeks * 7 - 1);
			const category = CATEGORY_META[phase.category];

			return {
				id: phase.id,
				title: phase.name,
				subtitle: `${category.label} · ${phase.reasoning_for_duration}`,
				icon: category.Icon,
				startDate,
				endDate,
				badges: buildPhaseBadges(phase, record),
				approvalNote: formatApprovalNote(record),
				tasks: createServerPhaseTasks(phase, startDate, endDate),
			};
		}),
	};
}

export default function TimelineTab({
	selectedRecommendation,
	selectedFeature,
	selectedBarangayData,
	chatHistory = [],
	displayMode = "sidebar",
	timelineRecord,
	onTimelineRecordChange,
	onGeneratingChange,
}: TimelineTabProps) {
	const [timelineError, setTimelineError] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isApproving, setIsApproving] = useState(false);
	const [isRegenerating, setIsRegenerating] = useState(false);
	const [draftContext, setDraftContext] = useState("");
	const [viewMode, setViewMode] = useState<ViewMode>("DEFAULT");
	const [isExporting, setIsExporting] = useState(false);
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const viewRef = useRef<HTMLDivElement>(null);
	const draftContextRef = useRef<HTMLTextAreaElement>(null);
	const exportDropdownRef = useRef<HTMLDivElement>(null);
	const viewDropdownRef = useRef<HTMLDivElement>(null);

	const previewPlan = useMemo(
		() => buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
		[selectedRecommendation, chatHistory, selectedFeature],
	);

	const plan = useMemo(
		() => (timelineRecord ? adaptTimelineRecord(timelineRecord) : previewPlan),
		[timelineRecord, previewPlan],
	);

	const hasGeneratedTimeline = Boolean(timelineRecord);
	const isDraftAwaitingReview = timelineRecord?.reviewStatus === "draft";
	const isPdfView = viewMode === "PDF";
	const activeRisks = timelineRecord?.timeline.risks ?? [];
	const effectiveCostEstimate = timelineRecord?.costEstimate ?? selectedRecommendation.costEstimate ?? null;
	const reviewStatusLabel = timelineRecord
		? timelineRecord.reviewStatus === "approved"
			? "Approved"
			: "Draft awaiting review"
		: "Preview only";

	const floodHazard = useMemo(() => {
		const levels = selectedFeature?.hazards?.flood?.map((item) => item.level ?? 0) ?? [];
		return levels.length > 0 ? Math.max(...levels) : undefined;
	}, [selectedFeature?.hazards?.flood]);

	const stormHazard = useMemo(() => {
		const levels = selectedFeature?.hazards?.storm?.map((item) => item.level ?? 0) ?? [];
		return levels.length > 0 ? Math.max(...levels) : undefined;
	}, [selectedFeature?.hazards?.storm]);

	useEffect(() => {
		setTimelineError(null);
		setDraftContext("");
		setViewMode("DEFAULT");
	}, [selectedRecommendation.id, selectedFeature?.name, selectedFeature?.address, selectedFeature?.barangay]);

	useEffect(() => {
		const textarea = draftContextRef.current;
		if (!textarea) return;
		textarea.style.height = "auto";
		textarea.style.height = `${Math.min(textarea.scrollHeight, 112)}px`;
	}, [draftContext]);

	useEffect(() => {
		if (timelineRecord?.reviewStatus !== "draft") {
			setDraftContext("");
		}
	}, [timelineRecord?.reviewStatus]);

	useEffect(() => {
		if (!isExportOpen && !isViewOpen) return;
		const handleClick = (event: MouseEvent) => {
			if (
				isExportOpen &&
				exportDropdownRef.current &&
				!exportDropdownRef.current.contains(event.target as Node)
			) {
				setIsExportOpen(false);
			}
			if (
				isViewOpen &&
				viewDropdownRef.current &&
				!viewDropdownRef.current.contains(event.target as Node)
			) {
				setIsViewOpen(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, [isExportOpen, isViewOpen]);

	const baseFileName = selectedRecommendation.solutionTitle
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

	const generatePayload: TimelineGenerateRequest = {
		recommendation: {
			id: selectedRecommendation.id,
			recommendationId: selectedRecommendation.recommendationID,
			solutionTitle: selectedRecommendation.solutionTitle,
			solutionDescription: selectedRecommendation.solutionDescription,
			interventionType: selectedRecommendation.interventionType,
			priority: selectedRecommendation.priority,
			efficiencyLevel: selectedRecommendation.efficiencyLevel,
			impact: selectedRecommendation.impact,
			equityIndex: selectedRecommendation.equityIndex,
			rationale: selectedRecommendation.rationale,
			sourceStudy: selectedRecommendation.sourceStudy,
		},
		location: selectedFeature
			? {
				name: selectedFeature.name,
				address: selectedFeature.address,
				barangay: selectedFeature.barangay,
			}
			: undefined,
		metrics: {
			ndvi: (selectedFeature?.properties?.ndvi as number | undefined) ?? selectedBarangayData?.ndvi,
			lst:
				(selectedFeature?.properties?.temperature as number | undefined) ??
				(selectedFeature?.properties?.lst as number | undefined) ??
				selectedBarangayData?.lst,
			treeCanopy: (selectedFeature?.properties?.treeCanopy as number | undefined) ?? selectedBarangayData?.treeCanopy,
			greeneryIndex:
				(selectedFeature?.properties?.greeneryIndex as number | undefined) ??
				selectedBarangayData?.greeneryIndex,
			greeneryLevel: selectedBarangayData?.greeneryLevel,
			floodHazard,
			stormHazard,
			aqi:
				selectedFeature?.hazards?.air?.[0]?.AQI_Level ??
				selectedBarangayData?.aqi,
		},
		chatHistory,
		costEstimate: selectedRecommendation.costEstimate ?? undefined,
	};

	// html2canvas 1.4.1 can't parse oklch / lab / oklab / lch color functions
	// used by Tailwind v4. Chrome serialises wide-gamut oklch values as lab()
	// when they fall outside sRGB. We:
	//   1. Override CSS custom properties with rgb() equivalents
	//   2. Walk every element and force-convert any remaining lab()/oklch()
	//      computed color properties to rgb() via a 1×1 canvas trick
	const prepareCloneForHtml2Canvas = (clonedDoc: Document): void => {
		const sourceRoot = viewRef.current;
		const clonedRoot = clonedDoc.querySelector<HTMLElement>("[data-export-root='timeline-view']");

		if (sourceRoot && clonedRoot) {
			const sourceRect = sourceRoot.getBoundingClientRect();
			clonedRoot.style.width = `${Math.ceil(sourceRect.width)}px`;
			clonedRoot.style.minWidth = `${Math.ceil(sourceRect.width)}px`;

			const sourceScrollContainers = Array.from(
				sourceRoot.querySelectorAll<HTMLElement>("[data-export-scroll]"),
			);
			const clonedScrollContainers = Array.from(
				clonedRoot.querySelectorAll<HTMLElement>("[data-export-scroll]"),
			);

			clonedScrollContainers.forEach((container, index) => {
				const sourceContainer = sourceScrollContainers[index];
				if (!sourceContainer) return;
				container.scrollLeft = sourceContainer.scrollLeft;
				container.scrollTop = sourceContainer.scrollTop;
			});
		}

		const offscreen = document.createElement("canvas");
		offscreen.width = offscreen.height = 1;
		const ctx = offscreen.getContext("2d")!;
		const unsupported = /(?:oklch|lab|oklab|lch)\(/;

		const toRgb = (color: string): string | null => {
			try {
				ctx.clearRect(0, 0, 1, 1);
				ctx.fillStyle = "#000";
				ctx.fillStyle = color;
				ctx.fillRect(0, 0, 1, 1);
				const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
				if (a === 0) return "transparent";
				return a < 255
					? `rgba(${r},${g},${b},${+(a / 255).toFixed(3)})`
					: `rgb(${r},${g},${b})`;
			} catch {
				return null;
			}
		};

		// Match oklch(...) / lab(...) / oklab(...) / lch(...) including nested parentheses
		// (e.g. oklch(0.5 0.2 240 / 50%)) and optional / alpha syntax.
		const colorFnRe = /(?:oklch|lab|oklab|lch)\((?:[^()]*|\([^()]*\))*\)/g;

		// Replace unsupported color functions inside any CSS value string
		const fixValue = (val: string): string | null => {
			if (!unsupported.test(val)) return null;
			return val.replace(colorFnRe, (m) => toRgb(m) ?? m);
		};

		// --- Step 1: Override CSS custom properties on :root ---
		const cssVarNames = [
			"--background", "--foreground", "--card", "--card-foreground",
			"--popover", "--popover-foreground", "--primary", "--primary-foreground",
			"--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
			"--accent", "--accent-foreground", "--destructive", "--border",
			"--input", "--ring", "--chart-1", "--chart-2", "--chart-3", "--chart-4",
			"--chart-5", "--sidebar", "--sidebar-foreground", "--sidebar-primary",
			"--sidebar-primary-foreground", "--sidebar-accent", "--sidebar-accent-foreground",
			"--sidebar-border", "--sidebar-ring",
		];
		const rootStyle = getComputedStyle(document.documentElement);
		const varOverrides: string[] = [];
		for (const name of cssVarNames) {
			const raw = rootStyle.getPropertyValue(name).trim();
			if (!raw) continue;
			const rgb = toRgb(raw);
			if (rgb) varOverrides.push(`${name}: ${rgb}`);
		}
		if (varOverrides.length) {
			const s = clonedDoc.createElement("style");
			s.textContent = `:root, .dark { ${varOverrides.join("; ")} }`;
			clonedDoc.head.appendChild(s);
		}

		// --- Step 2: Walk every element and force-convert computed colors ---
		const COLOR_PROPS = [
			"color", "background-color", "background-image", "background",
			"border-top-color", "border-right-color",
			"border-bottom-color", "border-left-color",
			"outline-color", "text-decoration-color",
			"-webkit-text-stroke-color",
			"fill", "stroke",
			"box-shadow", "text-shadow",
			"caret-color", "column-rule-color",
		];

		const win = clonedDoc.defaultView;
		if (!win) return;

		for (const el of clonedDoc.querySelectorAll("*")) {
			const htmlEl = el as HTMLElement;
			if (!htmlEl.style) continue;
			const cs = win.getComputedStyle(el);
			for (const prop of COLOR_PROPS) {
				const val = cs.getPropertyValue(prop);
				const fixed = fixValue(val);
				if (fixed !== null) {
					htmlEl.style.setProperty(prop, fixed, "important");
				}
			}
		}
	};

	const exportNodeAsImage = async (fileName: string) => {
		if (!viewRef.current) return;

		const canvas = await html2canvas(viewRef.current, {
			backgroundColor: "#ffffff",
			scale: PDF_EXPORT_SCALE,
			onclone: prepareCloneForHtml2Canvas,
		});
		const href = canvas.toDataURL("image/png");
		const link = document.createElement("a");
		link.href = href;
		link.download = fileName;
		link.click();
	};

	const exportNodeAsPdf = async (fileName: string) => {
		if (!viewRef.current) return;

		const canvas = await html2canvas(viewRef.current, {
			backgroundColor: "#ffffff",
			scale: PDF_EXPORT_SCALE,
			onclone: prepareCloneForHtml2Canvas,
		});
		const pdf = new jsPDF({
			orientation: "portrait",
			unit: "mm",
			format: "a4",
		});
		const pageHeightPx = Math.max(
			1,
			Math.floor((canvas.width * PDF_PAGE_HEIGHT_MM) / PDF_PAGE_WIDTH_MM),
		);

		let offsetY = 0;
		let pageIndex = 0;

		while (offsetY < canvas.height) {
			const sliceHeight = Math.min(pageHeightPx, canvas.height - offsetY);
			const pageCanvas = document.createElement("canvas");
			pageCanvas.width = canvas.width;
			pageCanvas.height = sliceHeight;

			const pageContext = pageCanvas.getContext("2d");
			if (!pageContext) {
				break;
			}

			pageContext.fillStyle = "#ffffff";
			pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
			pageContext.drawImage(
				canvas,
				0,
				offsetY,
				canvas.width,
				sliceHeight,
				0,
				0,
				canvas.width,
				sliceHeight,
			);

			if (pageIndex > 0) {
				pdf.addPage();
			}

			const imageData = pageCanvas.toDataURL("image/png");
			const renderedHeightMm = (sliceHeight * PDF_PAGE_WIDTH_MM) / canvas.width;
			pdf.addImage(imageData, "PNG", 0, 0, PDF_PAGE_WIDTH_MM, renderedHeightMm);

			offsetY += sliceHeight;
			pageIndex += 1;
		}

		pdf.save(fileName);
	};

	const exportCurrentView = async () => {
		if (isExporting) return;

		setIsExporting(true);
		try {
			if (viewMode === "GANTT") {
				await exportNodeAsImage(`${baseFileName}-gantt.png`);
			} else {
				await exportNodeAsPdf(`${baseFileName}-report.pdf`);
			}
		} finally {
			setIsExporting(false);
		}
	};

	const exportPdf = async () => {
		if (isExporting) return;

		setIsExporting(true);
		try {
			await exportNodeAsPdf(`${baseFileName}-timeline.pdf`);
		} finally {
			setIsExporting(false);
		}
	};

	const exportPng = async () => {
		if (isExporting) return;

		setIsExporting(true);
		try {
			await exportNodeAsImage(`${baseFileName}-timeline.png`);
		} finally {
			setIsExporting(false);
		}
	};

	const handleGenerateTimeline = async () => {
		if (isGenerating) return;

		setIsGenerating(true);
		onGeneratingChange?.(true);
		setTimelineError(null);

		try {
			const response = await fetch("/api/timeline/generate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(generatePayload),
			});

			const result = (await response.json()) as
				| TimelineGenerateResponse
				| { success: false; error?: string };

			if (!response.ok || !result.success) {
				throw new Error(
					"error" in result && result.error
						? result.error
						: "Failed to generate timeline.",
				);
			}

			onTimelineRecordChange(result.data);
		} catch (error) {
			setTimelineError(
				error instanceof Error ? error.message : "Failed to generate timeline.",
			);
		} finally {
			setIsGenerating(false);
			onGeneratingChange?.(false);
		}
	};

	const handleApproveTimeline = async () => {
		if (!timelineRecord || isApproving || isRegenerating) return;

		setIsApproving(true);
		setTimelineError(null);

		try {
			const response = await fetch("/api/timeline/approve", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ threadId: timelineRecord.threadId }),
			});

			const result = (await response.json()) as
				| TimelineApproveResponse
				| { success: false; error?: string };

			if (!response.ok || !result.success) {
				throw new Error(
					"error" in result && result.error
						? result.error
						: "Failed to approve timeline.",
				);
			}

			onTimelineRecordChange(result.data);
		} catch (error) {
			setTimelineError(
				error instanceof Error ? error.message : "Failed to approve timeline.",
			);
		} finally {
			setIsApproving(false);
		}
	};

	const handleRegenerateTimeline = async () => {
		if (!timelineRecord || timelineRecord.reviewStatus !== "draft" || isRegenerating) return;

		const payload: TimelineRegenerateRequest = {
			threadId: timelineRecord.threadId,
			userProvidedContext: draftContext.trim() || undefined,
			...generatePayload,
		};

		setIsRegenerating(true);
		onGeneratingChange?.(true);
		setTimelineError(null);

		try {
			const response = await fetch("/api/timeline/regenerate", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});

			const result = (await response.json()) as
				| TimelineRegenerateResponse
				| { success: false; error?: string };

			if (!response.ok || !result.success) {
				throw new Error(
					"error" in result && result.error
						? result.error
						: "Failed to regenerate timeline.",
				);
			}

			onTimelineRecordChange(result.data);
			setDraftContext("");
		} catch (error) {
			setTimelineError(
				error instanceof Error ? error.message : "Failed to regenerate timeline.",
			);
		} finally {
			setIsRegenerating(false);
			onGeneratingChange?.(false);
		}
	};

	const renderActiveView = () => {
		if (viewMode === "DEFAULT") {
			return <RoadmapView plan={plan} displayMode={displayMode} />;
		}

		if (viewMode === "GANTT") {
			return <GanttView plan={plan} displayMode={displayMode} />;
		}

		return (
			<PdfPreviewView
				plan={plan}
				costEstimate={effectiveCostEstimate}
			/>
		);
	};

	const renderViewSurface = () => {
		const activeView = renderActiveView();

		if (isPdfView) {
			return (
				<div className="overflow-x-auto scrollbar-hide rounded-[28px] bg-neutral-100/80 p-3 sm:p-5">
					<div className="mx-auto w-fit rounded-[30px] bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.35)]">
						<div
							ref={viewRef}
							data-export-root="timeline-view"
							className="bg-white"
							style={{
								width: `${PDF_PREVIEW_WIDTH_PX}px`,
								minWidth: `${PDF_PREVIEW_WIDTH_PX}px`,
								minHeight: `${PDF_PREVIEW_HEIGHT_PX}px`,
							}}
						>
							{activeView}
						</div>
					</div>
				</div>
			);
		}

		return (
			<div
				ref={viewRef}
				data-export-root="timeline-view"
				className={
					displayMode === "fullscreen"
						? "mx-auto w-[1100px] max-w-full rounded-2xl bg-white"
						: "rounded-2xl bg-white"
				}
			>
				{activeView}
				{effectiveCostEstimate && viewMode === "DEFAULT" && (
					<div className="border-t border-neutral-100 px-4 py-4 sm:px-6">
						<div className="mb-3 flex items-center gap-2">
							<CalendarDays size={14} className="text-neutral-400" />
							<p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
								Grounded Cost Context
							</p>
						</div>
						<CostEstimateCard costEstimate={effectiveCostEstimate} />
					</div>
				)}
			</div>
		);
	};

	const renderPrimaryActionButtons = () => {
		// Approved → offer regeneration
		if (timelineRecord?.reviewStatus === "approved") {
			return (
				<Button
					variant="outline"
					size="sm"
					onClick={handleGenerateTimeline}
					disabled={isGenerating || isApproving || isRegenerating}
					className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
				>
					{isGenerating ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
					Regenerate
				</Button>
			);
		}

		// Draft generated → offer regeneration and approval
		if (isDraftAwaitingReview) {
			return (
				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRegenerateTimeline}
						disabled={isRegenerating || isApproving}
						className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
					>
						{isRegenerating ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
						Regenerate
					</Button>
					<Button
						variant="secondary"
						size="sm"
						onClick={handleApproveTimeline}
						disabled={isApproving || isRegenerating}
						className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
					>
						{isApproving ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
						Approve Timeline
					</Button>
				</div>
			);
		}

		if (hasGeneratedTimeline) {
			return null;
		}

		// Preview only → offer generation
		return (
			<Button
				variant="default"
				size="sm"
				onClick={handleGenerateTimeline}
				disabled={isGenerating}
				className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
			>
				{isGenerating ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
				Generate Timeline
			</Button>
		);
	};

	const renderDraftReviewPanel = () => {
		if (!isDraftAwaitingReview) {
			return null;
		}

		return (
			<div className="mb-3 rounded-2xl border border-amber-200 bg-amber-50/70 px-4 py-3">
				<div className="flex items-center justify-between gap-3">
					<div>
						<p className="mt-1 text-sm text-amber-900">
							Add optional context for the next draft before approving this timeline.
						</p>
					</div>
					<span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700">
						Draft only
					</span>
				</div>
				<div className="mt-2 rounded-2xl border border-amber-200 bg-white px-4 py-2 focus-within:border-amber-300 focus-within:ring-2 focus-within:ring-amber-200/60 transition-all">
					<textarea
						ref={draftContextRef}
						rows={1}
						value={draftContext}
						onChange={(event) => setDraftContext(event.target.value)}
						placeholder="Optional: tighten sequencing, reflect local constraints, reduce scope, add community milestones, or adjust assumptions."
						className="min-h-[24px] w-full resize-none bg-transparent text-sm leading-relaxed text-neutral-800 outline-none placeholder:text-neutral-400 scrollbar-hide"
					/>
				</div>
			</div>
		);
	};

	const renderTimelineFeedback = () => {
		if (!timelineError) {
			return null;
		}

		return (
			<div className="mb-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
				{timelineError}
			</div>
		);
	};

	const renderActionButtons = () => (
		<div ref={exportDropdownRef} className="relative">
			<Button
				variant="outline"
				size="sm"
				onClick={() => setIsExportOpen((prev) => !prev)}
				disabled={isExporting}
				aria-haspopup="menu"
				aria-expanded={isExportOpen}
				className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
			>
				{isExporting ? (
					<Loader2 size={13} className="animate-spin" />
				) : (
					<Download size={13} />
				)}
				Export
				<ChevronDown
					size={12}
					className={`ml-0.5 text-neutral-400 transition-transform duration-150 ${
						isExportOpen ? "rotate-180" : ""
					}`}
				/>
			</Button>

			{isExportOpen && (
				<div
					role="menu"
					className="absolute bottom-full left-0 z-50 mb-2 min-w-[140px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
				>
					<button
						type="button"
						role="menuitem"
						onClick={() => { void exportPng(); setIsExportOpen(false); }}
						disabled={isExporting}
						className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
					>
						<FileDown size={14} className="shrink-0 text-neutral-400" />
						PNG
					</button>
					<div className="mx-3 h-px bg-neutral-100" />
					<button
						type="button"
						role="menuitem"
						onClick={() => { void exportPdf(); setIsExportOpen(false); }}
						disabled={isExporting}
						className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-neutral-700 transition-colors hover:bg-neutral-50 disabled:opacity-50"
					>
						<FileText size={14} className="shrink-0 text-neutral-400" />
						PDF
					</button>
				</div>
			)}
		</div>
	);

	const renderViewSelector = () => {
		if (displayMode === "fullscreen") {
			return (
				<div className="overflow-x-auto scrollbar-hide">
					<div className="flex items-center gap-2 min-w-max pb-1">
						{VIEW_OPTIONS.map(({ id, label }) => (
							<Button
								key={id}
								variant="outline"
								size="sm"
								onClick={() => setViewMode(id)}
								className={`shrink-0 whitespace-nowrap rounded-full text-xs sm:text-sm px-2.5 sm:px-3 transition-all ${
									viewMode === id
										? "bg-primary-green text-white border-primary-green shadow-md shadow-green-200 hover:bg-primary-green/90 hover:text-white"
										: "text-neutral-500 border-neutral-200 hover:bg-neutral-100"
								}`}
							>
								{label}
							</Button>
						))}
					</div>
				</div>
			);
		}

		const currentOption = VIEW_OPTIONS.find((o) => o.id === viewMode) ?? VIEW_OPTIONS[0];

		return (
			<div ref={viewDropdownRef} className="relative min-w-0 flex justify-end">
				<button
					type="button"
					onClick={() => setIsViewOpen((prev) => !prev)}
					aria-haspopup="listbox"
					aria-expanded={isViewOpen}
					aria-label="Select timeline view strategy"
					className="flex h-10 w-fit items-center gap-2 rounded-full border border-neutral-200 bg-white pl-4 pr-3 text-xs font-semibold text-neutral-700 shadow-sm transition hover:border-neutral-300 hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-green/20"
				>
					<span className="truncate text-left">{currentOption.label}</span>
					<ChevronDown
						size={14}
						className={`shrink-0 text-neutral-400 transition-transform duration-150 ${
							isViewOpen ? "rotate-180" : ""
						}`}
					/>
				</button>

				{isViewOpen && (
					<div
						role="listbox"
						aria-label="View strategy options"
						className="absolute left-0 top-full z-30 mt-1.5 w-full min-w-[180px] overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl"
					>
						{VIEW_OPTIONS.map(({ id, label }) => (
							<button
								key={id}
								type="button"
								role="option"
								aria-selected={viewMode === id}
								onClick={() => { setViewMode(id); setIsViewOpen(false); }}
								className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors ${
									viewMode === id
										? "bg-emerald-50 text-primary-green"
										: "text-neutral-600 hover:bg-neutral-50"
								}`}
							>
								
								{label}
							</button>
						))}
					</div>
				)}
			</div>
		);
	};

	const tab = (
		<div className="h-full min-h-0 flex flex-col">
			<div className="sm:px-2 lg:px-6 shrink-0 border-b border-neutral-100 py-4">
				{displayMode === "sidebar" ? (
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2 min-w-0">
							<span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400 whitespace-nowrap">
								View Strategy
							</span>
							<span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
								reviewStatusLabel === "Approved"
									? "bg-emerald-100 text-emerald-700"
									: reviewStatusLabel.includes("Draft")
										? "bg-amber-100 text-amber-700"
										: "bg-neutral-100 text-neutral-500"
							}`}>
								{reviewStatusLabel}
							</span>
						</div>
						<div className="w-[172px] shrink-0">
							{renderViewSelector()}
						</div>
					</div>
				) : (
					<div className="flex items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<LayoutPanelTop size={14} className="text-neutral-400" />
							<span className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
								View Strategy
							</span>
							<span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
								reviewStatusLabel === "Approved"
									? "bg-emerald-100 text-emerald-700"
									: reviewStatusLabel.includes("Draft")
										? "bg-amber-100 text-amber-700"
										: "bg-neutral-100 text-neutral-500"
							}`}>
								{reviewStatusLabel}
							</span>
						</div>
						{renderViewSelector()}
					</div>
				)}
			</div>

			<div className="sm:px-2 lg:px-6 flex-1 min-h-0 overflow-y-auto py-2 scrollbar-hide">
				{renderViewSurface()}
			</div>

			<div className="shrink-0 border-t border-neutral-100 px-4 py-3 sm:p-4 bg-white">
				{renderDraftReviewPanel()}
				{renderTimelineFeedback()}
				<div className="flex items-center justify-between gap-2">
					{renderActionButtons()}
					{renderPrimaryActionButtons()}
				</div>
			</div>

		</div>
	);

	return tab;
}
