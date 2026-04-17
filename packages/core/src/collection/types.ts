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
  method?: string;
  children?: CollectionItem[];
}

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
