export const ApiPaths = {
  health: "/api/health",
  login: "/api/auth/login",
  me: "/api/auth/me",
  logout: "/api/auth/logout",
  docs: "/api/docs",
  tags: "/api/tags",
  lessons: "/api/lessons",
  lesson: "/api/lessons/:id",
  adminTags: "/api/admin/tags",
  adminTag: "/api/admin/tags/:id",
  adminLessons: "/api/admin/lessons",
  adminLesson: "/api/admin/lessons/:id",
  adminLessonPublish: "/api/admin/lessons/:id/publish",
  adminLessonUnpublish: "/api/admin/lessons/:id/unpublish",
  practiceLogs: "/api/practice-logs",
  statsDaily: "/api/stats/daily",
  statsWeekly: "/api/stats/weekly",
} as const;

/** Replaces the `:id` segment of a path template. */
export const withId = (path: string, id: string): string =>
  path.replace(":id", () => encodeURIComponent(id));
