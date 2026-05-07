import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UsersService } from '../service/users.service';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from '../dto/user.dto';
import { UserEntity } from '../entity/user.entity';

function SessionAuthGuard() {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value;
    descriptor.value = function (...args: any[]) {
      const req = args[0];
      if (!req || !req.isAuthenticated?.()) {
        throw new UnauthorizedException('غير مصرح — يرجى تسجيل الدخول');
      }
      return originalMethod.apply(this, args);
    };
    return descriptor;
  };
}

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('post-login')
  @UseGuards(AuthGuard('local'))
  login(@Req() req: any) {
    return this.usersService.login(req.user);
  }

  @Post('logout')
  logout(@Req() req: any) {
    return new Promise((resolve) => {
      req.logout((err: Error) => {
        if (err) {
          resolve({ message: 'Error during logout', success: false });
        } else {
          req.session?.destroy(() => {
            resolve({ message: 'تم تسجيل الخروج بنجاح', success: true });
          });
        }
      });
    });
  }

  @Get('me')
  @SessionAuthGuard()
  async getMe(@Req() req: any) {
    const user = await this.usersService.getUserById(req.user.id);
    return { data: user };
  }

  @Post('post-user')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new user' })
  @ApiResponse({
    status: 201,
    description: 'User created successfully',
    type: UserResponseDto,
  })
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @Get('get-users')
  async getUsers() {
    return this.usersService.getUsers();
  }

  @Get('get-users/property/:property/value/:value')
  async getUsersByProperty(
    @Param('property') property: string,
    @Param('value') value: string,
  ) {
    return this.usersService.getUsersByProperty(property, value);
  }

  @Get('get-user/property/:property/value/:value')
  async getUser(
    @Param('property') property: string,
    @Param('value') value: string,
  ): Promise<UserEntity> {
    return this.usersService.getUser(property, value);
  }

  @Put('update-user/:id')
  async update(@Param('id') id: string, @Body() updateUserDto: UpdateUserDto) {
    return this.usersService.update(id, updateUserDto);
  }

  @Delete('delete-user/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete user' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  async remove(@Param('id') id: string) {
    return this.usersService.remove(id);
  }
}
