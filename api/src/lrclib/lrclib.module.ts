import { Module } from '@nestjs/common';
import { LrclibService } from './lrclib.service';

@Module({ providers: [LrclibService], exports: [LrclibService] })
export class LrclibModule {}
