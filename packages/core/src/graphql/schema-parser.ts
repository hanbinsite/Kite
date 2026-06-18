export interface GraphQLSchemaInfo {
  types: Record<string, GqlType>;
  queryType: string;
  mutationType: string | null;
}

export interface GqlType {
  kind: string;
  fields: GqlField[];
  enumValues: string[] | null;
}

export interface GqlField {
  name: string;
  description: string | null;
  args: GqlArg[];
  type: GqlFieldType;
}

export interface GqlArg {
  name: string;
  description: string | null;
  type: GqlFieldType;
}

export interface GqlFieldType {
  kind: string;
  name: string;
  ofType: GqlFieldType | null;
}

interface IntrospectionFullType {
  kind: string;
  name: string | null;
  description?: string | null;
  fields?: IntrospectionField[] | null;
  inputFields?: IntrospectionInputValue[] | null;
  enumValues?: IntrospectionEnumValue[] | null;
}

interface IntrospectionField {
  name: string;
  description?: string | null;
  args: IntrospectionInputValue[];
  type: IntrospectionTypeRef;
}

interface IntrospectionInputValue {
  name: string;
  description?: string | null;
  type: IntrospectionTypeRef;
}

interface IntrospectionEnumValue {
  name: string;
  description?: string | null;
}

interface IntrospectionTypeRef {
  kind: string;
  name: string | null;
  ofType: IntrospectionTypeRef | null;
}

function parseTypeRef(raw: IntrospectionTypeRef): GqlFieldType {
  return {
    kind: raw.kind,
    name: raw.name ?? "",
    ofType: raw.ofType ? parseTypeRef(raw.ofType) : null,
  };
}

function typeRefToString(tref: GqlFieldType): string {
  if (tref.kind === "NON_NULL") {
    return typeRefToString(tref.ofType!) + "!";
  }
  if (tref.kind === "LIST") {
    return "[" + typeRefToString(tref.ofType!) + "]";
  }
  return tref.name;
}

export { typeRefToString };

export function parseIntrospectionSchema(raw: unknown): GraphQLSchemaInfo {
  const data = raw as Record<string, unknown>;
  const schema = data?.__schema as Record<string, unknown> | undefined;
  if (!schema) throw new Error("Invalid introspection response: missing __schema");

  const queryType = (schema.queryType as Record<string, unknown>)?.name as string ?? "Query";
  const mutationType =
    ((schema.mutationType as Record<string, unknown> | null)?.name as string) ?? null;

  const typesRaw = (schema.types as IntrospectionFullType[]) ?? [];
  const types: Record<string, GqlType> = {};

  for (const t of typesRaw) {
    if (!t.name) continue;

    let fields: GqlField[] = [];
    const rawFieldList = t.fields ?? null;
    const rawInputFieldList = t.inputFields ?? null;

    if (rawFieldList) {
      fields = rawFieldList.map((f) => ({
        name: f.name,
        description: f.description ?? null,
        args: (f.args ?? []).map((a) => ({
          name: a.name,
          description: a.description ?? null,
          type: parseTypeRef(a.type),
        })),
        type: parseTypeRef(f.type),
      }));
    } else if (rawInputFieldList) {
      fields = rawInputFieldList.map((f) => ({
        name: f.name,
        description: f.description ?? null,
        args: [],
        type: parseTypeRef(f.type),
      }));
    }

    let enumValues: string[] | null = null;
    if (t.enumValues) {
      enumValues = t.enumValues.map((ev: IntrospectionEnumValue) => ev.name);
    }

    types[t.name] = {
      kind: t.kind,
      fields,
      enumValues,
    };
  }

  return { types, queryType, mutationType };
}

export function getTypeFields(
  schema: GraphQLSchemaInfo,
  typeName: string,
): GqlField[] {
  return schema.types[typeName]?.fields ?? [];
}

export function getRootQueryFields(schema: GraphQLSchemaInfo): GqlField[] {
  return getTypeFields(schema, schema.queryType);
}

export function getRootMutationFields(schema: GraphQLSchemaInfo): GqlField[] {
  return schema.mutationType ? getTypeFields(schema, schema.mutationType) : [];
}

export function getEnumValues(schema: GraphQLSchemaInfo, typeName: string): string[] {
  return schema.types[typeName]?.enumValues ?? [];
}