import type { ExportCollection, ExportOptions } from "./types";
import { toPostmanCollection } from "./postman";
import { toCurlCommands } from "./curl";
import { toHar } from "./har";

export function exportCollection(collection: ExportCollection, options: ExportOptions): string {
  switch (options.format) {
    case "postman":
      return JSON.stringify(toPostmanCollection(collection, options), null, 2);
    case "curl":
      return toCurlCommands(collection);
    case "har":
      return JSON.stringify(toHar(collection), null, 2);
    default:
      throw new Error(`Unsupported export format: ${options.format}`);
  }
}
