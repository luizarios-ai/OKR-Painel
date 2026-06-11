import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/contexts/AppContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

/** Valid months: January to June only */
const VALID_MONTHS = [0, 1, 2, 3, 4, 5]; // Jan-Jun
const MONTH_NAMES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function buildMonthOptions(cycle?: Tables<"cycles"> | null): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  const start = cycle ? new Date(cycle.start_date) : new Date(now.getFullYear(), 0, 1);
  const end = cycle ? new Date(cycle.end_date) : new Date(now.getFullYear(), 5, 30);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor <= end) {
    if (VALID_MONTHS.includes(cursor.getMonth())) {
      const val = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`;
      options.push({ value: val, label: `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}` });
    }
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return options;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kr: Tables<"key_results">;
  milestones?: Tables<"milestones">[];
}

export default function CheckinDialog({ open, onOpenChange, kr, milestones }: Props) {
  const { currentUser, currentCycle } = useApp();
  const qc = useQueryClient();
  const [value, setValue] = useState("");
  const [comment, setComment] = useState("");
  const [milestoneId, setMilestoneId] = useState<string | null>(null);
  const [referenceMonth, setReferenceMonth] = useState("");
  const [saving, setSaving] = useState(false);

  const monthOptions = useMemo(() => buildMonthOptions(currentCycle), [currentCycle]);

  async function handleSave() {
    if (!currentUser || !value || !referenceMonth) return;
    setSaving(true);

    const numValue = parseFloat(value);

    await supabase.from("checkins").insert({
      key_result_id: kr.id,
      milestone_id: milestoneId,
      value: numValue,
      comment: comment || null,
      created_by_user_id: currentUser.id,
      reference_month: referenceMonth,
    });

    // current_value is recalculated automatically by DB trigger

    // Update all-checkins cache directly with the new checkin
    const newCheckin = {
      id: crypto.randomUUID(),
      key_result_id: kr.id,
      value: numValue,
      comment: comment || null,
      created_at: new Date().toISOString(),
      reference_month: referenceMonth,
      milestone_id: milestoneId || null,
    };
    qc.setQueriesData({ queryKey: ["all-checkins"] }, (old: any) => {
      if (!old) return [newCheckin];
      if (Array.isArray(old)) return [...old, newCheckin];
      return old;
    });
    qc.setQueriesData({ queryKey: ["checkins", kr.id] }, (old: any) => {
      if (!old) return [newCheckin];
      if (Array.isArray(old)) return [...old, newCheckin];
      return old;
    });
    // Also invalidate key_results so current_value refreshes from DB
    qc.invalidateQueries({ queryKey: ["key_results"] });
    qc.invalidateQueries({ queryKey: ["milestones"] });
    toast.success("Atualizado!");
    setValue("");
    setComment("");
    setMilestoneId(null);
    setReferenceMonth("");
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Check-in: {kr.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Mês de referência *</Label>
            <select
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
              required
            >
              <option value="">Selecione o mês</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          {kr.has_milestones && milestones && milestones.length > 0 && (
            <div>
              <Label>Milestone *</Label>
              <select
                className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={milestoneId || ""}
                onChange={(e) => setMilestoneId(e.target.value || null)}
                required
              >
                <option value="">Selecione o milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                KRs com milestones só podem ser atualizados através dos milestones.
              </p>
            </div>
          )}
          <div>
            <Label>Valor</Label>
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} placeholder="Ex: 42" />
          </div>
          <div>
            <Label>Comentário</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="O que mudou?" />
          </div>
          <Button onClick={handleSave} disabled={saving || !value || !referenceMonth || (kr.has_milestones && !milestoneId)} className="w-full">
            {saving ? "Salvando..." : "Salvar Check-in"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export { buildMonthOptions };
