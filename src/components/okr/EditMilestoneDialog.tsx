import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  milestone: any;
}

export default function EditMilestoneDialog({ open, onOpenChange, milestone }: Props) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(milestone.title);
  const [weight, setWeight] = useState(String(milestone.weight));
  const [targetValue, setTargetValue] = useState(String(milestone.target_value));
  const [dueDate, setDueDate] = useState(milestone.due_date || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("milestones").update({
        title: title.trim(),
        weight: parseFloat(weight) || 0.5,
        target_value: parseFloat(targetValue) || 1,
        due_date: dueDate || null,
      }).eq("id", milestone.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      queryClient.invalidateQueries({ queryKey: ["milestones-detail"] });
      toast({ title: "Milestone atualizado!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Editar Milestone</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Peso</Label>
              <Input type="number" step="0.1" min="0" max="1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Meta</Label>
              <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Prazo</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
