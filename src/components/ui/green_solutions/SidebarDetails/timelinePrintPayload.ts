import type { CostEstimate } from "@/types/green_solutions";
import type { TimelinePlan } from "./TimelineTab/types";

export const TIMELINE_PRINT_STORAGE_PREFIX = "timeline-print:";

export interface TimelinePdfTask {
	id: string;
	title: string;
	description: string;
	startDate: Date;
	endDate: Date;
}

export interface TimelinePdfPhase {
	id: string;
	title: string;
	subtitle: string;
	startDate: Date;
	endDate: Date;
	tasks: TimelinePdfTask[];
}

export interface TimelinePdfPlan {
	objective: string;
	locationLabel: string;
	generatedAt: Date;
	constraints: string[];
	phases: TimelinePdfPhase[];
}

interface SerializedTimelinePdfTask {
	id: string;
	title: string;
	description: string;
	startDate: string;
	endDate: string;
}

interface SerializedTimelinePdfPhase {
	id: string;
	title: string;
	subtitle: string;
	startDate: string;
	endDate: string;
	tasks: SerializedTimelinePdfTask[];
}

interface SerializedTimelinePdfPlan {
	objective: string;
	locationLabel: string;
	generatedAt: string;
	constraints: string[];
	phases: SerializedTimelinePdfPhase[];
}

export interface TimelinePrintPayload {
	title: string;
	plan: TimelinePdfPlan;
	costEstimate: CostEstimate | null;
}

function toSerializablePlan(plan: TimelinePdfPlan | TimelinePlan): SerializedTimelinePdfPlan {
	return {
		objective: plan.objective,
		locationLabel: plan.locationLabel,
		generatedAt: plan.generatedAt.toISOString(),
		constraints: [...plan.constraints],
		phases: plan.phases.map((phase) => ({
			id: phase.id,
			title: phase.title,
			subtitle: phase.subtitle,
			startDate: phase.startDate.toISOString(),
			endDate: phase.endDate.toISOString(),
			tasks: phase.tasks.map((task) => ({
				id: task.id,
				title: task.title,
				description: task.description,
				startDate: task.startDate.toISOString(),
				endDate: task.endDate.toISOString(),
			})),
		})),
	};
}

export function serializeTimelinePrintPayload(payload: TimelinePrintPayload): string {
	return JSON.stringify({
		title: payload.title,
		plan: toSerializablePlan(payload.plan),
		costEstimate: payload.costEstimate ?? null,
	});
}

export function deserializeTimelinePrintPayload(raw: string): TimelinePrintPayload | null {
	try {
		const parsed = JSON.parse(raw) as {
			title?: unknown;
			plan?: SerializedTimelinePdfPlan;
			costEstimate?: CostEstimate | null;
		};

		if (!parsed || typeof parsed.title !== "string" || !parsed.plan) {
			return null;
		}

		const plan = parsed.plan;
		if (
			typeof plan.objective !== "string" ||
			typeof plan.locationLabel !== "string" ||
			typeof plan.generatedAt !== "string" ||
			!Array.isArray(plan.constraints) ||
			!Array.isArray(plan.phases)
		) {
			return null;
		}

		return {
			title: parsed.title,
			costEstimate: parsed.costEstimate ?? null,
			plan: {
				objective: plan.objective,
				locationLabel: plan.locationLabel,
				generatedAt: new Date(plan.generatedAt),
				constraints: plan.constraints.filter((item): item is string => typeof item === "string"),
				phases: plan.phases.map((phase) => ({
					id: phase.id,
					title: phase.title,
					subtitle: phase.subtitle,
					startDate: new Date(phase.startDate),
					endDate: new Date(phase.endDate),
					tasks: Array.isArray(phase.tasks)
						? phase.tasks.map((task) => ({
							id: task.id,
							title: task.title,
							description: task.description,
							startDate: new Date(task.startDate),
							endDate: new Date(task.endDate),
						}))
						: [],
				})),
			},
		};
	} catch {
		return null;
	}
}
