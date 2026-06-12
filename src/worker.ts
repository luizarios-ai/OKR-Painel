const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Sync-Secret",
};

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status, headers: { ...CORS, "Content-Type": "application/json" },
  });
}

function buildPrompt(areaName: string, objectives: any[]): string {
  const lines: string[] = [];
  lines.push(`Você é analista de OKRs. Analise os dados abaixo da área "${areaName}" e gere um resumo executivo em JSON puro (sem markdown).`);
  lines.push(`Formato obrigatório (retorne SOMENTE este JSON, nada mais):`);
  lines.push(`{"diagnostico":"Use **negrito** para métricas importantes. Ex: **KR X em 70% vs meta 80%**. Máx 2 frases.","positivos":["item com dado concreto"],"atencao":["item com dado concreto"],"acao":["ação específica"]}`);
  lines.push(`\nDados dos OKRs:`);
  for (const obj of objectives) {
    lines.push(`\nObjetivo: ${obj.title} | Score: ${(obj.score * 100).toFixed(0)}%`);
    for (const kr of obj.keyResults || []) {
      lines.push(`  KR: ${kr.title} | Score: ${(kr.score * 100).toFixed(0)}% | Atual: ${kr.current ?? "—"} | Meta: ${kr.grade1}`);
      if (kr.monthly && kr.monthly.some((v: any) => v !== null)) {
        lines.push(`    Meses: ${kr.monthly.map((v: any, i: number) => v !== null ? v : "—").join(" | ")}`);
      }
    }
  }
  lines.push(`\nRegras: máx 2 itens por lista. Cite sempre valores reais. Use **negrito** para métricas no diagnóstico.`);
  return lines.join("\n");
}

function buildDashboardPrompt(cycleName: string, areas: any[]): string {
  const lines: string[] = [];
  lines.push(`Você é analista sênior de OKRs. Analise a performance do ciclo "${cycleName}" e gere um resumo executivo em JSON puro (sem markdown).`);
  lines.push(`Formato obrigatório (retorne SOMENTE este JSON):`);
  lines.push(`{"diagnostico":"Máx 2 frases sobre o estado geral. Use **negrito** para métricas.","positivos":["área/destaque com % real"],"atencao":["área/problema com % real"],"acao":["ação corretiva específica"]}`);
  lines.push(`
Performance por área no ciclo (score médio dos OKRs):`);
  const sorted = [...areas].sort((a, b) => b.progress - a.progress);
  for (const a of sorted) {
    const fill = a.fillRate != null ? ` | Atualização: ${a.fillRate}% dos KRs com check-in` : "";
    lines.push(`  - ${a.name}: ${a.progress}%${fill}`);
  }
  lines.push(`
Regras: cite sempre nomes de áreas e percentuais reais. Máx 3 itens por lista. Foco em áreas com baixa performance ou baixa taxa de atualização.`);
  return lines.join("\n");
}

export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: CORS });

    // GET cached summary
    if (url.pathname === "/api/ai-summary" && request.method === "GET") {
      const key = url.searchParams.get("key") || "";
      try {
        await env.DB.exec("CREATE TABLE IF NOT EXISTS ai_summaries (cache_key TEXT PRIMARY KEY, summary TEXT, updated_at TEXT)", []);
        const result = await env.DB.query("SELECT summary, updated_at FROM ai_summaries WHERE cache_key = ?", [key]);
        if (result.rows.length > 0) {
          return json({ summary: JSON.parse(result.rows[0].summary as string), updated_at: result.rows[0].updated_at, cached: true });
        }
        return json({ summary: null });
      } catch { return json({ summary: null }); }
    }

    // POST generate summary
    if (url.pathname === "/api/ai-summary" && request.method === "POST") {
      const apiKey = env.OPENAI_API_KEY;
      if (!apiKey) return json({ error: "OPENAI_API_KEY não configurada" }, 503);

      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Body inválido" }, 400); }

      const { areaName, cycleId, objectives, dashboardMode, cycleName, areas } = body;

      let cacheKey: string;
      let prompt: string;

      if (dashboardMode) {
        if (!cycleId || !areas) return json({ error: "Dados incompletos" }, 400);
        cacheKey = `${cycleId}::dashboard-v1`;
        prompt = buildDashboardPrompt(cycleName || cycleId, areas);
      } else {
        if (!areaName || !cycleId || !objectives) return json({ error: "Dados incompletos" }, 400);
        cacheKey = `${cycleId}::${areaName}`;
        prompt = buildPrompt(areaName, objectives);
      }
      const updatedAt = new Date().toISOString();

      let rawText = "";
      let aiError = "";

      try {
        const aiRes = await fetch("https://ai-proxy.gogroupbr.com/v1/chat/completions", {
          method: "POST",
          headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: "gpt-5.5", messages: [{ role: "user", content: prompt }], temperature: 0.3 }),
        });

        rawText = await aiRes.text();

        // Parse the API response
        const aiData = JSON.parse(rawText);
        const content = (aiData.choices?.[0]?.message?.content || "").trim();

        if (!content) {
          return json({ error: "API retornou conteúdo vazio", raw: rawText.slice(0, 500) }, 500);
        }

        // Extract JSON from content
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : content;
        const summary = JSON.parse(jsonStr);

        // Store in cache
        await env.DB.exec("CREATE TABLE IF NOT EXISTS ai_summaries (cache_key TEXT PRIMARY KEY, summary TEXT, updated_at TEXT)", []);
        await env.DB.exec("INSERT OR REPLACE INTO ai_summaries (cache_key, summary, updated_at) VALUES (?, ?, ?)", [cacheKey, JSON.stringify(summary), updatedAt]);

        return json({ summary, updated_at: updatedAt });

      } catch (err: any) {
        return json({ error: err?.message || "Erro", raw: rawText.slice(0, 500) }, 500);
      }
    }

    // Sync sheet endpoint
    if (url.pathname === "/api/sync-sheet" && request.method === "POST") {
      const secret = request.headers.get("X-Sync-Secret") || url.searchParams.get("secret") || "";
      if (!env.SYNC_SECRET || secret !== env.SYNC_SECRET) return json({ error: "Unauthorized" }, 401);
      if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_KEY) return json({ error: "Supabase não configurado" }, 503);

      let body: any;
      try { body = await request.json(); } catch { return json({ error: "Body inválido" }, 400); }

      const { areaName, cycleName, ownerEmail, objectives } = body;
      if (!areaName || !cycleName || !objectives) return json({ error: "Dados incompletos" }, 400);

      const sbHeaders = {
        "apikey": env.SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        "Content-Type": "application/json",
        "Prefer": "return=representation",
      };

      async function sb(method: string, path: string, data?: any) {
        const res = await fetch(`${env.SUPABASE_URL}/rest/v1${path}`, { method, headers: sbHeaders, body: data ? JSON.stringify(data) : undefined });
        const text = await res.text();
        try { return { ok: res.ok, status: res.status, data: JSON.parse(text) }; }
        catch { return { ok: res.ok, status: res.status, data: text }; }
      }

      try {
        const cycleRes = await sb("GET", `/cycles?name=eq.${encodeURIComponent(cycleName)}&select=id`);
        if (!cycleRes.ok || !cycleRes.data?.length) return json({ error: `Ciclo "${cycleName}" não encontrado` }, 404);
        const cycleId = cycleRes.data[0].id;

        const areaRes = await sb("GET", `/areas?name=eq.${encodeURIComponent(areaName)}&archived=eq.false&select=id`);
        if (!areaRes.ok || !areaRes.data?.length) return json({ error: `Área "${areaName}" não encontrada` }, 404);
        const areaId = areaRes.data[0].id;

        let ownerId: string | null = null;
        if (ownerEmail) {
          const ur = await sb("GET", `/app_users?email=eq.${encodeURIComponent(ownerEmail)}&archived=eq.false&select=id`);
          if (ur.ok && ur.data?.length) ownerId = ur.data[0].id;
        }
        if (!ownerId) {
          const fr = await sb("GET", `/app_users?role=eq.owner&archived=eq.false&select=id&limit=1`);
          if (fr.ok && fr.data?.length) ownerId = fr.data[0].id;
        }

        await sb("DELETE", `/objectives?cycle_id=eq.${cycleId}&area_id=eq.${areaId}`);

        let objCount = 0, krCount = 0, msCount = 0;

        for (const obj of objectives) {
          if (!obj.title) continue;
          const objRes = await sb("POST", "/objectives", [{ cycle_id: cycleId, area_id: areaId, owner_user_id: ownerId, title: obj.title.trim(), weight: 1 }]);
          if (!objRes.ok || !objRes.data?.[0]) continue;
          const objId = objRes.data[0].id;
          objCount++;

          for (const kr of obj.krs || []) {
            if (!kr.title) continue;
            const g0 = parseFloat(String(kr.grade0 || "0").replace(",", ".")) || 0;
            const g1 = parseFloat(String(kr.grade1 || "1").replace(",", ".")) || 1;
            const finalVal = parseFloat(String(kr.final || "").replace(",", ".")) || null;
            const unit = g1 > 100 ? "currency" : (g0 <= 1 && g1 <= 1 ? "percent" : "number");
            const direction = g0 > g1 ? "decrease" : "increase";
            const hasMilestones = (kr.milestones || []).length > 0;

            const krRes = await sb("POST", "/key_results", [{ objective_id: objId, cycle_id: cycleId, area_id: areaId, owner_user_id: ownerId, title: kr.title.trim(), unit, direction, grade0_value: g0, grade1_value: g1, has_milestones: hasMilestones, current_value: finalVal, measurement_type: "accumulated", expected_progress_mode: "linear" }]);
            if (!krRes.ok || !krRes.data?.[0]) continue;
            const krId = krRes.data[0].id;
            krCount++;

            const months = ["2026-07","2026-08","2026-09","2026-10","2026-11","2026-12"];
            const monthVals = [kr.jul, kr.ago, kr.set, kr.out, kr.nov, kr.dez];
            for (let i = 0; i < 6; i++) {
              const v = monthVals[i];
              if (v !== null && v !== undefined && v !== "") {
                const val = parseFloat(String(v).replace(",", "."));
                if (!isNaN(val)) await sb("POST", "/checkins", [{ key_result_id: krId, value: val, created_by_user_id: ownerId, reference_month: months[i] }]);
              }
            }

            for (const ms of kr.milestones || []) {
              if (!ms.title) continue;
              const mg0 = parseFloat(String(ms.grade0 || "0").replace(",", ".")) || 0;
              const mg1 = parseFloat(String(ms.grade1 || "1").replace(",", ".")) || 1;
              const mFinal = parseFloat(String(ms.final || "").replace(",", ".")) || null;
              await sb("POST", "/milestones", [{ key_result_id: krId, title: ms.title.trim(), weight: 0.5, grade0_value: mg0, target_value: mg1, current_value: mFinal ?? 0 }]);
              msCount++;
            }
          }
        }

        return json({ ok: true, message: `Sync: ${objCount} objetivos, ${krCount} KRs, ${msCount} milestones`, timestamp: new Date().toISOString() });
      } catch (err: any) { return json({ error: err?.message || "Erro interno" }, 500); }
    }

    return new Response("Not found", { status: 404, headers: CORS });
  },
};
