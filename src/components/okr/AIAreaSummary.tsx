import { useState, useEffect } from "react";
import { Sparkles, RefreshCw, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SummaryData {
  diagnostico: string;
  positivos: string[];
  atencao: string[];
  acao: string[];
}

interface Props {
  areaName: string;
  cycleId: string;
  objectives: any[];
  milestonesMap: Record<string, any[]>;
  checkinsMap: Record<string, any[]>;
  progressKR: (kr: any, milestones?: any[], checkins?: any[]) => number;
}

export default function AIAreaSummary({ areaName, cycleId, objectives, milestonesMap, checkinsMap, progressKR }: Props) {
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = `${cycleId}::${areaName}`;

  // Load cached summary on mount
  useEffect(() => {
    const params = new URLSearchParams({ key: cacheKey });
    fetch(`/api/ai-summary?${params}`)
      .then((r) => r.json())
      .then((d: any) => {
        if (d.summary) {
          setSummary(d.summary);
          setUpdatedAt(d.updated_at);
        }
      })
      .catch(() => {});
  }, [cacheKey]);

  function buildPayload() {
    return {
      areaName,
      cycleId,
      objectives: objectives.map((obj) => {
        const objKRs = obj._krs || [];
        return {
          title: obj.title,
          score: obj._score || 0,
          keyResults: objKRs.map((kr: any) => ({
            title: kr.title,
            score: progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]),
            grade0: kr.grade0_value,
            grade1: kr.grade1_value,
            current: kr.current_value,
            unit: kr.unit,
            milestones: (milestonesMap[kr.id] || []).map((ms: any) => ({
              title: ms.title,
              score: ms.current_value != null && ms.target_value
                ? Math.min(ms.current_value / ms.target_value, 1)
                : 0,
            })),
          })),
        };
      }),
    };
  }

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json() as any;
      if (data.error) {
        setError(data.error);
      } else {
        setSummary(data.summary);
        setUpdatedAt(data.updated_at);
      }
    } catch (err: any) {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
    } catch { return iso; }
  };

  return (
    <div className="rounded-lg border p-4 mb-2 bg-card" style={{borderColor:"#d7d900", borderLeftWidth:3}}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full flex items-center justify-center" style={{background:"rgba(215,217,0,0.15)"}}>
            <Sparkles className="h-4 w-4" style={{color:"#d7d900"}} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Resumo Executivo</span>
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-1" style={{background:"rgba(215,217,0,0.2)",color:"#d7d900"}}>
                <Sparkles className="h-2.5 w-2.5" /> IA
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {summary ? "Análise gerada por IA · Gerado sob demanda" : "Clique em Gerar para analisar esta área"}
            </p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={generate}
          disabled={loading}
          style={{background:"#d7d900",color:"#1a1a00"}} className="gap-1.5 hover:opacity-90"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Gerando..." : summary ? "Atualizar" : "Gerar análise"}
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2">{error}</div>
      )}

      {summary && !error && (
        <>
          {summary.diagnostico && (
            <p className="text-sm mb-3 text-foreground leading-relaxed">
              <strong>Diagnóstico: </strong>
              {summary.diagnostico.split(/(\*\*[^*]+\*\*)/).map((part: string, i: number) =>
                part.startsWith("**") && part.endsWith("**")
                  ? <strong key={i}>{part.slice(2, -2)}</strong>
                  : <span key={i}>{part}</span>
              )}
            </p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {summary.positivos?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-bold text-green-600 dark:text-green-400 mb-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" /> POSITIVOS
                </div>
                <ul className="space-y-1">
                  {summary.positivos.map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-green-500 shrink-0">·</span>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.atencao?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-bold text-red-600 dark:text-red-400 mb-1.5">
                  <AlertTriangle className="h-3.5 w-3.5" /> ATENÇÃO
                </div>
                <ul className="space-y-1">
                  {summary.atencao.map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-red-500 shrink-0">·</span>{item}</li>
                  ))}
                </ul>
              </div>
            )}
            {summary.acao?.length > 0 && (
              <div>
                <div className="flex items-center gap-1 text-xs font-bold text-blue-600 dark:text-blue-400 mb-1.5">
                  <Zap className="h-3.5 w-3.5" /> AÇÃO
                </div>
                <ul className="space-y-1">
                  {summary.acao.map((item, i) => (
                    <li key={i} className="text-xs text-foreground flex gap-1.5"><span className="text-blue-500 shrink-0">·</span>{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {updatedAt && (
            <p className="text-[10px] text-muted-foreground mt-3">Atualizado em {formatDate(updatedAt)} · Modelo: GPT-5.5</p>
          )}
        </>
      )}
    </div>
  );
}
