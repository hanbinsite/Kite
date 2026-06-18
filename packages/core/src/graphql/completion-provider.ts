import type { CompletionSource, Completion } from "@codemirror/autocomplete";
import type { GraphQLSchemaInfo, GqlField, GqlArg } from "./schema-parser";
import { getRootQueryFields, getRootMutationFields, getEnumValues, getTypeFields, typeRefToString } from "./schema-parser";

const KEYWORDS: Completion[] = [
  { label: "query", type: "keyword", boost: 3, detail: "query operation" },
  { label: "mutation", type: "keyword", boost: 3, detail: "mutation operation" },
  { label: "subscription", type: "keyword", boost: 3, detail: "subscription operation" },
  { label: "fragment", type: "keyword", boost: 2, detail: "fragment definition" },
  { label: "on", type: "keyword", boost: 2, detail: "type condition" },
  { label: "__typename", type: "property", boost: 2, detail: "meta field: String" },
  { label: "__schema", type: "property", boost: 1, detail: "schema introspection field" },
  { label: "__type", type: "property", boost: 1, detail: "type introspection field" },
];

function makeFieldCompletion(field: GqlField, boost: number = 1): Completion {
  return {
    label: field.name,
    type: "property",
    detail: `${typeRefToString(field.type)}${field.description ? ` — ${field.description}` : ""}`,
    boost,
  };
}

function makeArgCompletion(arg: GqlArg, boost: number = 1): Completion {
  return {
    label: arg.name,
    type: "property",
    detail: `${typeRefToString(arg.type)}${arg.description ? ` — ${arg.description}` : ""}`,
    boost,
  };
}

function getEnumArgType(
  text: string,
  pos: number,
): { fieldName: string; argName: string } | null {
  const before = text.slice(0, pos);
  const lineStartIdx = before.lastIndexOf("\n") + 1;
  const lineText = before.slice(lineStartIdx);
  const parenIdx = lineText.lastIndexOf("(");
  if (parenIdx < 0) return null;
  const afterParen = lineText.slice(parenIdx + 1);
  const lastEqIdx = afterParen.lastIndexOf(":");
  if (lastEqIdx < 0) return null;
  const beforeEq = afterParen.slice(0, lastEqIdx).trim().split(/\s+/);
  const argName = beforeEq[beforeEq.length - 1];
  if (!argName) return null;
  const beforeParen = lineText.slice(0, parenIdx).trim();
  const words = beforeParen.split(/\s+/);
  const fieldName = words[words.length - 1];
  if (!fieldName) return null;
  return { fieldName, argName };
}

/**
 * Walk the text to find the current type context.
 * Resolves field chains like `repository {...}` where we need to look up `repository`'s return type.
 */
function resolveParentType(
  schema: GraphQLSchemaInfo,
  text: string,
  pos: number,
): string | null {
  const before = text.slice(0, pos);

  // Find the nearest opening brace position looking backward
  let openCount = 0;
  let bracePos = -1;
  for (let i = before.length - 1; i >= 0; i--) {
    if (before[i] === "}") openCount++;
    else if (before[i] === "{") {
      if (openCount === 0) {
        bracePos = i;
        break;
      }
      openCount--;
    }
  }

  if (bracePos < 0) return null;

  // Find the word right before the brace
  const beforeBrace = before.slice(0, bracePos).trimEnd();
  const words = beforeBrace.split(/\s+/);
  const lastWord = words[words.length - 1];

  if (!lastWord || lastWord === "{" || lastWord === "," || lastWord === "(" || lastWord === ")") return null;

  // lastWord is a field name or type name (after `on`)
  if (lastWord === "on") {
    const typeName = words[words.length - 2];
    return typeName || null;
  }

  // We need to find the parent type by walking up the field chain
  // Recurse: find the type that contains `lastWord` as a field
  const parentType = resolveParentType(schema, text, bracePos);
  if (parentType) {
    const parentFields = getTypeFields(schema, parentType);
    const field = parentFields.find((f) => f.name === lastWord);
    if (field) {
      // Unwrap NON_NULL/LIST to get the underlying type
      let ftype = field.type;
      while (ftype.ofType && (ftype.kind === "NON_NULL" || ftype.kind === "LIST")) {
        ftype = ftype.ofType;
      }
      if (ftype.name && schema.types[ftype.name]) {
        return ftype.name;
      }
    }
  } else {
    // Top level — check root query and mutation fields
    const rootFields = [...getRootQueryFields(schema), ...getRootMutationFields(schema)];
    const field = rootFields.find((f) => f.name === lastWord);
    if (field) {
      let ftype = field.type;
      while (ftype.ofType && (ftype.kind === "NON_NULL" || ftype.kind === "LIST")) {
        ftype = ftype.ofType;
      }
      if (ftype.name && schema.types[ftype.name]) {
        return ftype.name;
      }
    }
  }

  return null;
}

export function graphqlCompletionSource(schema: GraphQLSchemaInfo): CompletionSource {
  const rootQueryFields = getRootQueryFields(schema);
  const rootMutationFields = getRootMutationFields(schema);

  return (context) => {
    const word = context.matchBefore(/\w*/);
    if (!word) return null;

    const from = word.from;
    const filter = word.text.toLowerCase();
    const docText = context.state.doc.toString();
    const pos = context.pos;

    // 1. Check for enum value completions (after `:` in args)
    const enumCtx = getEnumArgType(docText, pos);
    if (enumCtx) {
      // Find the field with these args
      const allFields = [...rootQueryFields, ...rootMutationFields];
      // also check nested contexts
      const parentType = resolveParentType(schema, docText, pos);
      let fieldsToCheck = allFields;
      if (parentType) {
        fieldsToCheck = getTypeFields(schema, parentType);
      }
      const field = fieldsToCheck.find((f) => f.name === enumCtx.fieldName);
      if (field) {
        const arg = field.args.find((a) => a.name === enumCtx.argName);
        if (arg) {
          let argType = arg.type;
          while (argType.ofType && (argType.kind === "NON_NULL" || argType.kind === "LIST")) {
            argType = argType.ofType;
          }
          if (argType.name) {
            const enumVals = getEnumValues(schema, argType.name);
            const options = enumVals
              .filter((v) => !filter || v.toLowerCase().includes(filter))
              .map((v) => ({
                label: v,
                type: "enum" as const,
                detail: argType.name,
                boost: 2,
              }));
            if (options.length) return { from, options, validFor: /^\w*$/ };
          }
        }
      }
    }

    // 2. Check if we're inside args `field(...` — complete arg names
    const before = docText.slice(0, pos);
    const lastNewlineIdx = before.lastIndexOf("\n") + 1;
    const lineText = before.slice(lastNewlineIdx);
    const parenIdx = lineText.lastIndexOf("(");
    const closeParenIdx = lineText.lastIndexOf(")");
    if (parenIdx > closeParenIdx) {
      const beforeParen = lineText.slice(0, parenIdx).trim();
      const words = beforeParen.split(/\s+/);
      const fieldName = words[words.length - 1];
      if (fieldName && !new Set(["query", "mutation", "subscription", "fragment", "on"]).has(fieldName)) {
        const allFields = [...rootQueryFields, ...rootMutationFields];
        const parentType = resolveParentType(schema, docText, pos);
        let fieldsToCheck = allFields;
        if (parentType) {
          fieldsToCheck = getTypeFields(schema, parentType);
        }
        const matchField = fieldsToCheck.find((f) => f.name === fieldName);
        if (matchField && matchField.args.length > 0) {
          const argsAfter = lineText.slice(parenIdx + 1);
          const lastCommaIdx = argsAfter.lastIndexOf(",");
          // Don't suggest if we're after `:` (already handled by enum check)
          const afterLastComma = argsAfter.slice(lastCommaIdx + 1).trim();
          if (afterLastComma.includes(":")) return null;

          const options = matchField.args
            .filter((a) => !filter || a.name.toLowerCase().includes(filter))
            .map((a) => makeArgCompletion(a));
          if (options.length) return { from, options, validFor: /^\w*$/ };
        }
      }
    }

    // 3. Determine if we're at a position where field completions make sense
    const trimmedBefore = before.trimEnd();
    const isAfterOpenOrComma =
      trimmedBefore.endsWith("{") ||
      trimmedBefore.endsWith(",") ||
      trimmedBefore === "";

    if (isAfterOpenOrComma) {
      const parentType = resolveParentType(schema, docText, pos);

      if (parentType) {
        const typeFields = getTypeFields(schema, parentType);
        const options = typeFields
          .filter((f) => !filter || f.name.toLowerCase().includes(filter))
          .map((f) => makeFieldCompletion(f, 2));
        if (options.length) return { from, options, validFor: /^\w*$/ };
      } else {
        // Top level — determine if query or mutation context
        const isMutation = before.includes("mutation");
        const fields = isMutation ? rootMutationFields : rootQueryFields;
        const options = fields
          .filter((f) => !filter || f.name.toLowerCase().includes(filter))
          .map((f) => makeFieldCompletion(f, 2));
        if (options.length) return { from, options, validFor: /^\w*$/ };
      }
    }

    // 4. Check for `... on ` pattern — suggest type names
    if (trimmedBefore.endsWith("... on ")) {
      const typeOptions: Completion[] = [];
      for (const typeName of Object.keys(schema.types)) {
        const t = schema.types[typeName];
        if (t && (t.kind === "OBJECT" || t.kind === "INTERFACE" || t.kind === "UNION")) {
          typeOptions.push({ label: typeName, type: "type", detail: t.kind, boost: 2 });
        }
      }
      return { from: pos - filter.length, options: typeOptions, validFor: /^\w*$/ };
    }

    // 5. Always suggest keywords at word boundary
    if (trimmedBefore === "" || /[\s{(,]$/.test(trimmedBefore)) {
      const kwOptions = KEYWORDS.filter(
        (k) => !filter || k.label.toLowerCase().includes(filter),
      );
      if (kwOptions.length) return { from, options: kwOptions, validFor: /^\w*$/ };
    }

    return null;
  };
}