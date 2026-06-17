export interface AnalysisReport {
  summary: string;
  missingTests: string[];
  missingDocs: string[];
  authInconsistencies: string[];
  hardcodedUrls: string[];
  duplicateEndpoints: string[];
}

export function buildAnalysisContext(requests: Array<{
  name: string;
  method: string;
  url: string;
  auth?: { type?: string } | null;
  docs?: string;
  hasTests?: boolean;
}>): string {
  const parts: string[] = ["=== Collection Analysis Context ===", ""];
  parts.push(`Total endpoints: ${requests.length}`);

  const methods = requests.map((r) => r.method);
  parts.push(`Methods: ${[...new Set(methods)].join(", ")}`);

  const noTest = requests.filter((r) => !r.hasTests);
  if (noTest.length > 0) {
    parts.push(
      `Endpoints without tests (${noTest.length}): ${noTest.map((r) => `${r.method} ${r.url}`).join(", ")}`,
    );
  }

  const noDoc = requests.filter((r) => !r.docs);
  if (noDoc.length > 0) {
    parts.push(
      `Endpoints without docs (${noDoc.length}): ${noDoc.map((r) => `${r.method} ${r.url}`).join(", ")}`,
    );
  }

  const authTypes = new Set(requests.filter((r) => r.auth?.type).map((r) => r.auth!.type));
  if (authTypes.size > 1) {
    parts.push(`Multiple auth types: ${[...authTypes].join(", ")}`);
  }

  const hardcoded = requests.filter(
    (r) => r.url.includes("http://") || r.url.includes("https://"),
  );
  if (hardcoded.length > 0) {
    parts.push(`Hardcoded URLs detected in ${hardcoded.length} endpoints`);
  }

  return parts.join("\n");
}
