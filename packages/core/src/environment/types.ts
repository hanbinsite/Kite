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
