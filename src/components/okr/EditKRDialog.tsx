import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  kr: any;
}

export default function EditKRDialog({ open, onOpenChange, kr }: Props) {
  const { users } = useApp();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(kr.title);
  const [ownerUserId, setOwnerUserId] = useState(kr.owner_user_id);
  const [unit, setUnit] = useState(kr.unit);
  const [direction, setDirection] = useState(kr.direction);
  const [grade0, setGrade0] = useState(String(kr.grade0_value));
  const [grade1, setGrade1] = useState(String(kr.grade1_value));
  const [measurementType, setMeasurementType] = useState(kr.measurement_type || "accumulated");
  const [saving, setSaving] = useState(false);

  const ownerUsers = useMemo(() => (users || []).filter((u) => u.role === "admin" || u.role === "owner"), [users]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("key_results").update({
        title: title.trim(),
        owner_user_id: ownerUserId,
        unit,
        direction,
        grade0_value: parseFloat(grade0) || 0,
        grade1_value: parseFloat(grade1) || 100,
        measurement_type: measurementType,
      }).eq("id", kr.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      queryClient.invalidateQueries({ queryKey: ["kr-detail"] });
      toast({ title: "Key Result atualizado!" });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: "Erro ao atualizar", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Editar Key Result</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Owner *</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ownerUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
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
                  <SelectItem value="boolean">Sim/Não</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Direção</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Aumentar</SelectItem>
                  <SelectItem value="decrease">Diminuir</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Tipo de Medição</Label>
            <Select value={measurementType} onValueChange={setMeasurementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="accumulated">Acumulado</SelectItem>
                <SelectItem value="average">Média</SelectItem>
                <SelectItem value="milestone">Marco</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {measurementType === "accumulated" && "Soma os registros mensais (padrão)"}
              {measurementType === "average" && "A meta é atingida quando a média dos registros chegar ao Grade 1"}
              {measurementType === "milestone" && "Acontece ou não em uma data específica"}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Grade 0 (mínimo esperado)</Label>
              <Input type="number" value={grade0} onChange={(e) => setGrade0(e.target.value)} />
              <p className="text-xs text-muted-foreground">Informativo, não usado no cálculo</p>
            </div>
            <div className="space-y-2">
              <Label>Grade 1 (meta final)</Label>
              <Input type="number" value={grade1} onChange={(e) => setGrade1(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !ownerUserId || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
