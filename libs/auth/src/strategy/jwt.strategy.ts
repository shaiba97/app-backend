import { Injectable, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
// import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);

  constructor(private readonly authService: AuthService) {
    const secret = process.env.JWT_SECRET || 'rihla_super_secret_jwt_key_2026';
    console.log(`JWT Strategy initialized with secret: ${secret}`);
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret,
      algorithms: ['HS256'],
    });
  }

  validate(payload: any) {
    this.logger.log(`JWT payload received: ${JSON.stringify(payload)}`);
    return payload;
  }
}
