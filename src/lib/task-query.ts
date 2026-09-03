import { TASK_ASSIGNEE_INCLUDE } from "@/lib/task-assignees";
import { TASK_DEP_INCLUDE } from "@/lib/task-deps";

export const TASK_INCLUDE = {
  ...TASK_DEP_INCLUDE,
  ...TASK_ASSIGNEE_INCLUDE,
} as const;
