export const QUERY_KEYS = {
  // Dashboard
  dashboardStats: ["dashboard", "stats"] as const,
  movementTrends: ["dashboard", "movementTrends"] as const,
  cameraActivity: ["dashboard", "cameraActivity"] as const,
  cameraFeeds: ["dashboard", "cameraFeeds"] as const,
  failedDetections: ["dashboard", "failedDetections"] as const,

  // Cameras
  cameras: (search?: string) => ["cameras", search] as const,

  // Employees
  employees: (search?: string) => ["employees", search] as const,
  employeeStats: ["employees", "stats"] as const,
  employee: (code: string) => ["employees", code] as const,

  // Movement logs
  movementLogs: (params: object) => ["movement-logs", params] as const,
  employeeTimeline: (code: string, date?: string) => ["movement-logs", "timeline", code, date] as const,

  // Face mapping
  mappedFaces: (search?: string) => ["face-mapping", "mapped", search] as const,
  unmappedFaces: (params: object) => ["face-mapping", "unmapped", params] as const,
  employeePool: ["face-mapping", "pool"] as const,
  employeeImages: (code: string) => ["face-mapping", "employee-images", code] as const,

  // Users
  users: (search?: string) => ["users", search] as const,

  // Reports
  employeeReport: (params: object) => ["reports", "employee", params] as const,
  cameraReport: (params: object) => ["reports", "camera", params] as const,
  timeSpentReport: ["reports", "time-spent"] as const,
  reportFailedSummary: (params: object) => ["reports", "failed-summary", params] as const,
};
