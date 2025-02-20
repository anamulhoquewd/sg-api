export const schemaValidationError = (error: any, msg: string) => ({
  msg,
  fields: error.issues.map((issue: any) => ({
    name: String(issue.path[0]),
    message: issue.message,
  })),
});
