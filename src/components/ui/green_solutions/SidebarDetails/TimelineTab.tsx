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
import {
	type ChatHistoryMessage,
} from "@/types/green_solutions";
import { type UIRecommendation } from "@/lib/recommendations";
import { type SelectedFeature } from "@/types/metrics";
import {
	type Phase as TimelinePhaseContract,
	type TimelineCategory,
	type TimelineGenerateRequest,
	type TimelineGenerateResponse,
	type TimelineApproveResponse,
	type TimelineRecord,
} from "@/types/timeline";
import RoadmapView from "./TimelineTab/views/RoadmapView";
import GanttView from "./TimelineTab/views/GanttView";
import PdfPreviewView from "./TimelineTab/views/PdfPreviewView";
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
	chatHistory?: ChatHistoryMessage[];
	displayMode?: "sidebar" | "fullscreen";
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
	chatHistory = [],
	displayMode = "sidebar",
}: TimelineTabProps) {
	const [timelineRecord, setTimelineRecord] = useState<TimelineRecord | null>(null);
	const [timelineError, setTimelineError] = useState<string | null>(null);
	const [isGenerating, setIsGenerating] = useState(false);
	const [isApproving, setIsApproving] = useState(false);
	const [viewMode, setViewMode] = useState<ViewMode>("DEFAULT");
	const [isExporting, setIsExporting] = useState(false);
	const [isExportOpen, setIsExportOpen] = useState(false);
	const [isViewOpen, setIsViewOpen] = useState(false);
	const viewRef = useRef<HTMLDivElement>(null);
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
	const activeRisks = timelineRecord?.timeline.risks ?? [];
	const reviewStatusLabel = timelineRecord
		? timelineRecord.reviewStatus === "approved"
			? "Approved"
			: "Draft awaiting review"
		: "Preview only";

	useEffect(() => {
		setTimelineRecord(null);
		setTimelineError(null);
		setViewMode("DEFAULT");
	}, [selectedRecommendation.id, selectedFeature?.name, selectedFeature?.address, selectedFeature?.barangay]);

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
		},
		location: selectedFeature
			? {
				name: selectedFeature.name,
				address: selectedFeature.address,
				barangay: selectedFeature.barangay,
			}
			: undefined,
		chatHistory,
	};

	const exportNodeAsImage = async (fileName: string) => {
		if (!viewRef.current) return;

		const canvas = await html2canvas(viewRef.current, {
			backgroundColor: "#ffffff",
			scale: 2,
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
			scale: 2,
		});
		const imageData = canvas.toDataURL("image/png");
		const pdf = new jsPDF({
			orientation: canvas.width > canvas.height ? "landscape" : "portrait",
			unit: "px",
			format: [canvas.width, canvas.height],
		});
		pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
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

			setTimelineRecord(result.data);
		} catch (error) {
			setTimelineError(
				error instanceof Error ? error.message : "Failed to generate timeline.",
			);
		} finally {
			setIsGenerating(false);
		}
	};

	const handleApproveTimeline = async () => {
		if (!timelineRecord || isApproving) return;

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

			setTimelineRecord(result.data);
		} catch (error) {
			setTimelineError(
				error instanceof Error ? error.message : "Failed to approve timeline.",
			);
		} finally {
			setIsApproving(false);
		}
	};

	const renderActiveView = () => {
		if (viewMode === "DEFAULT") {
			return <RoadmapView plan={plan} displayMode={displayMode} />;
		}

		if (viewMode === "GANTT") {
			return <GanttView plan={plan} displayMode={displayMode} />;
		}

		return <PdfPreviewView plan={plan} displayMode={displayMode} />;
	};

	const renderPrimaryActionButtons = () => {
		// Approved → offer regeneration
		if (timelineRecord?.reviewStatus === "approved") {
			return (
				<Button
					variant="outline"
					size="sm"
					onClick={handleGenerateTimeline}
					disabled={isGenerating}
					className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
				>
					{isGenerating ? <Loader2 size={13} className="animate-spin" /> : <ListChecks size={13} />}
					Regenerate
				</Button>
			);
		}

		// Draft generated → offer approval
		if (hasGeneratedTimeline) {
			return (
				<Button
					variant="secondary"
					size="sm"
					onClick={handleApproveTimeline}
					disabled={isApproving}
					className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
				>
					{isApproving ? <Loader2 size={13} className="animate-spin" /> : <BadgeCheck size={13} />}
					Approve Timeline
				</Button>
			);
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

	return (
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
					<div className="space-y-3">
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
				<div ref={viewRef} className="rounded-2xl bg-white">
					{renderActiveView()}
				</div>
			</div>

			<div className="shrink-0 border-t border-neutral-100 px-4 py-3 sm:p-4 bg-white">
				<div className="flex items-center justify-between gap-2">
					{renderActionButtons()}
					{renderPrimaryActionButtons()}
				</div>
			</div>
		</div>
	);
}
