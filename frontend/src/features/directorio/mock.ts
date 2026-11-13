// DATOS DE EJEMPLO para la página Directorio de Talento. Personas y cargos ficticios.
// Se usan solo según las reglas del modo de datos (ver src/shared/lib/load-data.ts).
// Generado aplicando la regla real de ajuste de la API (api/src/modules/talent/fit-rules.ts): el % y el estado
// de cada persona son los que calcularía la API con estos requisitos y niveles (escala 1 a 5).
import type { Collaborator } from './types'

export const MOCK_COLLABORATORS: Collaborator[] = [
  {
    "id": "ejemplo-persona-1",
    "fullName": "Valentina Torres",
    "area": "Mantención",
    "position": {
      "id": "ejemplo-cargo-1",
      "title": "Planificadora de mantención"
    },
    "skills": [
      {
        "skillId": "ejemplo-planificacion-de-mantencion",
        "name": "Planificación de mantención",
        "category": "TECHNICAL",
        "level": 5,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-analisis-de-fallas",
        "name": "Análisis de fallas",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-comunicacion",
        "name": "Comunicación",
        "category": "BEHAVIORAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-excel-avanzado",
        "name": "Excel avanzado",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-sap-pm",
        "name": "SAP PM",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-planificacion-de-mantencion",
        "name": "Planificación de mantención",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 5,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-sap-pm",
        "name": "SAP PM",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-analisis-de-fallas",
        "name": "Análisis de fallas",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-excel-avanzado",
        "name": "Excel avanzado",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-comunicacion",
        "name": "Comunicación",
        "requiredLevel": 4,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      }
    ],
    "fitPercent": 100,
    "status": "optimo",
    "reasons": [
      "Cumple todos los requisitos del cargo."
    ]
  },
  {
    "id": "ejemplo-persona-2",
    "fullName": "Carlos Medina",
    "area": "Operaciones",
    "position": {
      "id": "ejemplo-cargo-2",
      "title": "Jefe de operaciones"
    },
    "skills": [
      {
        "skillId": "ejemplo-comunicacion",
        "name": "Comunicación",
        "category": "BEHAVIORAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-liderazgo",
        "name": "Liderazgo",
        "category": "BEHAVIORAL",
        "level": 3,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-gestion-de-riesgos",
        "name": "Gestión de riesgos",
        "category": "TECHNICAL",
        "level": 2,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-planificacion",
        "name": "Planificación",
        "category": "TECHNICAL",
        "level": 2,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-planificacion",
        "name": "Planificación",
        "requiredLevel": 5,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 2,
        "hasSkill": true,
        "coverage": 0.4
      },
      {
        "skillId": "ejemplo-liderazgo",
        "name": "Liderazgo",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 3,
        "hasSkill": true,
        "coverage": 0.75
      },
      {
        "skillId": "ejemplo-gestion-de-presupuesto",
        "name": "Gestión de presupuesto",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": null,
        "hasSkill": false,
        "coverage": 0
      },
      {
        "skillId": "ejemplo-gestion-de-riesgos",
        "name": "Gestión de riesgos",
        "requiredLevel": 4,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 2,
        "hasSkill": true,
        "coverage": 0.5
      },
      {
        "skillId": "ejemplo-comunicacion",
        "name": "Comunicación",
        "requiredLevel": 4,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      }
    ],
    "fitPercent": 53,
    "status": "critico",
    "reasons": [
      "Falta la competencia obligatoria \"Gestión de presupuesto\".",
      "\"Planificación\": nivel 2 de 5 requerido.",
      "\"Liderazgo\": nivel 3 de 4 requerido.",
      "\"Gestión de riesgos\": nivel 2 de 4 requerido."
    ]
  },
  {
    "id": "ejemplo-persona-3",
    "fullName": "Andrea Solís",
    "area": "Personas",
    "position": {
      "id": "ejemplo-cargo-3",
      "title": "Analista de personas"
    },
    "skills": [
      {
        "skillId": "ejemplo-seleccion",
        "name": "Selección",
        "category": "TECHNICAL",
        "level": 5,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-capacitacion",
        "name": "Capacitación",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-clima-laboral",
        "name": "Clima laboral",
        "category": "BEHAVIORAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-normativa-laboral",
        "name": "Normativa laboral",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-remuneraciones",
        "name": "Remuneraciones",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-seleccion",
        "name": "Selección",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 5,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-remuneraciones",
        "name": "Remuneraciones",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-normativa-laboral",
        "name": "Normativa laboral",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-capacitacion",
        "name": "Capacitación",
        "requiredLevel": 2,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-clima-laboral",
        "name": "Clima laboral",
        "requiredLevel": 2,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      }
    ],
    "fitPercent": 100,
    "status": "desaprovechado",
    "reasons": [
      "Supera en promedio 1,6 niveles lo que exige su cargo."
    ]
  },
  {
    "id": "ejemplo-persona-4",
    "fullName": "Diego Ramírez",
    "area": "Mantención",
    "position": {
      "id": "ejemplo-cargo-4",
      "title": "Técnico electromecánico senior"
    },
    "skills": [
      {
        "skillId": "ejemplo-mantencion-de-compresores",
        "name": "Mantención de compresores",
        "category": "TECHNICAL",
        "level": 5,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-electricidad-industrial",
        "name": "Electricidad industrial",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-lectura-de-planos",
        "name": "Lectura de planos",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-trabajo-en-equipo",
        "name": "Trabajo en equipo",
        "category": "BEHAVIORAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-hidraulica",
        "name": "Hidráulica",
        "category": "TECHNICAL",
        "level": null,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-mantencion-de-compresores",
        "name": "Mantención de compresores",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 5,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-electricidad-industrial",
        "name": "Electricidad industrial",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-hidraulica",
        "name": "Hidráulica",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": null,
        "hasSkill": true,
        "coverage": 0.5
      },
      {
        "skillId": "ejemplo-lectura-de-planos",
        "name": "Lectura de planos",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-trabajo-en-equipo",
        "name": "Trabajo en equipo",
        "requiredLevel": null,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      }
    ],
    "fitPercent": 90,
    "status": "optimo",
    "reasons": [
      "\"Hidráulica\": la tiene, nivel por confirmar (requerido 3)."
    ]
  },
  {
    "id": "ejemplo-persona-5",
    "fullName": "Lucía Herrera",
    "area": "Finanzas",
    "position": {
      "id": "ejemplo-cargo-5",
      "title": "Analista financiera"
    },
    "skills": [
      {
        "skillId": "ejemplo-excel-avanzado",
        "name": "Excel avanzado",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-modelos-financieros",
        "name": "Modelos financieros",
        "category": "TECHNICAL",
        "level": 2,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-power-bi",
        "name": "Power BI",
        "category": "TECHNICAL",
        "level": 2,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-contabilidad",
        "name": "Contabilidad",
        "category": "TECHNICAL",
        "level": 1,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-modelos-financieros",
        "name": "Modelos financieros",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 2,
        "hasSkill": true,
        "coverage": 0.5
      },
      {
        "skillId": "ejemplo-excel-avanzado",
        "name": "Excel avanzado",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-power-bi",
        "name": "Power BI",
        "requiredLevel": 4,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 2,
        "hasSkill": true,
        "coverage": 0.5
      },
      {
        "skillId": "ejemplo-contabilidad",
        "name": "Contabilidad",
        "requiredLevel": 4,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 1,
        "hasSkill": true,
        "coverage": 0.25
      },
      {
        "skillId": "ejemplo-normativa-tributaria",
        "name": "Normativa tributaria",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": null,
        "hasSkill": false,
        "coverage": 0
      }
    ],
    "fitPercent": 45,
    "status": "critico",
    "reasons": [
      "Ajuste de 45 %, bajo el mínimo de 60 %.",
      "\"Modelos financieros\": nivel 2 de 4 requerido.",
      "\"Power BI\": nivel 2 de 4 requerido.",
      "\"Contabilidad\": nivel 1 de 4 requerido.",
      "No registra \"Normativa tributaria\" (deseable)."
    ]
  },
  {
    "id": "ejemplo-persona-6",
    "fullName": "Marcos Gutiérrez",
    "area": "Comercial",
    "position": {
      "id": "ejemplo-cargo-6",
      "title": "Ejecutivo comercial"
    },
    "skills": [
      {
        "skillId": "ejemplo-negociacion",
        "name": "Negociación",
        "category": "BEHAVIORAL",
        "level": 5,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-venta-tecnica",
        "name": "Venta técnica",
        "category": "TECHNICAL",
        "level": 5,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-atencion-a-clientes",
        "name": "Atención a clientes",
        "category": "BEHAVIORAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-cotizaciones",
        "name": "Cotizaciones",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-crm",
        "name": "CRM",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [
      {
        "skillId": "ejemplo-venta-tecnica",
        "name": "Venta técnica",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 5,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-negociacion",
        "name": "Negociación",
        "requiredLevel": 3,
        "isMandatory": true,
        "weight": 1,
        "currentLevel": 5,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-crm",
        "name": "CRM",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-atencion-a-clientes",
        "name": "Atención a clientes",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      },
      {
        "skillId": "ejemplo-cotizaciones",
        "name": "Cotizaciones",
        "requiredLevel": 3,
        "isMandatory": false,
        "weight": 1,
        "currentLevel": 4,
        "hasSkill": true,
        "coverage": 1
      }
    ],
    "fitPercent": 100,
    "status": "desaprovechado",
    "reasons": [
      "Supera en promedio 1,4 niveles lo que exige su cargo."
    ]
  },
  {
    "id": "ejemplo-persona-7",
    "fullName": "Sofía Pizarro",
    "area": "Logística",
    "position": {
      "id": "ejemplo-cargo-7",
      "title": "Encargada de bodega"
    },
    "skills": [
      {
        "skillId": "ejemplo-control-de-inventario",
        "name": "Control de inventario",
        "category": "TECHNICAL",
        "level": 4,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-orden-y-limpieza-5s-",
        "name": "Orden y limpieza (5S)",
        "category": "BEHAVIORAL",
        "level": 3,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      },
      {
        "skillId": "ejemplo-grua-horquilla",
        "name": "Grúa horquilla",
        "category": "TECHNICAL",
        "level": null,
        "verificationStatus": "DECLARED",
        "evidenceExcerpt": null
      }
    ],
    "requirements": [],
    "fitPercent": null,
    "status": "sin-requisitos",
    "reasons": [
      "El cargo no tiene requisitos definidos."
    ]
  }
]
