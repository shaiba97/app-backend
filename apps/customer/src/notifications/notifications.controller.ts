import {
  Controller,
  Get,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  UseGuards,
  Body,
  Post,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { NotificationsService } from './notifications.service';
import { OptionalJwtGuard } from './optional-jwt.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: Request, @Query('limit') limit: string) {
    return this.svc.findByUser((req as any).user.id, +limit || 30);
  }

  @Get('unread-count')
  @UseGuards(AuthGuard('jwt'))
  unreadCount(@Req() req: Request) {
    return this.svc.getUnreadCount((req as any).user.id);
  }

  @Patch(':id/read')
  @UseGuards(AuthGuard('jwt'))
  markRead(@Param('id') id: string, @Req() req: Request) {
    return this.svc.markRead(id, (req as any).user.id);
  }

  @Patch('read-all')
  @UseGuards(AuthGuard('jwt'))
  markAllRead(@Req() req: Request) {
    return this.svc.markAllRead((req as any).user.id);
  }

  // Static routes must be declared BEFORE parameterized ones, otherwise
  // "clear-all" is captured by @Delete(':id').
  @Delete('clear-all')
  @UseGuards(AuthGuard('jwt'))
  clearAll(@Req() req: Request) {
    return this.svc.clearAll((req as any).user.id);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string, @Req() req: Request) {
    return this.svc.remove(id, (req as any).user.id);
  }

  @Post('device-token')
  @UseGuards(OptionalJwtGuard)
  registerToken(
    @Req() req: Request,
    @Body() body: { token: string; platform: string },
  ) {
    const userId = (req as any).user?.id;
    if (!userId) {
      return { message: 'ok' };
    }
    return this.svc.registerDeviceToken(userId, body.token, body.platform);
  }

  @Delete('device-token/:token')
  @UseGuards(AuthGuard('jwt'))
  removeToken(@Req() req: Request, @Param('token') token: string) {
    return this.svc.unregisterDeviceToken((req as any).user.id, token);
  }

  @Get('device-tokens')
  @UseGuards(AuthGuard('jwt'))
  listTokens(@Req() req: Request) {
    return this.svc.getUserDeviceTokens((req as any).user.id);
  }
}
