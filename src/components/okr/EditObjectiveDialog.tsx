import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApp } from "@/contexts/AppContext";
import { useAreas } from "@/hooks/useOKRData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  objective: any;
}

export default function EditObjectiveDialog({ open, onOpenChange, objective }: Props) {
  const { users } = useApp();
  const { data: areas } = useAreas();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [title, setTitle] = useState(objective.title);
  const [description, setDescription] = useState(objective.description || "");
  const [ownerUserId, setOwnerUserId] = useState(objective.owner_user_id);
  const [areaId, setAreaId] = useState(objective.area_id || "");
  const [weight, setWeight] = useState(String(objective.weight));
  const [saving, setSaving] = useState(false);

  const ownerUsers = useMemo(() => (users || []).filter((u) => u.role === "admin" || u.role === "owner"), [users]);

  async function handleSave() {
    setSaving(true);
    try {
      const { error } = await supabase.from("objectives").update({
        title: title.trim(),
        description: description.trim() || null,
        owner_user_id: ownerUserId,
        area_id: areaId || null,
        weight: parseFloat(weight) || 1,
      }).eq("id", objective.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["objectives"] });
      toast({ title: "Objetivo atualizado!" });
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
        <DialogHeader><DialogTitle>Editar Objetivo</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Capitão *</Label>
            <Select value={ownerUserId} onValueChange={setOwnerUserId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ownerUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Área *</Label>
            <Select value={areaId} onValueChange={setAreaId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {(areas || []).map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Peso</Label>
            <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} min="0" step="0.1" />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!title.trim() || !areaId || !ownerUserId || saving}>
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
