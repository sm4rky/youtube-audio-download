import { Module } from '@nestjs/common';
import { GeniusModule } from '../genius/genius.module';
import { SongsController } from './songs.controller';
import { SongsService } from './songs.service';

@Module({
  imports: [GeniusModule],
  controllers: [SongsController],
  providers: [SongsService],
})
export class SongsModule {}
