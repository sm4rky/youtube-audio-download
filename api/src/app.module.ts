import { ArtistsModule } from '@/artists/artists.module';
import { AlbumsModule } from '@/albums/albums.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { resolve } from 'node:path';
import { validateEnvironment } from '@/config/environment';
import { HealthModule } from '@/health/health.module';
import { SongsModule } from '@/songs/songs.module';
import { LyricsModule } from '@/lyrics/lyrics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: resolve(__dirname, '..', '.env'),
      validate: validateEnvironment,
    }),
    HealthModule,
    SongsModule,
    LyricsModule,
    ArtistsModule,
    AlbumsModule,
  ],
})
export class AppModule {}
