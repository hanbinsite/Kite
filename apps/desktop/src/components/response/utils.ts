export function getStatusClass(status: number): string {
  if (status >= 200 && status < 300) return "text-accent-success bg-accent-success/12";
  if (status >= 300 && status < 400) return "text-accent-info bg-accent-info/12";
  if (status >= 400 && status < 500) return "text-accent-warning bg-accent-warning/12";
  return "text-accent-danger bg-accent-danger/12";
}
