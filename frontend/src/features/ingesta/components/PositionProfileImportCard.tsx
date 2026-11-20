import { useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { ORG_CHART_IMPORT_AVAILABLE } from '../org-chart-import'
import {
  importPositionProfiles,
  POSITION_PROFILE_TEMPLATE,
  type PositionProfileImportResult,
  type PositionProfileImportSummary,
} from '../position-profile-import'
import { ImportIssueList, ImportMessage, ImportSummaryList } from './ImportParts'

type Status =
  | { step: 'idle' }
  | { step: 'working'; mode: 'preview' | 'apply' }
  | { step: 'result'; result: PositionProfileImportResult }
  | { step: 'failed'; message: string }

const CATEGORY_LABELS = { TECHNICAL: 'técnica', BEHAVIORAL: 'blanda' } as const

// Perfiles de cargo desde CSV (competencias requeridas por cargo), en dos pasos: "Revisar" y "Confirmar".
// Los requisitos de un cargo también se editan a mano en el Directorio (panel de perfil).
export function PositionProfileImportCard() {
  const queryClient = useQueryClient()
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [status, setStatus] = useState<Status>({ step: 'idle' })

  async function run(mode: 'preview' | 'apply') {
    if (!file) return
    setStatus({ step: 'working', mode })
    try {
      const result = await importPositionProfiles(file, mode)
      setStatus({ step: 'result', result })
      if (result.saved) {
        // El Directorio muestra los requisitos y el ajuste de cada persona.
        queryClient.invalidateQueries({ queryKey: ['collaborators'] })
        queryClient.invalidateQueries({ queryKey: ['position-skills'] })
        queryClient.invalidateQueries({ queryKey: ['skills'] })
      }
    } catch (error) {
      setStatus({ step: 'failed', message: error instanceof Error ? error.message : 'No se pudieron importar los perfiles de cargo.' })
    }
  }

  function chooseFile(selected: File | null) {
    setFile(selected)
    setStatus({ step: 'idle' })
  }

  function downloadTemplate() {
    // El BOM (marca U+FEFF al inicio) hace que Excel reconozca el archivo como UTF-8 y muestre bien los acentos.
    const blob = new Blob([String.fromCharCode(0xfeff) + POSITION_PROFILE_TEMPLATE], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'plantilla-perfiles-cargo.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const working = status.step === 'working'
  const result = status.step === 'result' ? status.result : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Importar perfiles de cargo (CSV)</CardTitle>
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download /> Plantilla
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <p className="text-muted-foreground">
          Una fila por competencia que exige un cargo. Columnas:{' '}
          <strong className="text-foreground">cargo, area, competencia</strong> y, opcional,{' '}
          <strong className="text-foreground">categoria</strong> (tecnica o blanda; obligatoria si la competencia es
          nueva), <strong className="text-foreground">nivel_minimo</strong> (1 a 5),{' '}
          <strong className="text-foreground">obligatoria</strong> (si o no) y <strong className="text-foreground">peso</strong>.
          Los cargos deben existir (importa primero el organigrama). Cada cargo del archivo queda con exactamente esas
          competencias; los demás cargos no cambian.
        </p>

        {!ORG_CHART_IMPORT_AVAILABLE ? (
          <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-amber-200">
            No disponible en modo de ejemplo (VITE_DATA_MODE=mock): la importación necesita la API y no se simula.
          </p>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={working}>
              <FileSpreadsheet /> {file ? 'Cambiar archivo' : 'Elegir archivo'}
            </Button>
            <span className="min-w-0 truncate text-muted-foreground">{file ? file.name : 'Ningún archivo elegido'}</span>
            <Button className="sm:ml-auto" onClick={() => run('preview')} disabled={!file || working}>
              {working && status.mode === 'preview' && <Loader2 className="animate-spin" />} Revisar
            </Button>
          </div>
        )}

        {status.step === 'failed' && <ImportMessage tone="error">{status.message}</ImportMessage>}

        {result && !result.ok && (
          <div className="flex flex-col gap-2">
            <ImportMessage tone="error">
              El archivo tiene {result.errors.length} problema(s). No se guardó nada. Corrígelo y vuelve a revisarlo.
            </ImportMessage>
            <ImportIssueList issues={result.errors} />
          </div>
        )}

        {result && result.ok && result.summary && (
          <div className="flex flex-col gap-3">
            {result.saved ? (
              <ImportMessage tone="success">
                Perfiles importados: {result.summary.positions.length} cargo(s) actualizados.
              </ImportMessage>
            ) : (
              <ImportMessage tone="info">
                Revisión lista ({result.rowCount} filas). Todavía no se guardó nada: revisa los cambios y confirma.
              </ImportMessage>
            )}
            {result.warnings.length > 0 && (
              <div className="flex flex-col gap-2">
                <ImportMessage tone="warning">
                  {result.warnings.length} advertencia(s): no impiden importar, pero revísalas.
                </ImportMessage>
                <ImportIssueList issues={result.warnings} />
              </div>
            )}
            <ProfileSummary summary={result.summary} />
            {!result.saved && (
              <Button onClick={() => run('apply')} disabled={working} className="self-start">
                {working && status.mode === 'apply' && <Loader2 className="animate-spin" />} Confirmar e importar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function ProfileSummary({ summary }: { summary: PositionProfileImportSummary }) {
  return (
    <div className="flex flex-col gap-2">
      <ImportSummaryList
        title={`Competencias nuevas en el catálogo: ${summary.createdSkills.length}`}
        items={summary.createdSkills}
      />
      {summary.positions.map((position) => (
        <ImportSummaryList
          key={`${position.department}|${position.title}`}
          title={`${position.title} (${position.department}): ${position.requirements.length} competencia(s)`}
          detail={`tenía ${position.previousCount}${position.removed.length > 0 ? ` · se quitan: ${position.removed.join(', ')}` : ''}`}
          items={position.requirements.map(
            (r) =>
              `${r.name} (${CATEGORY_LABELS[r.category]}) · ${r.requiredLevel === null ? 'sin nivel mínimo' : `nivel ${r.requiredLevel}`} · ${
                r.isMandatory ? 'obligatoria' : 'deseable'
              } · peso ${r.weight}${r.isNewSkill ? ' · nueva' : ''}`,
          )}
          warning={position.removed.length > 0}
        />
      ))}
      <p className="text-muted-foreground">Cargos que no vienen en el archivo (no cambian): {summary.positionsNotInFile}</p>
    </div>
  )
}
