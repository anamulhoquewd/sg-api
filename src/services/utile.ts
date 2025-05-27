export const schemaValidationError = (error: any, message: string) => ({
  message,
  fields: error.issues.map((issue: any) => ({
    name: String(issue.path[0]),
    message: issue.message,
  })),
});

export function calculatePercentage(current: number, previous: number) {
  if (previous === 0) {
    return current > 0 ? "100.00" : "0.00";
  }
  const change = ((current - previous) / previous) * 100;
  return change.toFixed(2);
}
