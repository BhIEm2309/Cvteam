import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { parseCreateEmployeeInput, parseUpdateEmployeeInput } from './employee-input';

// Valida que el :id de la ruta sea un UUID; si no, responde 400 con un mensaje en español.
const employeeIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id de la persona no es válido.'),
});

// Rutas del módulo de personas (trabajadores). La lógica está en employees.service.ts.
@Controller('employees')
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  // GET /api/employees
  @Get()
  listEmployees() {
    return this.employeesService.listEmployees();
  }

  // GET /api/employees/:id
  @Get(':id')
  getEmployee(@Param('id', employeeIdPipe) id: string) {
    return this.employeesService.getEmployee(id);
  }

  // POST /api/employees
  // Cuerpo JSON: { "fullName": "Ana Rojas", "employeeCode": "12.345.678-9", "positionId": "..." }
  @Post()
  createEmployee(@Body() body: unknown) {
    const input = parseCreateEmployeeInput(body);
    return this.employeesService.createEmployee(input);
  }

  // PATCH /api/employees/:id
  // Cuerpo JSON con solo los campos a cambiar. "positionId" cambia su cargo vigente (null = sin cargo).
  @Patch(':id')
  updateEmployee(@Param('id', employeeIdPipe) id: string, @Body() body: unknown) {
    const input = parseUpdateEmployeeInput(body);
    return this.employeesService.updateEmployee(id, input);
  }

  // DELETE /api/employees/:id
  // No borra el registro: lo archiva. La persona no debe tener cargo vigente.
  @Delete(':id')
  archiveEmployee(@Param('id', employeeIdPipe) id: string) {
    return this.employeesService.archiveEmployee(id);
  }
}
