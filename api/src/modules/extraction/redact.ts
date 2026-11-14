// Oculta datos personales de contacto del texto de un CV antes de enviarlo a la IA y de guardarlo.
// Función pura: se prueba en test/redact.test.ts.
//
// Qué oculta: RUT, correo, teléfono y dirección. Qué NO oculta: el nombre (se usa para sugerir a la persona),
// fecha de nacimiento, estado civil, nacionalidad ni enlaces (LinkedIn). Es una protección "best effort":
// formatos poco comunes pueden escaparse (ver api/README.md, "Datos personales").

export const REDACTION_TOKENS = {
  rut: '[RUT]',
  email: '[CORREO]',
  phone: '[TELÉFONO]',
  address: '[DIRECCIÓN]',
} as const;

export type RedactionCounts = Record<keyof typeof REDACTION_TOKENS, number>;

export interface RedactionResult {
  text: string;
  // Cuántos reemplazos de cada tipo (nunca los valores ocultados).
  counts: RedactionCounts;
}

// Correo: algo@dominio.cl
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;

// RUT con dígito verificador y guion obligatorio: 12.345.678-9, 1.234.567-K, 12345678-k.
// Sin guion no se oculta: se confundiría con cualquier número de 8 dígitos.
const RUT = /(?<![\d.])(?:\d{1,2}\.\d{3}\.\d{3}|\d{7,8})-[\dkK](?![\dA-Za-z])/g;

// Teléfono después de una etiqueta con dos puntos ("Teléfono: ...", "Fono: ...", "Celular: ...").
// Se conserva la etiqueta y se oculta el número.
const LABELED_PHONE = /((?:tel[eé]fonos?|fono|celular|cel|m[oó]vil|whatsapp)\.?\s*:\s*)(\+?[\d\s().-]{7,20}\d)/gi;

// Celular chileno: 9 seguido de 8 dígitos, con o sin +56 y separadores (+56 9 1234 5678, 912345678).
const MOBILE = /(?<![\d+])(?:\+?56[\s.-]?)?9[\s.-]?\d{4}[\s.-]?\d{4}(?!\d)/g;

// Teléfono fijo con prefijo +56 o 56 (+56 2 2345 6789, +56 51 234 5678).
const LANDLINE = /(?<![\d+])\+?56[\s.-]?\d{1,2}[\s.-]?\d{3,4}[\s.-]?\d{4}(?!\d)/g;

// Dirección después de una etiqueta con dos puntos ("Dirección: ...", "Domicilio: ..."): se oculta el resto de la
// línea. Los dos puntos son obligatorios para no ocultar "Dirección de obras" (un cargo).
// (?!\s*\[DIRECCI) va justo después de ":" para no volver a ocultar un texto ya ocultado.
const LABELED_ADDRESS = /((?:direcci[oó]n(?:\s+particular)?|domicilio)\s*:(?!\s*\[DIRECCI)\s*)([^\n]+)/gi;

// Calle con número: "Av. Francisco de Aguirre 1234", "Calle Los Aromos #567, depto 12", "Pasaje Ñandú 45".
const STREET = /\b(?:avenida|av\.|av|calle|pasaje|psje\.?|pje\.?)\s+[^\n,\d[\]]{2,60}?\s*(?:#|n[°º]\s*)?\d{1,5}(?:\s*,?\s*(?:depto\.?|dpto\.?|departamento|of\.?|oficina|casa|block)\s*[\w-]+)?/gi;

export function redactPersonalData(input: string): RedactionResult {
  const counts: RedactionCounts = { rut: 0, email: 0, phone: 0, address: 0 };
  let text = input;

  // El orden importa: primero lo más específico (un correo puede tener números; un RUT parece un teléfono).
  text = text.replace(EMAIL, () => {
    counts.email++;
    return REDACTION_TOKENS.email;
  });
  text = text.replace(RUT, () => {
    counts.rut++;
    return REDACTION_TOKENS.rut;
  });
  text = text.replace(LABELED_PHONE, (_match, label: string) => {
    counts.phone++;
    return label + REDACTION_TOKENS.phone;
  });
  for (const pattern of [MOBILE, LANDLINE]) {
    text = text.replace(pattern, () => {
      counts.phone++;
      return REDACTION_TOKENS.phone;
    });
  }
  text = text.replace(LABELED_ADDRESS, (_match, label: string) => {
    counts.address++;
    return label + REDACTION_TOKENS.address;
  });
  text = text.replace(STREET, () => {
    counts.address++;
    return REDACTION_TOKENS.address;
  });

  return { text, counts };
}
