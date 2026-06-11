import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useApp } from "@/contexts/AppContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  objectiveId: string;
  cycleId: string;
  areaId: string | null;
}

export default function AddKRDialog({ open, onOpenChange, objectiveId, cycleId, areaId }: Props) {
  const { users, currentUser } = useApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState("");
  const [grade0, setGrade0] = useState("");
  const [grade1, setGrade1] = useState("");
  const [unit, setUnit] = useState("number");
  const [direction, setDirection] = useState("increase");
  const [ownerId, setOwnerId] = useState(currentUser?.id || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!title.trim() || !grade1) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("key_results").insert({
        objective_id: objectiveId,
        cycle_id: cycleId,
        area_id: areaId,
        owner_user_id: ownerId || currentUser?.id,
        title: title.trim(),
        unit,
        direction,
        grade0_value: parseFloat(grade0) || 0,
        grade1_value: parseFloat(grade1) || 1,
        has_milestones: false,
        measurement_type: "accumulated",
        expected_progress_mode: "linear",
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      toast({ title: "KR criado!" });
      onOpenChange(false);
      setTitle(""); setGrade0(""); setGrade1(""); setUnit("number"); setDirection("increase");
    } catch (err: any) {
      toast({ title: "Erro ao criar KR", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Novo Key Result</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Descreva o resultado esperado" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grade 0 (mínimo)</Label>
              <Input type="number" value={grade0} onChange={(e) => setGrade0(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-2">
              <Label>Grade 1 (meta) *</Label>
              <Input type="number" value={grade1} onChange={(e) => setGrade1(e.target.value)} placeholder="100" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Unidade</Label>
              <Select value={unit} onValueChange={setUnit}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="number">Número</SelectItem>
                  <SelectItem value="percent">Percentual</SelectItem>
                  <SelectItem value="currency">Moeda</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direção</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Quanto maior melhor ↑</SelectItem>
                  <SelectItem value="decrease">Quanto menor melhor ↓</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Capitão</Label>
            <Select value={ownerId} onValueChange={setOwnerId}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {users.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !grade1 || saving}>
              {saving ? "Salvando..." : "Criar KR"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
