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
import { TripsService } from '../service/trips.service';
import { CreateTripDto, UpdateTripDto } from '../dto/trips.dto';

@Controller('trips')
export class TripsController {
  constructor(private readonly tripsService: TripsService) {}

  @Post('post-trip')
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: any, @Body() createTripDto: CreateTripDto) {
    return this.tripsService.create(createTripDto);
  }

  @Get('get-trips')
  async getTrips() {
    return this.tripsService.getTrips();
  }

  @Get('get-trips/property/:property/value/:value')
  async getTripsByProperty(
    @Param('property') property: string,
    @Param('value') value: string,
  ) {
    return this.tripsService.getTripsByProperty(property, value);
  }

  @Get('get-trip/property/:property/value/:value')
  async getTrip(
    @Param('property') property: string,
    @Param('value') value: string,
  ) {
    return this.tripsService.getTrip(property, value);
  }

  @Post('search-trips')
  @HttpCode(HttpStatus.OK)
  async searchTrips(
    @Body()
    searchCriteria: {
      fromCity: string;
      toCity: string;
      departureDate: any;
    },
  ) {
    return this.tripsService.searchTrips(searchCriteria);
  }

  @Put('update-trip/:id')
  async update(
    @Req() req: any,
    @Param('id') id: string,
    @Body() updateTripDto: UpdateTripDto,
  ) {
    return this.tripsService.update(id, updateTripDto);
  }

  @Delete('delete-trip/:id')
  @HttpCode(HttpStatus.OK)
  async remove(@Req() req: any, @Param('id') id: string) {
    return this.tripsService.remove(id);
  }
}
