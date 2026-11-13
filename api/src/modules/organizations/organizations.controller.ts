import { Controller, Get } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';

// Rutas del módulo de organizaciones. Por ahora solo lectura: crear organizaciones necesita login.
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  // GET /api/organizations
  @Get()
  listOrganizations() {
    return this.organizationsService.listOrganizations();
  }
}
