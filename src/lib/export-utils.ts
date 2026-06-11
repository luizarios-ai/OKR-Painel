import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import {
  progressKR,
  progressObjective,
  progressMilestone,
  getKRStatus,
  statusLabel,
  formatPercent,
  type OKRStatus,
  expectedProgress,
} from "@/lib/okr-utils";

type ExportData = {
  cycleName: string;
  areaName: string; // "Empresa inteira" if no filter
  objectives: any[];
  keyResults: any[];
  milestonesMap: Record<string, any[]>;
  checkinsMap: Record<string, any[]>;
  cycle: any;
  areas: any[];
  getAreaName: (areaId: string | null) => string;
};

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function safeFileName(area: string) {
  return area
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

function getObjStatus(obj: any, keyResults: any[], cycle: any, milestonesMap: Record<string, any[]>, checkinsMap: Record<string, any[]>): OKRStatus {
  const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id);
  const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
  const expected = expectedProgress(cycle);
  if (objProgress >= 1) return "completed";
  if (objProgress < expected * 0.4) return "off-track";
  if (objProgress < expected * 0.7) return "at-risk";
  return "on-track";
}

// ─── EXCEL ───────────────────────────────────────────────

export function exportExcel(data: ExportData) {
  const wb = XLSX.utils.book_new();
  const { objectives, keyResults, milestonesMap, checkinsMap, cycle, cycleName, getAreaName } = data;

  // Tab 1: OKRs
  const okrRows = objectives.map((obj: any) => {
    const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id);
    const progress = progressObjective(objKRs, milestonesMap, checkinsMap);
    const status = getObjStatus(obj, keyResults, cycle, milestonesMap, checkinsMap);
    return {
      Ciclo: cycleName,
      Área: getAreaName(obj.area_id),
      Objetivo: obj.title,
      Owner: obj.app_users?.name || "—",
      "Progresso (%)": Math.round(progress * 100),
      Status: statusLabel(status),
    };
  });
  const wsOKR = XLSX.utils.json_to_sheet(okrRows);
  autofitColumns(wsOKR, okrRows);
  XLSX.utils.book_append_sheet(wb, wsOKR, "OKRs");

  // Tab 2: KRs
  const krRows = keyResults.map((kr: any) => {
    const obj = objectives.find((o: any) => o.id === kr.objective_id);
    const progress = progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]);
    const status = getKRStatus(kr, cycle, milestonesMap[kr.id], checkinsMap[kr.id]);
    return {
      Objetivo: obj?.title || "—",
      KR: kr.title,
      Owner: kr.app_users?.name || "—",
      "Meta (grade1)": kr.grade1_value,
      "Valor Atual": kr.current_value ?? 0,
      "Progresso (%)": Math.round(progress * 100),
      Status: statusLabel(status),
      Tipo: kr.has_milestones ? "Com Milestones" : "Sem Milestones",
    };
  });
  const wsKR = XLSX.utils.json_to_sheet(krRows);
  autofitColumns(wsKR, krRows);
  XLSX.utils.book_append_sheet(wb, wsKR, "KRs");

  // Tab 3: Milestones
  const msRows: any[] = [];
  keyResults.forEach((kr: any) => {
    const ms = milestonesMap[kr.id];
    if (!ms) return;
    ms.forEach((m: any) => {
      msRows.push({
        KR: kr.title,
        Milestone: m.title,
        Meta: m.target_value,
        "Valor Atual": m.current_value ?? 0,
        "Progresso (%)": Math.round(progressMilestone(m) * 100),
        "Data (due_date)": m.due_date || "—",
      });
    });
  });
  if (msRows.length > 0) {
    const wsMS = XLSX.utils.json_to_sheet(msRows);
    autofitColumns(wsMS, msRows);
    XLSX.utils.book_append_sheet(wb, wsMS, "Milestones");
  }

  const fileName = `okr_export_${safeFileName(data.areaName)}_${dateStamp()}.xlsx`;
  XLSX.writeFile(wb, fileName);
}

function autofitColumns(ws: XLSX.WorkSheet, rows: any[]) {
  if (!rows.length) return;
  const keys = Object.keys(rows[0]);
  ws["!cols"] = keys.map((k) => {
    const maxLen = Math.max(k.length, ...rows.map((r) => String(r[k] ?? "").length));
    return { wch: Math.min(maxLen + 2, 40) };
  });
}

// ─── PDF ─────────────────────────────────────────────────

export function exportPDF(data: ExportData) {
  const { objectives, keyResults, milestonesMap, checkinsMap, cycle, cycleName, areaName, getAreaName } = data;
  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("Relatório de OKRs", pageWidth / 2, y, { align: "center" });
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Área: ${areaName}`, 14, y);
  doc.text(`Data: ${new Date().toLocaleDateString("pt-BR")}`, pageWidth - 14, y, { align: "right" });
  y += 5;
  doc.text(`Ciclo: ${cycleName}`, 14, y);
  y += 8;

  // Summary
  const statuses = objectives.map((obj: any) => getObjStatus(obj, keyResults, cycle, milestonesMap, checkinsMap));
  const krStatuses = keyResults.map((kr: any) => getKRStatus(kr, cycle, milestonesMap[kr.id], checkinsMap[kr.id]));

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text("Resumo", 14, y);
  y += 6;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Total de OKRs: ${objectives.length}`, 14, y);
  doc.text(`Total de KRs: ${keyResults.length}`, 80, y);
  y += 5;
  doc.text(
    `Crítico: ${statuses.filter((s) => s === "off-track").length} OKRs / ${krStatuses.filter((s) => s === "off-track").length} KRs   |   ` +
    `Atenção: ${statuses.filter((s) => s === "at-risk").length} OKRs / ${krStatuses.filter((s) => s === "at-risk").length} KRs   |   ` +
    `No planejado: ${statuses.filter((s) => s === "on-track").length} OKRs / ${krStatuses.filter((s) => s === "on-track").length} KRs   |   ` +
    `Completo: ${statuses.filter((s) => s === "completed").length} OKRs / ${krStatuses.filter((s) => s === "completed").length} KRs`,
    14, y
  );
  y += 10;

  // OKRs with KRs
  objectives.forEach((obj: any) => {
    const objKRs = keyResults.filter((kr) => kr.objective_id === obj.id);
    const objProgress = progressObjective(objKRs, milestonesMap, checkinsMap);
    const objStatus = getObjStatus(obj, keyResults, cycle, milestonesMap, checkinsMap);

    // Check page space
    if (y > 260) {
      doc.addPage();
      y = 20;
    }

    // Objective header
    doc.setFillColor(240, 240, 245);
    doc.rect(14, y - 4, pageWidth - 28, 8, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text(`${obj.title}`, 16, y);
    doc.setFont("helvetica", "normal");
    doc.text(`${formatPercent(objProgress)} · ${statusLabel(objStatus)}`, pageWidth - 16, y, { align: "right" });
    y += 5;

    doc.setFontSize(8);
    doc.text(`Área: ${getAreaName(obj.area_id)} | Owner: ${obj.app_users?.name || "—"}`, 16, y);
    y += 5;

    // KR table
    if (objKRs.length > 0) {
      const krTableData = objKRs.map((kr: any) => {
        const progress = progressKR(kr, milestonesMap[kr.id], checkinsMap[kr.id]);
        const status = getKRStatus(kr, cycle, milestonesMap[kr.id], checkinsMap[kr.id]);
        return [
          kr.title,
          formatPercent(progress),
          statusLabel(status),
          kr.app_users?.name || "—",
        ];
      });

      autoTable(doc, {
        startY: y,
        head: [["Key Result", "Progresso", "Status", "Capitão"]],
        body: krTableData,
        margin: { left: 16, right: 16 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [100, 100, 120], fontSize: 8 },
        columnStyles: {
          0: { cellWidth: "auto" },
          1: { cellWidth: 22, halign: "center" },
          2: { cellWidth: 22, halign: "center" },
          3: { cellWidth: 30 },
        },
        didDrawPage: () => { y = 20; },
      });

      y = (doc as any).lastAutoTable.finalY + 4;

      // Milestones sub-table for KRs that have them
      objKRs.forEach((kr: any) => {
        const ms = milestonesMap[kr.id];
        if (!ms || ms.length === 0) return;

        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(7);
        doc.setFont("helvetica", "italic");
        doc.text(`Milestones: ${kr.title}`, 20, y);
        y += 3;

        const msData = ms.map((m: any) => [
          m.title,
          String(m.target_value),
          String(m.current_value ?? 0),
          `${Math.round(progressMilestone(m) * 100)}%`,
          m.due_date || "—",
        ]);

        autoTable(doc, {
          startY: y,
          head: [["Milestone", "Meta", "Atual", "Progresso", "Data"]],
          body: msData,
          margin: { left: 22, right: 16 },
          styles: { fontSize: 7, cellPadding: 1.5 },
          headStyles: { fillColor: [150, 150, 165], fontSize: 7 },
          didDrawPage: () => { y = 20; },
        });

        y = (doc as any).lastAutoTable.finalY + 3;
      });
    }

    y += 4;
  });

  const fileName = `okr_relatorio_${safeFileName(areaName)}_${dateStamp()}.pdf`;
  doc.save(fileName);
}
