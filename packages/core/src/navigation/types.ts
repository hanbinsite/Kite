export type NavigationView = "home" | "request" | "collection" | "environment" | "settings";

export interface NavigationState {
  activeView: NavigationView;
}

export interface NavigationActions {
  navigateTo: (view: NavigationView) => void;
}
