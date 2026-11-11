import type { GeniusSongDetail } from '../../genius/types/genius-song-detail';
import type { SongDetailResponse } from '../types/song-detail-response';

export function mapSongDetailResponse(
  song: GeniusSongDetail,
): SongDetailResponse {
  return {
    geniusId: song.id,
    title: song.title,
    artistName: song.primary_artist.name,
    primaryArtists: song.primary_artists.map((artist) => ({
      geniusId: artist.id,
      name: artist.name,
    })),
    featuredArtists: song.featured_artists.map((artist) => ({
      geniusId: artist.id,
      name: artist.name,
    })),
    year: song.release_date_components?.year ?? null,
    album: song.album
      ? { geniusId: song.album.id, title: song.album.name }
      : null,
    coverUrl:
      song.album?.cover_art_url ??
      song.song_art_image_url ??
      song.song_art_image_thumbnail_url ??
      song.header_image_url,
    geniusUrl: song.url,
    media: song.media.map((entry) => ({
      provider: entry.provider,
      type: entry.type,
      url: entry.url,
      start: entry.start,
    })),
  };
}
