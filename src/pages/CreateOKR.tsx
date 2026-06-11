import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "@/contexts/AppContext";
import { useAreas } from "@/hooks/useOKRData";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ChevronRight, ChevronLeft, Check } from "lucide-react";

interface KRForm {
  title: string;
  owner_user_id: string;
  unit: string;
  direction: string;
  grade0_value: string;
  grade1_value: string;
  measurement_type: string;
  has_milestones: boolean;
  expected_progress_mode: string;
  milestones: MilestoneForm[];
}

interface MilestoneForm {
  title: string;
  weight: string;
  target_value: string;
  due_date: string;
}

const emptyKR = (): KRForm => ({
  title: "", owner_user_id: "", unit: "number", direction: "increase",
  grade0_value: "0", grade1_value: "100", measurement_type: "accumulated",
  has_milestones: false, expected_progress_mode: "linear", milestones: [],
});

const emptyMilestone = (): MilestoneForm => ({ title: "", weight: "0.5", target_value: "", due_date: "" });

export default function CreateOKR() {
  const navigate = useNavigate();
  const { currentUser, currentCycle, users, currentUserAreaIds } = useApp();
  const { data: areas } = useAreas();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  // Step 1 - Objective
  const [areaId, setAreaId] = useState("");
  const [ownerUserId, setOwnerUserId] = useState(currentUser?.id || "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [weight, setWeight] = useState("1");

  // Step 2 - KRs
  const [krs, setKrs] = useState<KRForm[]>([emptyKR()]);

  const ownerUsers = useMemo(() => {
    return (users || []).filter((u) => u.role === "admin" || u.role === "owner");
  }, [users]);

  // Admins can only create OKRs for their areas; owners see all areas
  const availableAreas = useMemo(() => {
    if (!areas) return [];
    if (currentUser?.role === "owner") return areas;
    return areas.filter((a) => currentUserAreaIds.includes(a.id));
  }, [areas, currentUser, currentUserAreaIds]);

  const hasMilestoneStep = krs.some((kr) => kr.has_milestones);
  const steps = ["Objetivo", "Key Results", ...(hasMilestoneStep ? ["Milestones"] : [])];

  function updateKR(idx: number, patch: Partial<KRForm>) {
    setKrs((prev) => prev.map((kr, i) => i === idx ? { ...kr, ...patch } : kr));
  }

  function removeKR(idx: number) {
    if (krs.length <= 1) return;
    setKrs((prev) => prev.filter((_, i) => i !== idx));
  }

  function addMilestone(krIdx: number) {
    updateKR(krIdx, { milestones: [...krs[krIdx].milestones, emptyMilestone()] });
  }

  function updateMilestone(krIdx: number, mIdx: number, patch: Partial<MilestoneForm>) {
    const ms = krs[krIdx].milestones.map((m, i) => i === mIdx ? { ...m, ...patch } : m);
    updateKR(krIdx, { milestones: ms });
  }

  function removeMilestone(krIdx: number, mIdx: number) {
    updateKR(krIdx, { milestones: krs[krIdx].milestones.filter((_, i) => i !== mIdx) });
  }

  function validateStep0() {
    return title.trim() && areaId && ownerUserId;
  }

  function validateStep1() {
    return krs.every((kr) => kr.title.trim() && kr.owner_user_id);
  }

  function validateMilestones() {
    return krs.filter((kr) => kr.has_milestones).every((kr) => {
      if (kr.milestones.length === 0) return false;
      const sum = kr.milestones.reduce((s, m) => s + parseFloat(m.weight || "0"), 0);
      const baseValid = Math.abs(sum - 1) < 0.01 && kr.milestones.every((m) => m.title.trim() && m.target_value);
      if (kr.expected_progress_mode === "milestone_dates") {
        return baseValid && kr.milestones.every((m) => m.due_date);
      }
      return baseValid;
    });
  }

  function canAdvance() {
    if (step === 0) return validateStep0();
    if (step === 1) return validateStep1();
    if (step === 2) return validateMilestones();
    return true;
  }

  async function handleSave() {
    if (!currentCycle || !currentUser) return;
    setSaving(true);
    try {
      const { data: obj, error: objErr } = await supabase.from("objectives").insert({
        cycle_id: currentCycle.id,
        area_id: areaId,
        owner_user_id: ownerUserId,
        title: title.trim(),
        description: description.trim() || null,
        weight: parseFloat(weight) || 1,
      }).select().single();

      if (objErr || !obj) throw objErr;

      for (const kr of krs) {
        const { data: krData, error: krErr } = await supabase.from("key_results").insert({
          objective_id: obj.id,
          cycle_id: currentCycle.id,
          area_id: areaId,
          owner_user_id: kr.owner_user_id,
          title: kr.title.trim(),
          unit: kr.unit,
          direction: kr.direction,
          grade0_value: parseFloat(kr.grade0_value) || 0,
          grade1_value: parseFloat(kr.grade1_value) || 100,
          measurement_type: kr.measurement_type,
          current_value: null,
          has_milestones: kr.has_milestones,
          expected_progress_mode: kr.expected_progress_mode,
        }).select().single();

        if (krErr || !krData) throw krErr;

        if (kr.has_milestones && kr.milestones.length > 0) {
          const msInserts = kr.milestones.map((m) => ({
            key_result_id: krData.id,
            title: m.title.trim(),
            weight: parseFloat(m.weight) || 0.5,
            target_value: parseFloat(m.target_value) || 1,
            due_date: m.due_date || null,
          }));
          const { error: msErr } = await supabase.from("milestones").insert(msInserts);
          if (msErr) throw msErr;
        }
      }

      queryClient.invalidateQueries({ queryKey: ["objectives"] });
      queryClient.invalidateQueries({ queryKey: ["key_results"] });
      queryClient.invalidateQueries({ queryKey: ["milestones"] });
      toast({ title: "OKR criado com sucesso!" });
      navigate("/okrs");
    } catch (err: any) {
      toast({ title: "Erro ao criar OKR", description: err?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const isLastStep = hasMilestoneStep ? step === 2 : step === 1;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Novo OKR</h1>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold ${
              i < step ? "bg-primary text-primary-foreground" : i === step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={`text-sm font-medium ${i === step ? "text-foreground" : "text-muted-foreground"}`}>{s}</span>
            {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step 0 - Objective */}
      {step === 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Objetivo</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Área *</Label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {availableAreas.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capitão *</Label>
              <Select value={ownerUserId} onValueChange={setOwnerUserId}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {ownerUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Título *</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Aumentar receita recorrente" />
            </div>
            <div className="space-y-2">
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1 - Key Results */}
      {step === 1 && (
        <div className="space-y-4">
          {krs.map((kr, idx) => (
            <Card key={idx}>
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-sm">KR {idx + 1}</CardTitle>
                {krs.length > 1 && (
                  <Button variant="ghost" size="icon" onClick={() => removeKR(idx)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input value={kr.title} onChange={(e) => updateKR(idx, { title: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Capitão *</Label>
                  <Select value={kr.owner_user_id} onValueChange={(v) => updateKR(idx, { owner_user_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {ownerUsers.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Unidade</Label>
                    <Select value={kr.unit} onValueChange={(v) => updateKR(idx, { unit: v })}>
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
                    <Select value={kr.direction} onValueChange={(v) => updateKR(idx, { direction: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="increase">Quanto maior melhor ↑</SelectItem>
                        <SelectItem value="decrease">Quanto menor melhor ↓</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Medição</Label>
                  <Select value={kr.measurement_type} onValueChange={(v) => updateKR(idx, { measurement_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accumulated">Acumulado</SelectItem>
                      <SelectItem value="average">Média</SelectItem>
                      <SelectItem value="maximum">Máximo</SelectItem>
                      <SelectItem value="maximum">Máximo</SelectItem>
                      <SelectItem value="milestone">Marco</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {kr.measurement_type === "accumulated" && "Soma os registros mensais (padrão)"}
                    {kr.measurement_type === "average" && "A meta é atingida quando a média dos registros chegar ao Grade 1"}
                    {kr.measurement_type === "maximum" && "O pico máximo registrado é o resultado final"}
                    {kr.measurement_type === "maximum" && "O pico máximo registrado é o resultado final"}
                    {kr.measurement_type === "milestone" && "Acontece ou não em uma data específica"}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Grade 0 (mínimo esperado)</Label>
                    <Input type="number" value={kr.grade0_value} onChange={(e) => updateKR(idx, { grade0_value: e.target.value })} />
                    <p className="text-xs text-muted-foreground">Valor informativo, não usado no cálculo de progresso</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Grade 1 (meta final)</Label>
                    <Input type="number" value={kr.grade1_value} onChange={(e) => updateKR(idx, { grade1_value: e.target.value })} />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Switch checked={kr.has_milestones} onCheckedChange={(v) => updateKR(idx, { has_milestones: v, milestones: v ? [emptyMilestone()] : [], expected_progress_mode: v ? kr.expected_progress_mode : "linear" })} />
                  <Label>Possui milestones</Label>
                </div>
                {kr.has_milestones && (
                  <div className="space-y-2">
                    <Label>Modo de progresso esperado</Label>
                    <Select value={kr.expected_progress_mode} onValueChange={(v) => updateKR(idx, { expected_progress_mode: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="linear">Linear (padrão)</SelectItem>
                        <SelectItem value="milestone_dates">Baseado em datas dos milestones</SelectItem>
                      </SelectContent>
                    </Select>
                    {kr.expected_progress_mode === "milestone_dates" && (
                      <p className="text-xs text-muted-foreground">
                        O progresso esperado será calculado com base nas datas de entrega dos milestones. Todos devem ter prazo definido.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" onClick={() => setKrs((prev) => [...prev, emptyKR()])} className="w-full">
            <Plus className="h-4 w-4 mr-2" /> Adicionar KR
          </Button>
        </div>
      )}

      {/* Step 2 - Milestones */}
      {step === 2 && (
        <div className="space-y-6">
          {krs.filter((kr) => kr.has_milestones).map((kr, krOrigIdx) => {
            const realIdx = krs.indexOf(kr);
            const weightSum = kr.milestones.reduce((s, m) => s + (parseFloat(m.weight) || 0), 0);
            return (
              <Card key={realIdx}>
                <CardHeader>
                  <CardTitle className="text-sm">Milestones — {kr.title || `KR ${realIdx + 1}`}</CardTitle>
                  <p className={`text-xs ${Math.abs(weightSum - 1) < 0.01 ? "text-status-on-track" : "text-status-off-track"}`}>
                    Soma dos pesos: {weightSum.toFixed(2)} {Math.abs(weightSum - 1) < 0.01 ? "✓" : "(deve ser 1.00)"}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4">
                  {kr.milestones.map((m, mIdx) => (
                    <div key={mIdx} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-2 items-end">
                      <div className="space-y-1">
                        <Label className="text-xs">Título</Label>
                        <Input value={m.title} onChange={(e) => updateMilestone(realIdx, mIdx, { title: e.target.value })} />
                      </div>
                      <div className="space-y-1 w-20">

                      </div>
                      <div className="space-y-1 w-24">
                        <Label className="text-xs">Meta</Label>
                        <Input type="number" value={m.target_value} onChange={(e) => updateMilestone(realIdx, mIdx, { target_value: e.target.value })} />
                      </div>
                      <div className="space-y-1 w-32">
                        <Label className="text-xs">Prazo</Label>
                        <Input type="date" value={m.due_date} onChange={(e) => updateMilestone(realIdx, mIdx, { due_date: e.target.value })} />
                      </div>
                      <Button variant="ghost" size="icon" onClick={() => removeMilestone(realIdx, mIdx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={() => addMilestone(realIdx)}>
                    <Plus className="h-4 w-4 mr-1" /> Milestone
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0}>
          <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
        </Button>
        {isLastStep ? (
          <Button onClick={handleSave} disabled={!canAdvance() || saving}>
            {saving ? "Salvando..." : "Criar OKR"}
          </Button>
        ) : (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canAdvance()}>
            Próximo <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
