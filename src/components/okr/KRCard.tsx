import { useState, useMemo } from "react";
import { ClipboardCheck, ChevronRight, User, Calendar, Pencil, Trash2, MessageSquare } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import StatusBadge from "./StatusBadge";
import ProgressBar from "./ProgressBar";
import CheckinDialog from "./CheckinDialog";
import EditKRDialog from "./EditKRDialog";
import DeleteConfirmDialog from "./DeleteConfirmDialog";
import Sparkline from "./Sparkline";
import { progressKR, getKRStatus, formatPercent, formatValue, expectedProgressKR } from "@/lib/okr-utils";
import { useApp } from "@/contexts/AppContext";
import type { Tables } from "@/integrations/supabase/types";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  kr: Tables<"key_results"> & { app_users?: { name: string } | null; teams?: { name: string } | null; areas?: { name: string } | null };
  milestones?: Tables<"milestones">[];
  checkins?: any[];
}




export default function KRCard({ kr, milestones, checkins }: Props) {
  const { currentUser, currentCycle, currentUserAreaIds } = useApp();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMilestoneDates = kr.expected_progress_mode === "milestone_dates";

  const nextEvent = useMemo(() => {
    if (!isMilestoneDates || !milestones?.length) return null;
    const now = Date.now();
    const future = milestones
      .filter((m) => m.due_date && new Date(m.due_date).getTime() > now)
      .sort((a, b) => new Date(a.due_date!).getTime() - new Date(b.due_date!).getTime());
    if (!future.length) return null;
    const d = new Date(future[0].due_date!);
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  }, [isMilestoneDates, milestones]);

  if (!currentCycle) return null;

  const progress = progressKR(kr, milestones, checkins);
  const status = getKRStatus(kr, currentCycle, milestones, checkins);
  const expected = expectedProgressKR(kr, currentCycle, milestones);
  const isOwner = currentUser?.role === "owner";
  const isAdminWithArea = currentUser?.role === "admin" && kr.area_id && currentUserAreaIds.includes(kr.area_id);
  const canCheckin = isOwner || isAdminWithArea;
  const canEdit = isOwner || isAdminWithArea;

  const isAverage = (kr as any).measurement_type === "average";
  const isMaximum = (kr as any).measurement_type === "maximum";
  const accumulatedValue = checkins && checkins.length > 0
    ? checkins.reduce((sum: number, c: any) => sum + c.value, 0)
    : kr.current_value;
  const displayValue = isAverage && checkins && checkins.length > 0
    ? accumulatedValue! / checkins.length
    : isMaximum && checkins && checkins.length > 0
    ? Math.max(...checkins.map((c: any) => c.value))
    : accumulatedValue;

  async function handleDelete() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("key_results").update({ archived: true }).eq("id", kr.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      toast({ title: "Key Result excluído!" });
      setDeleteOpen(false);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-4 p-4 rounded-lg bg-card hover:shadow-md transition-shadow animate-fade-in" style={{
        border:"1px solid hsl(var(--border))",
        borderLeft: status === "off-track" ? "4px solid #e5273c" : status === "at-risk" ? "4px solid #f8ae13" : status === "completed" ? "4px solid #22c55e" : "4px solid #2659a5"
      }}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-xs font-mono text-muted-foreground">{kr.external_id}</span>
            <StatusBadge status={status} />
            {kr.teams?.name && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {kr.teams.name}
              </span>
            )}
            {kr.areas?.name && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-medium">
                {kr.areas.name}
              </span>
            )}
            {isMilestoneDates && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">Baseado em eventos</span>
            )}
          </div>
          <div className="flex items-start gap-1.5">
            <Link to={`/kr/${kr.id}`} className="font-medium text-sm hover:text-primary transition-colors line-clamp-1 flex-1">
              {kr.title}
            </Link>
            {(kr as any).description && (
              <TooltipProvider delayDuration={100}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <MessageSquare className="h-3.5 w-3.5 text-blue-500 shrink-0 mt-0.5 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[320px]">
                    <p className="text-xs font-semibold mb-1">Fala de C-Level</p>
                    <p className="text-xs text-muted-foreground italic">{(kr as any).description}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <ProgressBar progress={progress} status={status} expected={expected} className="mt-2" />
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">{formatPercent(progress)}</span>
            
            {currentCycle && checkins && checkins.length > 0 && (
              <Sparkline kr={kr} cycle={currentCycle} checkins={checkins} />
            )}
            <span>{isAverage ? "Média" : isMaximum ? "Máximo" : "Acumulado"}: {formatValue(displayValue, kr.unit)}</span>
            <span>Meta: {formatValue(kr.grade1_value, kr.unit)}</span>
            {nextEvent && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Próximo evento: {nextEvent}
              </span>
            )}
            {kr.app_users && (
              <span className="flex items-center gap-1 ml-auto">
                <User className="h-3 w-3" />
                {kr.app_users.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          {canEdit && (
            <>
              <Button variant="ghost" size="icon" onClick={() => setEditOpen(true)} title="Editar KR">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => setDeleteOpen(true)} title="Excluir KR" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </>
          )}
          {canCheckin && (
            <Button variant="ghost" size="icon" onClick={() => setCheckinOpen(true)} title="Check-in">
              <ClipboardCheck className="h-4 w-4" />
            </Button>
          )}
          <Link to={`/kr/${kr.id}`}>
            <Button variant="ghost" size="icon">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </div>
      <CheckinDialog open={checkinOpen} onOpenChange={setCheckinOpen} kr={kr} milestones={milestones} />
      {editOpen && <EditKRDialog open={editOpen} onOpenChange={setEditOpen} kr={kr} />}
      <DeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Excluir Key Result"
        description="Tem certeza que deseja excluir este Key Result?"
        onConfirm={handleDelete}
        loading={deleting}
      />
    </>
  );
}
