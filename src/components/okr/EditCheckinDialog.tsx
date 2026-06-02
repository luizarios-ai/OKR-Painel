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
import { buildMonthOptions } from "./CheckinDialog";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  checkin: {
    id: string;
    value: number;
    comment: string | null;
    reference_month?: string | null;
  };
}

export default function EditCheckinDialog({ open, onOpenChange, checkin }: Props) {
  const { currentCycle } = useApp();
  const qc = useQueryClient();
  const [value, setValue] = useState(String(checkin.value));
  const [comment, setComment] = useState(checkin.comment || "");
  const [referenceMonth, setReferenceMonth] = useState(checkin.reference_month || "");
  const [saving, setSaving] = useState(false);

  const monthOptions = useMemo(() => buildMonthOptions(currentCycle), [currentCycle]);

  async function handleSave() {
    if (!value || !referenceMonth) return;
    setSaving(true);

    const { error } = await supabase
      .from("checkins")
      .update({
        value: parseFloat(value),
        comment: comment || null,
        reference_month: referenceMonth,
      })
      .eq("id", checkin.id);

    if (error) {
      toast.error("Erro ao atualizar check-in");
    } else {
      qc.invalidateQueries({ queryKey: ["checkins"] });
      qc.invalidateQueries({ queryKey: ["key_results"] });
      qc.invalidateQueries({ queryKey: ["milestones"] });
      qc.invalidateQueries({ queryKey: ["milestones-detail"] });
      qc.invalidateQueries({ queryKey: ["kr-detail"] });
      qc.invalidateQueries({ queryKey: ["all-checkins"] });
      toast.success("Check-in atualizado!");
      onOpenChange(false);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Check-in</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Mês de referência *</Label>
            <select
              className="w-full mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={referenceMonth}
              onChange={(e) => setReferenceMonth(e.target.value)}
            >
              <option value="">Selecione o mês</option>
              {monthOptions.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <Label>Valor</Label>
            <Input type="number" step="any" value={value} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div>
            <Label>Comentário</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} />
          </div>
          <Button onClick={handleSave} disabled={saving || !value || !referenceMonth} className="w-full">
            {saving ? "Salvando..." : "Salvar alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
