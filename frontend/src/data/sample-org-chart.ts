// DATOS DE EJEMPLO para la página Laboratorio: organigrama actual y propuesto de una empresa ficticia.
// Se reemplazarán por datos de la API (positions, position_assignments, scenarios, findings).

// Tipo de cada caja del organigrama. Define su color.
//   existing:    rol existente sin problemas
//   overloaded:  rol que asume funciones ajenas
//   missing:     rol que no existe (sus funciones las hace otra persona)
//   proposed:    rol nuevo en la estructura propuesta
//   consequence: consecuencia detectada (retrasos, quiebres de stock, etc.)
export type NodeKind = 'existing' | 'overloaded' | 'missing' | 'proposed' | 'consequence'

export interface OrgNode {
  title: string
  note: string
  kind: NodeKind
}

// Grupo de cajas con un título (por ejemplo "Consecuencias detectadas").
export interface OrgSection {
  title: string
  nodes: OrgNode[]
}

export interface OrgChartData {
  companyName: string
  root: OrgNode
  // Cajas conectadas directamente con la raíz.
  directReports: OrgNode[]
  sections: OrgSection[]
  footnote: string
}

export const CURRENT_STRUCTURE: OrgChartData = {
  companyName: 'Compresores del Sur Ltda.',
  root: { title: 'Gerente general / Dueño', note: 'sobrecargado', kind: 'overloaded' },
  directReports: [
    { title: 'Ing. de producto', note: '+ gestión de proyectos', kind: 'overloaded' },
    { title: 'Téc. senior x2', note: 'ejecuta servicio', kind: 'existing' },
    { title: 'Téc. junior x3', note: 'ejecución en campo', kind: 'existing' },
    { title: 'Administradora', note: '+ compras', kind: 'overloaded' },
    { title: 'Vendedor externo', note: 'sin CRM', kind: 'existing' },
  ],
  sections: [
    {
      title: 'Roles formalmente inexistentes (asumidos de forma informal)',
      nodes: [
        { title: 'Coord. proyectos', note: 'no existe', kind: 'missing' },
        { title: 'Jefe postventa', note: 'no existe', kind: 'missing' },
        { title: 'Analista compras', note: 'no existe', kind: 'missing' },
        { title: 'Enc. calidad', note: 'no existe', kind: 'missing' },
        { title: 'Ejec. comercial', note: 'no existe', kind: 'missing' },
      ],
    },
    {
      title: 'Consecuencias detectadas',
      nodes: [
        { title: 'Retrasos', note: '+3 semanas promedio', kind: 'consequence' },
        { title: 'Sobrecarga', note: '2 de 5 ingenieros', kind: 'consequence' },
        { title: 'Quiebres de stock', note: 'repuestos críticos', kind: 'consequence' },
        { title: 'Sin estándar', note: '8% reclamos', kind: 'consequence' },
        { title: 'Sin pipeline', note: 'ventas estancadas', kind: 'consequence' },
      ],
    },
  ],
  footnote: 'Impacto estimado (ejemplo): -31% productividad · 2 contratos perdidos · crecimiento estancado',
}

export const PROPOSED_STRUCTURE: OrgChartData = {
  companyName: 'Compresores del Sur Ltda.',
  root: { title: 'Gerente general', note: 'foco estratégico', kind: 'existing' },
  directReports: [
    { title: 'Coord. proyectos', note: 'nuevo rol', kind: 'proposed' },
    { title: 'Jefe postventa', note: 'nuevo rol', kind: 'proposed' },
    { title: 'Administración', note: 'finanzas y RR.HH.', kind: 'existing' },
    { title: 'Ejec. comercial', note: 'nuevo rol · CRM', kind: 'proposed' },
  ],
  sections: [
    {
      title: 'Equipos bajo cada jefatura',
      nodes: [
        { title: 'Ing. de producto', note: 'reporta a Coord. proyectos', kind: 'existing' },
        { title: 'Téc. senior x2', note: 'reportan a Jefe postventa', kind: 'existing' },
        { title: 'Téc. junior x3', note: 'reportan a Jefe postventa', kind: 'existing' },
        { title: 'Vendedor externo', note: 'reporta a Ejec. comercial', kind: 'existing' },
      ],
    },
    {
      title: 'Roles de apoyo nuevos',
      nodes: [
        { title: 'Analista compras', note: 'nuevo rol · Administración', kind: 'proposed' },
        { title: 'Enc. calidad', note: 'nuevo rol · Postventa', kind: 'proposed' },
      ],
    },
  ],
  footnote: 'La propuesta es un ejemplo. La decisión final siempre la toma una persona.',
}
