import type { ImportResult, ImportFormat } from "./types";
import { detectFormat } from "./detect";
import { parseCurl } from "./curl";
import { parsePostman } from "./postman";
import { parseHar } from "./har";

export function importCollection(content: string): ImportResult {
  const format = detectFormat(content);

  switch (format) {
    case "curl":
      return parseCurl(content);
    case "postman":
      return parsePostman(content);
    case "har":
      return parseHar(content);
    default:
      return {
        format: "unknown" as ImportFormat,
        collectionName: "Unknown Import",
        requests: [],
        errors: ["Unable to detect import format. Supported formats: cURL, Postman Collection v2.x, HAR 1.2"],
      };
  }
}
