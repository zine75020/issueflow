export type Status = "TODO" | "IN_PROGRESS" | "DONE";
export type Severity = "CRITICAL" | "MAJOR" | "MINOR";

export interface BoardColumn {
  id: string;
  name: string;
  order: number;
  isLocked: boolean;
}

export interface Epic {
  id: string;
  title: string;
  description: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
  _count?: { stories: number };
}

export interface Story {
  id: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  storyPoints: number | null;
  remainingEffort: number | null;
  statusColumnId: string;
  epicId: string | null;
  sprintId: string | null;
  backlogPosition: number;
  createdAt: string;
  updatedAt: string;
}

export interface Bug {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  remainingEffort: number | null;
  statusColumnId: string;
  sprintId: string | null;
  backlogPosition: number;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
  completedAt: string | null;
  createdAt: string;
  _count?: { stories: number; bugs: number };
  workingDays?: number;
  nonWorkingDays?: number;
  pointsCommitted?: number;
  pointsDone?: number;
  itemsCommitted?: number;
  itemsDone?: number;
}

export interface SprintDetail extends Sprint {
  stories: Story[];
  bugs: Bug[];
}

export interface Comment {
  id: string;
  content: string;
  storyId: string | null;
  bugId: string | null;
  createdAt: string;
}
