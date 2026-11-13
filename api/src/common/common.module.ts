import { Global, Module } from '@nestjs/common';
import { CurrentOrganizationService } from './current-organization.service';

// Servicios compartidos por todos los módulos.
// Es @Global para no tener que importarlo en cada módulo.
@Global()
@Module({
  providers: [CurrentOrganizationService],
  exports: [CurrentOrganizationService],
})
export class CommonModule {}
