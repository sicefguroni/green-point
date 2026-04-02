"use client";

import { useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import {
	CalendarDays,
	Download,
	FileDown,
	FileText,
	LayoutPanelTop,
	ListChecks,
	Sprout,
	Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	type ChatHistoryMessage,
	type GreenRecommendation,
} from "@/types/green_solutions";
import { type SelectedFeature } from "@/types/metrics";
import RoadmapView from "./TimelineTab/views/RoadmapView";
import GanttView from "./TimelineTab/views/GanttView";
import PdfPreviewView from "./TimelineTab/views/PdfPreviewView";
import { type TimelinePlan, type TimelinePhase, type TimelineTask } from "./TimelineTab/types";

type ViewMode = "DEFAULT" | "GANTT" | "PDF";

interface TimelineTabProps {
	selectedRecommendation: GreenRecommendation;
	selectedFeature?: SelectedFeature;
	chatHistory?: ChatHistoryMessage[];
}

const VIEW_OPTIONS: {
	id: ViewMode;
	label: string;
	Icon: React.ElementType;
}[] = [
	{ id: "DEFAULT", label: "Step-by-Step", Icon: ListChecks },
	{ id: "GANTT", label: "Gantt Chart", Icon: CalendarDays },
	{ id: "PDF", label: "PDF Preview", Icon: FileText },
];

const DAY_MS = 1000 * 60 * 60 * 24;

function addDays(start: Date, days: number) {
	const value = new Date(start);
	value.setDate(value.getDate() + days);
	return value;
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
	recommendation: GreenRecommendation,
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
	recommendation: GreenRecommendation,
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
			days: 14,
		},
		{
			id: "P2",
			title: "Planting and Installation",
			subtitle: "Execute site work and intervention deployment",
			icon: Sprout,
			days: 28,
		},
		{
			id: "P3",
			title: "Maintenance and Monitoring",
			subtitle: "Stabilize outcomes through routine care and tracking",
			icon: Wrench,
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
		phases,
	};
}

export default function TimelineTab({
	selectedRecommendation,
	selectedFeature,
	chatHistory = [],
}: TimelineTabProps) {
	const [viewMode, setViewMode] = useState<ViewMode>("DEFAULT");
	const [isExporting, setIsExporting] = useState(false);
	const viewRef = useRef<HTMLDivElement>(null);

	const plan = useMemo(
		() => buildTimelinePlan(selectedRecommendation, chatHistory, selectedFeature),
		[selectedRecommendation, chatHistory, selectedFeature],
	);

	const durationDays = useMemo(() => {
		const first = plan.phases[0]?.startDate;
		const last = plan.phases[plan.phases.length - 1]?.endDate;
		if (!first || !last) return 0;
		return Math.round((last.getTime() - first.getTime()) / DAY_MS) + 1;
	}, [plan]);

	const baseFileName = selectedRecommendation.solutionTitle
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");

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

	return (
		<div className="h-full flex flex-col">
			<div className="sm:px-2 lg:px-6 shrink-0 border-b border-neutral-100 py-4 space-y-3">
				<div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-neutral-400">
					<LayoutPanelTop size={14} />
					View Strategy
				</div>

				<div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
					<div className="flex items-center gap-2 min-w-max pb-1">
						{VIEW_OPTIONS.map(({ id, label, Icon }) => (
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
								<Icon size={13} />
								{label}
							</Button>
						))}
					</div>
				</div>

				<div className="grid grid-cols-2 gap-2 text-xs">
					<div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
						<p className="text-neutral-500">Estimated Duration</p>
						<p className="font-bold text-neutral-800">{durationDays} days</p>
					</div>
					<div className="rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
						<p className="text-neutral-500">Phases</p>
						<p className="font-bold text-neutral-800">{plan.phases.length} major phases</p>
					</div>
				</div>
			</div>

			<div className="sm:px-2 lg:px-6 flex-1 overflow-y-auto py-2 scrollbar-hide">
				<div ref={viewRef} className="rounded-2xl bg-white">
					{viewMode === "DEFAULT" && <RoadmapView plan={plan} />}
					{viewMode === "GANTT" && <GanttView plan={plan} />}
					{viewMode === "PDF" && <PdfPreviewView plan={plan} />}
				</div>
			</div>

			<div className="shrink-0 border-t border-neutral-100 px-4 py-3 sm:p-4 bg-white">
				<div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto scrollbar-hide">
					<div className="flex items-center gap-2 min-w-max">
					<Button
						variant="secondary"
						size="sm"
						onClick={exportCurrentView}
						disabled={isExporting}
						className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
					>
						<Download size={13} />
						{viewMode === "GANTT" ? "Export Current (.png)" : "Export Current (.pdf)"}
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={exportPng}
						disabled={isExporting}
						className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
					>
						<FileDown size={13} />
						PNG
					</Button>
					<Button
						variant="outline"
						size="sm"
						onClick={exportPdf}
						disabled={isExporting}
						className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-2.5 sm:px-3"
					>
						<FileText size={13} />
						PDF
					</Button>
					</div>
				</div>
			</div>
		</div>
	);
}
