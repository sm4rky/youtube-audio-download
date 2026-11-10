import { Injectable } from '@nestjs/common';
import { GeniusService } from '../genius/genius.service';

export interface SongArtist {
  geniusId: number;
  name: string;
}

export interface SongSearchItem {
  geniusId: number;
  title: string;
  artistName: string;
  year: number | null;
  primaryArtists: SongArtist[];
  featuredArtists: SongArtist[];
  coverUrl: string | null;
  geniusUrl: string | null;
}

export interface SongSearchResponse {
  query: string;
  items: SongSearchItem[];
}

@Injectable()
export class SongsService {
  constructor(private readonly genius: GeniusService) {}

  async search(query: string): Promise<SongSearchResponse> {
    const songs = await this.genius.search(query);
    const seen = new Set<number>();
    const items: SongSearchItem[] = [];
    for (const song of songs) {
      if (seen.has(song.id)) continue;
      seen.add(song.id);
      items.push({
        geniusId: song.id,
        title: song.title,
        artistName: song.primary_artist.name,
        year: song.release_date_components?.year ?? null,
        primaryArtists: song.primary_artists.map((artist) => ({
          geniusId: artist.id,
          name: artist.name,
        })),
        featuredArtists: song.featured_artists.map((artist) => ({
          geniusId: artist.id,
          name: artist.name,
        })),
        coverUrl:
          song.song_art_image_url ??
          song.song_art_image_thumbnail_url ??
          song.header_image_url,
        geniusUrl: song.url,
      });
    }
    return { query, items };
  }
}
