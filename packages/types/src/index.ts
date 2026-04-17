// HTTP Types
export interface HttpRequestConfig {
  id: string;
  name: string;
  description?: string;
  method: HttpMethod;
  url: string;
  headers: Header[];
  params: QueryParam[];
  body?: BodyConfig;
  auth?: AuthConfig;
  preRequestScript?: string;
  postResponseScript?: string;
  settings: RequestSettings;
}

export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";

export interface Header {
  key: string;
  value: string;
  description?: string;
  disabled: boolean;
  auto?: boolean;
}

export interface QueryParam {
  key: string;
  value: string;
  description?: string;
  disabled: boolean;
}

export interface BodyConfig {
  mode: BodyMode;
  formdata?: FormDataParam[];
  urlencoded?: QueryParam[];
  raw?: RawBody;
  binary?: string;
  graphql?: GraphQLBody;
}

export type BodyMode = "none" | "formdata" | "urlencoded" | "raw" | "binary" | "graphql";

export interface FormDataParam {
  key: string;
  value: string;
  type: "text" | "file";
  description?: string;
  disabled: boolean;
  contentType?: string;
}

export interface RawBody {
  language: RawLanguage;
  content: string;
}

export type RawLanguage = "text" | "javascript" | "json" | "html" | "xml" | "yaml";

export interface GraphQLBody {
  query: string;
  variables: string;
  operationName?: string;
}

export interface RequestSettings {
  timeoutMs: number;
  followRedirects: boolean;
  verifySsl: boolean;
}

export interface HttpResponse {
  id: string;
  requestId: string;
  status: number;
  statusText: string;
  headers: ResponseHeader[];
  body: string;
  bodySize: number;
  contentType: string;
  encoding: string;
  time: number;
  cookies: Cookie[];
}

export interface ResponseHeader {
  key: string;
  value: string;
  description?: string;
}

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
  expires?: string;
  secure?: boolean;
  httpOnly?: boolean;
}

// Auth Types
export type AuthConfig =
  | { type: "none"; config: EmptyAuth }
  | { type: "apikey"; config: ApiKeyAuth }
  | { type: "bearer"; config: BearerAuth }
  | { type: "basic"; config: BasicAuth }
  | { type: "jwt"; config: JWTAuth }
  | { type: "oauth1"; config: OAuth1Auth }
  | { type: "oauth2"; config: OAuth2Auth }
  | { type: "awsv4"; config: AWSV4Auth };

export interface EmptyAuth {}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: "header" | "query";
}

export interface BearerAuth {
  token: string;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface JWTAuth {
  token: string;
  secret?: string;
}

export interface OAuth1Auth {
  consumerKey: string;
  consumerSecret: string;
  token: string;
  tokenSecret: string;
  signatureMethod: string;
}

export interface OAuth2Auth {
  accessToken: string;
  tokenType?: string;
  refreshToken?: string;
  expiresIn?: number;
}

export interface AWSV4Auth {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  service: string;
  region: string;
}

// Collection Types
export interface Collection {
  id: string;
  name: string;
  description?: string;
  items: CollectionItem[];
  createdAt: string;
  updatedAt: string;
}

export interface CollectionItem {
  id: string;
  name: string;
  type: "request" | "folder";
  method?: HttpMethod;
  children?: CollectionItem[];
}

// Environment Types
export interface Environment {
  id: string;
  name: string;
  variables: Variable[];
  isActive: boolean;
}

export interface Variable {
  key: string;
  value: string;
  enabled: boolean;
}

// Tab Types
export interface Tab {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  isModified: boolean;
  response?: HttpResponse;
  requestConfig?: HttpRequestConfig;
}
