import { useState, useEffect, useRef } from "react";
import { useApp } from "@/contexts/AppContext";
import { useAreas } from "@/hooks/useOKRData";
import { useAllUserAreas } from "@/hooks/useUserAreas";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Calendar, Building2, UserPlus, Pencil, Archive, Upload } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import * as XLSX from "xlsx";

type Area = Tables<"areas">;
type AppUser = Tables<"app_users">;

export default function Admin() {
  const { currentUser, cycles, users, currentUserAreaIds } = useApp();
  const { data: areas } = useAreas();
  const { data: allUserAreas, refetch: refetchUserAreas } = useAllUserAreas();
  const qc = useQueryClient();

  const [dialog, setDialog] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([]);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingUser, setEditingUser] = useState<AppUser | null>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const role = currentUser?.role;
  const isOwner = role === "owner";
  const isAdmin = role === "admin";
  const isAdminOrOwner = isAdmin || isOwner;

  if (!isAdminOrOwner) {
    return <div className="text-center py-20 text-muted-foreground">Acesso restrito a administradores e owners</div>;
  }

  // Helper: get area IDs for a user
  function getUserAreaIds(userId: string): string[] {
    return (allUserAreas || []).filter((ua: any) => ua.user_id === userId).map((ua: any) => ua.area_id);
  }

  // Admin can only manage users in their areas
  const visibleUsers = isOwner
    ? users
    : users.filter((u) => {
        const uAreas = getUserAreaIds(u.id);
        return uAreas.some((aId) => currentUserAreaIds.includes(aId));
      });

  const visibleAreas = isOwner ? (areas || []) : (areas || []).filter((a) => currentUserAreaIds.includes(a.id));

  // --- Create handlers ---
  async function handleCreateCycle() {
    await supabase.from("cycles").insert({
      name: form.name,
      start_date: form.start_date,
      end_date: form.end_date,
      stagnation_days: parseInt(form.stagnation_days || "14"),
    });
    toast.success("Ciclo criado!");
    setDialog(null);
    setForm({});
    window.location.reload();
  }

  async function handleCreateArea() {
    await supabase.from("areas").insert({ name: form.name });
    toast.success("Área criada!");
    qc.invalidateQueries({ queryKey: ["areas"] });
    setDialog(null);
    setForm({});
  }

  async function handleCreateUser() {
    const { data: newUser, error } = await supabase.from("app_users").insert({
      name: form.name,
      email: form.email || null,
      role: isOwner ? (form.role || "viewer") : "viewer",
    }).select().single();

    if (error || !newUser) {
      toast.error("Erro ao criar usuário");
      return;
    }

    // Save area associations
    if (selectedAreaIds.length > 0) {
      await supabase.from("user_areas").insert(
        selectedAreaIds.map((aId) => ({ user_id: newUser.id, area_id: aId }))
      );
    }

    toast.success("Usuário criado!");
    setDialog(null);
    setForm({});
    setSelectedAreaIds([]);
    refetchUserAreas();
    window.location.reload();
  }

  // --- Edit handlers ---
  function openEditArea(area: Area) {
    setEditingArea(area);
    setForm({ name: area.name });
    setDialog("edit-area");
  }

  async function handleEditArea() {
    if (!editingArea) return;
    await supabase.from("areas").update({ name: form.name }).eq("id", editingArea.id);
    toast.success("Área atualizada!");
    qc.invalidateQueries({ queryKey: ["areas"] });
    setDialog(null);
    setForm({});
    setEditingArea(null);
  }

  async function handleArchiveArea(area: Area) {
    if (!isOwner) return;
    await supabase.from("areas").update({ archived: true }).eq("id", area.id);
    toast.success("Área arquivada!");
    qc.invalidateQueries({ queryKey: ["areas"] });
  }

  function openEditUser(user: AppUser) {
    setEditingUser(user);
    setForm({
      name: user.name,
      email: user.email || "",
      role: user.role,
    });
    setSelectedAreaIds(getUserAreaIds(user.id));
    setDialog("edit-user");
  }

  async function handleEditUser() {
    if (!editingUser) return;

    const updatePayload: any = {
      name: form.name,
      email: form.email || null,
    };

    // Only owner can change roles
    if (isOwner) {
      updatePayload.role = form.role;
    }

    await supabase.from("app_users").update(updatePayload).eq("id", editingUser.id);

    // Update area associations
    await supabase.from("user_areas").delete().eq("user_id", editingUser.id);
    if (selectedAreaIds.length > 0 && (form.role === "admin" || editingUser.role === "admin")) {
      await supabase.from("user_areas").insert(
        selectedAreaIds.map((aId) => ({ user_id: editingUser.id, area_id: aId }))
      );
    }

    toast.success("Usuário atualizado!");
    setDialog(null);
    setForm({});
    setEditingUser(null);
    setSelectedAreaIds([]);
    refetchUserAreas();
    window.location.reload();
  }

  async function handleArchiveUser(user: AppUser) {
    await supabase.from("app_users").update({ archived: true }).eq("id", user.id);
    toast.success("Usuário arquivado!");
    window.location.reload();
  }

  // --- Import handler ---
  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(sheet);

        let created = 0, updated = 0, errors = 0;

        for (const row of rows) {
          const name = (row["Nome"] || row["name"] || "").toString().trim();
          const email = (row["Email"] || row["email"] || "").toString().trim().toLowerCase();
          const areasStr = (row["Áreas"] || row["Areas"] || row["areas"] || "").toString().trim();
          const roleRaw = (row["Tipo de Acesso OKR"] || row["TIPO DE ACESSO OKR"] || row["tipo de acesso okr"] || row["Role"] || row["role"] || "").toString().trim().toLowerCase();

          if (!name || !email) { errors++; continue; }

          // Map role string
          let role = "viewer";
          if (roleRaw === "admin" || roleRaw === "administrador") role = "admin";
          else if (roleRaw === "owner" || roleRaw === "proprietário") role = "owner";
          else if (roleRaw === "viewer" || roleRaw === "visualizador" || roleRaw === "leitor") role = "viewer";

          // Resolve area IDs
          const areaNames = areasStr.split(",").map((s: string) => s.trim()).filter(Boolean);
          const resolvedAreaIds = areaNames
            .map((n: string) => (areas || []).find((a) => a.name.toLowerCase() === n.toLowerCase())?.id)
            .filter(Boolean) as string[];

          // Check if user exists
          const { data: existing } = await supabase
            .from("app_users")
            .select("id")
            .eq("email", email)
            .maybeSingle();

          if (existing) {
            // Update
            await supabase.from("app_users").update({ name, role }).eq("id", existing.id);
            // Update areas
            await supabase.from("user_areas").delete().eq("user_id", existing.id);
            if (resolvedAreaIds.length > 0) {
              await supabase.from("user_areas").insert(
                resolvedAreaIds.map((aId) => ({ user_id: existing.id, area_id: aId }))
              );
            }
            updated++;
          } else {
            // Create
            const { data: newUser, error } = await supabase.from("app_users").insert({
              name,
              email,
              role,
            }).select().single();

            if (error || !newUser) { errors++; continue; }

            if (resolvedAreaIds.length > 0) {
              await supabase.from("user_areas").insert(
                resolvedAreaIds.map((aId) => ({ user_id: newUser.id, area_id: aId }))
              );
            }
            created++;
          }
        }

        setImportResult({ created, updated, errors });
        setDialog("import-result");
        refetchUserAreas();
        window.location.reload();
      } catch (err: any) {
        toast.error("Erro ao importar: " + err?.message);
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const showRoleField = isOwner;
  const editRoleValue = form.role || "viewer";
  const showAreasField = editRoleValue === "admin";

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold tracking-tight">Administração</h1>

      <Tabs defaultValue={isOwner ? "cycles" : "areas"}>
        <TabsList>
          {isOwner && <TabsTrigger value="cycles">Ciclos</TabsTrigger>}
          <TabsTrigger value="areas">Áreas</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
        </TabsList>

        {isOwner && (
          <TabsContent value="cycles" className="space-y-4 mt-4">
            <Button onClick={() => setDialog("cycle")}><Plus className="h-4 w-4 mr-2" />Novo Ciclo</Button>
            {cycles.map((c) => (
              <Card key={c.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div>
                    <div className="font-semibold">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.start_date} — {c.end_date} · Estagnação: {c.stagnation_days}d</div>
                  </div>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        )}

        <TabsContent value="areas" className="space-y-4 mt-4">
            <Button onClick={() => { setForm({}); setDialog("area"); }}><Plus className="h-4 w-4 mr-2" />Nova Área</Button>
            {(areas || []).map((a) => (
              <Card key={a.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{a.name}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEditArea(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {isOwner && (
                      <Button variant="ghost" size="icon" onClick={() => handleArchiveArea(a)}>
                        <Archive className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

        <TabsContent value="users" className="space-y-4 mt-4">
          <div className="flex gap-2">
            <Button onClick={() => { setForm({}); setSelectedAreaIds([]); setDialog("user"); }}>
              <Plus className="h-4 w-4 mr-2" />Novo Usuário
            </Button>
            <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="h-4 w-4 mr-2" />Importar Usuários
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={handleImport}
            />
          </div>
          {visibleUsers.map((u) => {
            const uAreaIds = getUserAreaIds(u.id);
            const uAreaNames = uAreaIds
              .map((aId) => (areas || []).find((a) => a.id === aId)?.name)
              .filter(Boolean);
            return (
              <Card key={u.id}>
                <CardContent className="pt-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <UserPlus className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium text-sm">{u.name}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                      {uAreaNames.length > 0 && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Áreas: {uAreaNames.join(", ")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-secondary">{u.role}</span>
                    <Button variant="ghost" size="icon" onClick={() => openEditUser(u)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {(isOwner || (isAdmin && u.role !== "owner")) && (
                      <Button variant="ghost" size="icon" onClick={() => handleArchiveUser(u)}>
                        <Archive className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
      </Tabs>

      {/* Create Cycle */}
      <Dialog open={dialog === "cycle"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Ciclo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input placeholder="2026.2" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Início</Label><Input type="date" value={form.start_date || ""} onChange={(e) => setForm({ ...form, start_date: e.target.value })} /></div>
            <div><Label>Fim</Label><Input type="date" value={form.end_date || ""} onChange={(e) => setForm({ ...form, end_date: e.target.value })} /></div>
            <div><Label>Dias de estagnação</Label><Input type="number" value={form.stagnation_days || "14"} onChange={(e) => setForm({ ...form, stagnation_days: e.target.value })} /></div>
            <Button onClick={handleCreateCycle} className="w-full">Criar Ciclo</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Area */}
      <Dialog open={dialog === "area"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Área</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input placeholder="Produto" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <Button onClick={handleCreateArea} className="w-full">Criar Área</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Area */}
      <Dialog open={dialog === "edit-area"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Área</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <Button onClick={handleEditArea} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create User */}
      <Dialog open={dialog === "user"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            {showRoleField && (
              <div>
                <Label>Role</Label>
                <Select value={form.role || "viewer"} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {(showRoleField ? (form.role || "viewer") === "admin" : true) && (
              <div>
                <Label>Áreas</Label>
                <div className="space-y-2 mt-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {(isOwner ? (areas || []) : visibleAreas).map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedAreaIds.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAreaIds((prev) =>
                            checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                          );
                        }}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleCreateUser} className="w-full">Criar Usuário</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User */}
      <Dialog open={dialog === "edit-user"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Usuário</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome</Label><Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Email</Label><Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            {showRoleField && (
              <div>
                <Label>Role</Label>
                <Select value={form.role || "viewer"} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showAreasField && (
              <div>
                <Label>Áreas</Label>
                <div className="space-y-2 mt-1 max-h-40 overflow-y-auto border rounded-md p-2">
                  {(isOwner ? (areas || []) : visibleAreas).map((a) => (
                    <label key={a.id} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={selectedAreaIds.includes(a.id)}
                        onCheckedChange={(checked) => {
                          setSelectedAreaIds((prev) =>
                            checked ? [...prev, a.id] : prev.filter((id) => id !== a.id)
                          );
                        }}
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={handleEditUser} className="w-full">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Import Result */}
      <Dialog open={dialog === "import-result"} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resultado da Importação</DialogTitle></DialogHeader>
          {importResult && (
            <div className="space-y-2">
              <p className="text-sm">✅ Criados: <strong>{importResult.created}</strong></p>
              <p className="text-sm">🔄 Atualizados: <strong>{importResult.updated}</strong></p>
              {importResult.errors > 0 && (
                <p className="text-sm text-destructive">❌ Erros: <strong>{importResult.errors}</strong></p>
              )}
              <Button onClick={() => setDialog(null)} className="w-full mt-2">Fechar</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
