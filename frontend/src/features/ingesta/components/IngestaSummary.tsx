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
  const pendingAnalysis = documents.filter((document) => document.analysisStatus === 'PENDING_ANALYSIS').length

  // Por ahora ningún documento se analiza (la IA todavía no está conectada).
  const analyzed = totalDocuments - pendingAnalysis
  const analyzedPercent = totalDocuments === 0 ? 0 : Math.round((analyzed / totalDocuments) * 100)

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
          <SummaryRow label="Pendientes de análisis" value={pendingAnalysis} valueClass="text-amber-300" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
            Análisis con IA
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <DonutChart percent={analyzedPercent} label="analizados" />
          <div className="flex w-full justify-between text-xs text-muted-foreground">
            <span>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-primary" />
              Analizados <strong className="ml-1 text-foreground">{analyzed}</strong>
            </span>
            <span>
              <span className="mr-1.5 inline-block size-2 rounded-full bg-muted-foreground/50" />
              Pendientes <strong className="ml-1 text-foreground">{pendingAnalysis}</strong>
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
