import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authHeader = req.headers?.authorization;
    if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
      return true;
    }
    try {
      const jwtGuard = new (AuthGuard('jwt'))();
      const result = await jwtGuard.canActivate(context);
      return Boolean(result);
    } catch {
      return true;
    }
  }
}