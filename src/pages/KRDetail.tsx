import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { useCheckins } from "@/hooks/useOKRData";
import { progressKR, progressMilestone, getKRStatus, getMilestoneStatus, expectedProgressKR, formatPercent, formatValue } from "@/lib/okr-utils";
import StatusBadge from "@/components/okr/StatusBadge";
import ProgressBar from "@/components/okr/ProgressBar";
import CheckinDialog from "@/components/okr/CheckinDialog";
import EditCheckinDialog from "@/components/okr/EditCheckinDialog";
import EditKRDialog from "@/components/okr/EditKRDialog";
import EditMilestoneDialog from "@/components/okr/EditMilestoneDialog";
import DeleteConfirmDialog from "@/components/okr/DeleteConfirmDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ClipboardCheck, User, Building2, Calendar, Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

export default function KRDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentCycle, currentUser, currentUserAreaIds } = useApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [checkinOpen, setCheckinOpen] = useState(false);
  const [editKROpen, setEditKROpen] = useState(false);
  const [editMilestone, setEditMilestone] = useState<any>(null);
  const [editCheckin, setEditCheckin] = useState<any>(null);
  const [deleteKR, setDeleteKR] = useState(false);
  const [deleteMilestone, setDeleteMilestone] = useState<any>(null);
  const [deleteCheckin, setDeleteCheckin] = useState<any>(null);
  const [deleting, setDeleting] = useState(false);

  const { data: kr } = useQuery({
    queryKey: ["kr-detail", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("key_results")
        .select("*, app_users(name), areas(name), objectives(title, external_id)")
        .eq("id", id!)
        .single();
      return data;
    },
    enabled: !!id,
  });

  const { data: milestones } = useQuery({
    queryKey: ["milestones-detail", id],
    queryFn: async () => {
      const { data } = await supabase.from("milestones").select("*").eq("key_result_id", id!).eq("archived", false);
      return data || [];
    },
    enabled: !!id,
  });

  const { data: checkins } = useCheckins(id || "");

  if (!kr || !currentCycle) return null;

  const progress = progressKR(kr, milestones || undefined, checkins || undefined);
  const status = getKRStatus(kr, currentCycle, milestones || undefined, checkins || undefined);
  const expected = expectedProgressKR(kr, currentCycle, milestones || undefined);
  const isOwner = currentUser?.role === "owner";
  const isAdminWithArea = currentUser?.role === "admin" && kr.area_id && currentUserAreaIds.includes(kr.area_id);
  const canCheckin = isOwner || isAdminWithArea;
  const canEdit = isOwner || isAdminWithArea;
  const isMilestoneDates = (kr as any).expected_progress_mode === "milestone_dates";

  const isAverage = (kr as any).measurement_type === "average";
  const accumulatedValue = checkins && checkins.length > 0
    ? checkins.reduce((sum: number, c: any) => sum + c.value, 0)
    : kr.current_value;
  const displayValue = isAverage && checkins && checkins.length > 0
    ? accumulatedValue! / checkins.length
    : accumulatedValue;

  async function handleDeleteKR() {
    setDeleting(true);
    try {
      const { error } = await supabase.from("key_results").update({ archived: true }).eq("id", kr.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      toast({ title: "Key Result excluído!" });
      navigate("/okrs");
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteMilestone() {
    if (!deleteMilestone) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("milestones").update({ archived: true }).eq("id", deleteMilestone.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones-detail"] });
      toast({ title: "Milestone excluído!" });
      setDeleteMilestone(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteCheckin() {
    if (!deleteCheckin) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("checkins").delete().eq("id", deleteCheckin.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["checkins"] });
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones-detail"] });
      queryClient.invalidateQueries({ queryKey: ["kr-detail"] });
      queryClient.invalidateQueries({ queryKey: ["all-checkins"] });
      toast({ title: "Check-in excluído!" });
      setDeleteCheckin(null);
    } catch (err: any) {
      toast({ title: "Erro ao excluir", description: err?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <Link to="/okrs" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="h-4 w-4" /> Voltar aos OKRs
      </Link>

      {/* Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono text-muted-foreground">{kr.external_id}</span>
                <StatusBadge status={status} />
                {isMilestoneDates && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">Baseado em eventos</span>
                )}
              </div>
              <h1 className="text-xl font-bold">{kr.title}</h1>
              <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{(kr as any).app_users?.name}</span>
                <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />Área: {(kr as any).areas?.name}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Objetivo: {(kr as any).objectives?.external_id} — {(kr as any).objectives?.title}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              {canEdit && (
                <>
                  <Button variant="outline" onClick={() => setEditKROpen(true)}>
                    <Pencil className="h-4 w-4 mr-2" /> Editar
                  </Button>
                  <Button variant="outline" onClick={() => setDeleteKR(true)} className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                  </Button>
                </>
              )}
              {canCheckin && (
                <Button onClick={() => setCheckinOpen(true)}>
                  <ClipboardCheck className="h-4 w-4 mr-2" /> Check-in
                </Button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-3xl font-bold">{formatPercent(progress)}</span>
            <span className="text-sm text-muted-foreground">
              {isAverage ? "Média" : "Acumulado"}: {formatValue(displayValue, kr.unit)} / Meta: {formatValue(kr.grade1_value, kr.unit)}
            </span>
          </div>
          <ProgressBar progress={progress} status={status} expected={expected} />
        </CardContent>
      </Card>

      {/* Milestones */}
      {milestones && milestones.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Milestones</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {milestones.map((m) => {
              const mp = progressMilestone(m);
              const ms = getMilestoneStatus(m, currentCycle);
              return (
                <div key={m.id} className="p-3 rounded-lg border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.title}</span>
                      <StatusBadge status={ms} />
                      {canEdit && (
                        <>
                          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setEditMilestone(m)} title="Editar milestone">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={() => setDeleteMilestone(m)} title="Excluir milestone">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <span className="font-semibold text-foreground">{formatPercent(mp)}</span>
                      <span className="ml-2">Atual: {formatValue(m.current_value ?? 0, kr.unit)} / Meta: {formatValue(m.target_value, kr.unit)}</span>
                    </div>
                  </div>
                  <ProgressBar progress={mp} status={ms} />
                  {m.due_date && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(m.due_date), "dd MMM yyyy", { locale: ptBR })}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}


      {/* Checkin History */}
      <Card>
        <CardHeader><CardTitle className="text-base">Histórico de Check-ins</CardTitle></CardHeader>
        <CardContent>
          {(!checkins || checkins.length === 0) && <p className="text-sm text-muted-foreground">Nenhum check-in realizado</p>}
          <div className="space-y-3">
            {(checkins || []).map((c: any) => {
              const monthLabel = c.reference_month
                ? (() => {
                    const [y, m] = c.reference_month.split("-");
                    const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
                    return `${months[parseInt(m) - 1]} ${y}`;
                  })()
                : null;
              return (
                <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                  <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{c.app_users?.name}</span>
                      <span className="text-muted-foreground text-xs">
                        {format(new Date(c.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                      </span>
                      {monthLabel && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-accent text-accent-foreground font-medium">
                          Ref: {monthLabel}
                        </span>
                      )}
                    </div>
                    <div className="text-sm mt-0.5">
                      <span className="font-semibold">Valor: {c.value}</span>
                    </div>
                    {c.comment && <p className="text-sm text-muted-foreground mt-1">{c.comment}</p>}
                  </div>
                  {canEdit && (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditCheckin(c)} title="Editar check-in">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteCheckin(c)} title="Excluir check-in">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <CheckinDialog open={checkinOpen} onOpenChange={setCheckinOpen} kr={kr} milestones={milestones || undefined} />
      {editKROpen && <EditKRDialog open={editKROpen} onOpenChange={setEditKROpen} kr={kr} />}
      {editMilestone && <EditMilestoneDialog open={!!editMilestone} onOpenChange={(v) => !v && setEditMilestone(null)} milestone={editMilestone} />}
      {editCheckin && <EditCheckinDialog open={!!editCheckin} onOpenChange={(v) => { if (!v) setEditCheckin(null); }} checkin={editCheckin} />}
      <DeleteConfirmDialog open={deleteKR} onOpenChange={setDeleteKR} title="Excluir Key Result" description="Tem certeza que deseja excluir este Key Result? Você será redirecionado para a lista de OKRs." onConfirm={handleDeleteKR} loading={deleting} />
      <DeleteConfirmDialog open={!!deleteMilestone} onOpenChange={(v) => !v && setDeleteMilestone(null)} title="Excluir Milestone" description="Tem certeza que deseja excluir este milestone?" onConfirm={handleDeleteMilestone} loading={deleting} />
      <DeleteConfirmDialog open={!!deleteCheckin} onOpenChange={(v) => !v && setDeleteCheckin(null)} title="Excluir Check-in" description="Tem certeza que deseja excluir este check-in? O valor será recalculado automaticamente." onConfirm={handleDeleteCheckin} loading={deleting} />
    </div>
  );
}
