import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/card'
import { DonutChart } from '@/shared/components/DonutChart'
import type { DocumentItem } from '../types'

interface IngestaSummaryProps {
  documents: DocumentItem[]
}

// Resumen a la derecha de la página de ingesta. Todos los números se calculan con los documentos reales.
export function IngestaSummary({ documents }: IngestaSummaryProps) {
  const totalDocuments = documents.length
  const totalCvs = documents.filter((document) => document.type === 'CV').length
  const totalJobProfiles = documents.filter((document) => document.type === 'JOB_PROFILE').length
  // Por ahora solo se analizan CVs: el gráfico mide qué parte de los CVs ya fue analizada.
  const cvs = documents.filter((document) => document.type === 'CV')
  const analyzed = cvs.filter((document) => document.analysisStatus === 'COMPLETED').length
  const inProgress = cvs.filter((document) => document.analysisStatus === 'QUEUED' || document.analysisStatus === 'PROCESSING').length
  const failed = cvs.filter((document) => document.analysisStatus === 'FAILED').length
  const proposals = documents.reduce((sum, document) => sum + document.pendingProposals, 0)
  const analyzedPercent = totalCvs === 0 ? 0 : Math.round((analyzed / totalCvs) * 100)

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumen</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col">
          <SummaryRow label="Total de documentos" value={totalDocuments} valueClass="text-foreground" />
          <SummaryRow label="CVs" value={totalCvs} valueClass="text-primary" />
          <SummaryRow label="Perfiles de cargo" value={totalJobProfiles} valueClass="text-primary" />
          <SummaryRow label="Competencias por revisar" value={proposals} valueClass="text-amber-300" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Análisis con IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <DonutChart percent={analyzedPercent} label="CVs analizados" />
          <div className="grid w-full grid-cols-3 gap-2 text-xs text-muted-foreground">
            <span>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />
              Analizados <strong className="ml-1 text-foreground">{analyzed}</strong>
            </span>
            <span>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-sky-400" />
              En curso <strong className="ml-1 text-foreground">{inProgress}</strong>
            </span>
            <span>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-red-400" />
              Con error <strong className="ml-1 text-foreground">{failed}</strong>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function SummaryRow({ label, value, valueClass }: { label: string; value: number; valueClass: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-3 last:border-b-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  )
}
