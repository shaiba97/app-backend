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
  // UseGuards,
  Req,
  // UnauthorizedException,
} from '@nestjs/common';
// import { AuthGuard } from '@nestjs/passport';
import { BusesService } from '../service/buses.service';
import { CreateBusDto, UpdateBusDto } from '../dto/bus.dto';

@Controller('buses')
export class BusesController {
  constructor(private readonly busesService: BusesService) {}

  @Post('post-bus')
  // @UseGuards(AuthGuard('local'))
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() createBusDto: CreateBusDto) {
    console.log(req.user);
    return this.busesService.create(
      createBusDto,
      '5d35cf9e-225f-4655-8037-070c001ff8a6',
    );
  }

  @Get('get-buses')
  async getBuses() {
    return this.busesService.getBuses();
  }

  @Get('get-buses/property/:property/value/:value')
  async getBusesByProperty(
    @Param('property') property: string,
    @Param('value') value: string,
  ) {
    return this.busesService.getBusesByProperty(property, value);
  }

  @Get('get-bus/property/:property/value/:value')
  async getBus(
    @Param('property') property: string,
    @Param('value') value: string,
  ) {
    return this.busesService.getBus(property, value);
  }

  @Put('update-bus/:id')
  @HttpCode(HttpStatus.OK)
  async update(@Param('id') id: string, @Body() updateBusDto: UpdateBusDto) {
    return this.busesService.update(id, updateBusDto);
  }

  @Delete('delete-bus/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Param('id') id: string) {
    return this.busesService.remove(id);
  }
}
