import { Module } from '@nestjs/common';
import { AppointmentsController, AdminAppointmentsController } from './appointments.controller';
import { AppointmentsService } from './appointments.service';
import { AppointmentNotificationsService } from './appointment-notifications.service';
@Module({ controllers: [AppointmentsController, AdminAppointmentsController], providers: [AppointmentsService, AppointmentNotificationsService] })
export class AppointmentsModule {}
