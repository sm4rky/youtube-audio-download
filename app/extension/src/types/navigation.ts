export type MainView = 'loading' | 'search-results' | 'song-details';

export interface NavigationState {
  view: MainView;
}

export interface NavigationStore extends NavigationState {
  setView(view: MainView): void;
}
