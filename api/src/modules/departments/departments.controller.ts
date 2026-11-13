import { BadRequestException, Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { parseCreateDepartmentInput, parseUpdateDepartmentInput } from './department-input';

// Valida que el :id de la ruta sea un UUID; si no, responde 400 con un mensaje en español.
const departmentIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new BadRequestException('El id del área no es válido.'),
});

// Rutas del módulo de áreas. El controlador solo recibe la solicitud
// y llama al servicio; la lógica está en departments.service.ts.
@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  // GET /api/departments
  @Get()
  listDepartments() {
    return this.departmentsService.listDepartments();
  }

  // GET /api/departments/:id
  @Get(':id')
  getDepartment(@Param('id', departmentIdPipe) id: string) {
    return this.departmentsService.getDepartment(id);
  }

  // POST /api/departments
  // Cuerpo JSON: { "code": "OPS", "name": "Operaciones", "description": "...", "parentDepartmentId": null }
  @Post()
  createDepartment(@Body() body: unknown) {
    const input = parseCreateDepartmentInput(body);
    return this.departmentsService.createDepartment(input);
  }

  // PATCH /api/departments/:id
  // Cuerpo JSON con solo los campos a cambiar, por ejemplo: { "name": "Operaciones Mina" }
  @Patch(':id')
  updateDepartment(@Param('id', departmentIdPipe) id: string, @Body() body: unknown) {
    const input = parseUpdateDepartmentInput(body);
    return this.departmentsService.updateDepartment(id, input);
  }

  // DELETE /api/departments/:id
  // No borra el registro: lo archiva (deja de aparecer en el listado).
  @Delete(':id')
  archiveDepartment(@Param('id', departmentIdPipe) id: string) {
    return this.departmentsService.archiveDepartment(id);
  }
}
