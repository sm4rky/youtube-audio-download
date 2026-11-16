export interface SelectedSongState { selectedSongId: number | null }
export interface SelectedSongStore extends SelectedSongState { selectSong(id: number | null): void }
