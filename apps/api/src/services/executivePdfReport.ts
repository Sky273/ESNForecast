type Projection = {
  scenarioId: string;
  summary: Record<string, any>;
  months: any[];
  alerts: any[];
  missionProfitability: any[];
};

const W = 595.28;
const H = 841.89;
const margin = 42;

const formatNumber = (value: number | undefined | null) => Math.round(value ?? 0).toLocaleString("fr-FR").replace(/[\u00A0\u202F]/g, " ");
const money = (value: number | undefined | null) => `${formatNumber(value)} EUR`;
const percent = (value: number | undefined | null) => `${Math.round((value ?? 0) * 100)} %`;
const safe = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "");
const esc = (value: string) => safe(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

class Pdf {
  pages: string[] = [];
  commands: string[] = [];

  addPage() {
    if (this.commands.length) this.pages.push(this.commands.join("\n"));
    this.commands = [];
  }

  finish() {
    if (this.commands.length) this.pages.push(this.commands.join("\n"));
    const objects: string[] = [];
    objects.push("<< /Type /Catalog /Pages 2 0 R >>");
    const kids = this.pages.map((_, index) => `${index + 5} 0 R`).join(" ");
    objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${this.pages.length} >>`);
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    for (const [index, page] of this.pages.entries()) {
      const contentId = this.pages.length + 5 + index;
      objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentId} 0 R >>`);
    }
    for (const page of this.pages) {
      objects.push(`<< /Length ${Buffer.byteLength(page, "utf8")} >>\nstream\n${page}\nendstream`);
    }

    let pdf = "%PDF-1.4\n";
    const offsets = [0];
    objects.forEach((object, index) => {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
    });
    const xref = Buffer.byteLength(pdf, "utf8");
    pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
    for (const offset of offsets.slice(1)) pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
    pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
    return Buffer.from(pdf, "utf8");
  }

  text(text: string, x: number, y: number, size = 10, font: "F1" | "F2" = "F1", color = "0.07 0.09 0.15") {
    this.commands.push(`BT /${font} ${size} Tf ${color} rg 1 0 0 1 ${x} ${H - y} Tm (${esc(text)}) Tj ET`);
  }

  rect(x: number, y: number, w: number, h: number, fill = "1 1 1", stroke = "0.82 0.86 0.9") {
    this.commands.push(`q ${fill} rg ${stroke} RG ${x} ${H - y - h} ${w} ${h} re B Q`);
  }

  fillRect(x: number, y: number, w: number, h: number, fill: string) {
    this.commands.push(`q ${fill} rg ${x} ${H - y - h} ${w} ${h} re f Q`);
  }

  line(x1: number, y1: number, x2: number, y2: number, color = "0.82 0.86 0.9") {
    this.commands.push(`q ${color} RG 0.7 w ${x1} ${H - y1} m ${x2} ${H - y2} l S Q`);
  }

  wrapped(text: string, x: number, y: number, width: number, size = 9, lineHeight = 13, font: "F1" | "F2" = "F1") {
    const words = safe(text).split(/\s+/);
    let line = "";
    let cursor = y;
    const maxChars = Math.max(18, Math.floor(width / (size * 0.52)));
    for (const word of words) {
      const next = line ? `${line} ${word}` : word;
      if (next.length > maxChars) {
        this.text(line, x, cursor, size, font);
        line = word;
        cursor += lineHeight;
      } else {
        line = next;
      }
    }
    if (line) this.text(line, x, cursor, size, font);
    return cursor + lineHeight;
  }
}

export function buildExecutivePdf(projection: Projection, options: { scenarioName?: string; horizon?: number } = {}) {
  const pdf = new Pdf();
  const summary = projection.summary;
  const horizon = options.horizon ?? projection.months.length;
  const riskMonths = summary.riskMonths ?? [];
  const finalCash = summary.finalClosingCash ?? projection.months.at(-1)?.closingCash ?? 0;
  const totalRevenue = summary.totalRevenueGenerated ?? 0;
  const totalCosts = summary.totalCostsAccrued ?? 0;
  const grossMargin = summary.totalGrossMargin ?? totalRevenue - totalCosts;
  const marginRate = totalRevenue ? grossMargin / totalRevenue : 0;
  const cashIn = summary.totalCashIn ?? 0;
  const cashOut = summary.totalCashOut ?? 0;
  const topMissions = projection.missionProfitability.slice().sort((a, b) => (b.grossMargin ?? 0) - (a.grossMargin ?? 0)).slice(0, 6);
  const bottomMissions = projection.missionProfitability.slice().sort((a, b) => (a.grossMargin ?? 0) - (b.grossMargin ?? 0)).slice(0, 4);

  cover(pdf, projection, { scenarioName: options.scenarioName, totalRevenue, totalCosts, grossMargin, marginRate, cashIn, cashOut, finalCash, riskMonths, horizon });
  monthlyPage(pdf, projection.months.slice(0, horizon));
  alertsPage(pdf, projection);
  missionsPage(pdf, topMissions, bottomMissions);
  return pdf.finish();
}

function cover(pdf: Pdf, _projection: Projection, data: any) {
  pdf.addPage();
  pdf.fillRect(0, 0, W, 96, "0.04 0.12 0.18");
  pdf.text("ESN Forecast", margin, 34, 18, "F2", "1 1 1");
  pdf.text("Rapport de direction", margin, 61, 27, "F2", "1 1 1");
  pdf.text(`Scenario ${data.scenarioName ?? _projection.scenarioId} - horizon ${data.horizon} mois - genere le ${new Date().toLocaleDateString("fr-FR")}`, margin, 84, 9, "F1", "0.79 0.88 1");

  const status = data.finalCash < 0 || data.riskMonths.length ? "Vigilance" : "Sain";
  pdf.rect(420, 28, 120, 34, status === "Sain" ? "0.89 0.98 0.94" : "1 0.95 0.86", status === "Sain" ? "0.13 0.55 0.35" : "0.92 0.45 0.1");
  pdf.text(`Statut: ${status}`, 438, 50, 12, "F2", status === "Sain" ? "0.04 0.37 0.22" : "0.65 0.25 0.05");

  pdf.text("Synthese executive", margin, 132, 16, "F2");
  const summaryText = data.riskMonths.length
    ? `La projection presente ${data.riskMonths.length} mois a risque. La priorite direction est de securiser les encaissements, reduire les couts variables et arbitrer les missions a faible marge.`
    : "La trajectoire reste exploitable. Le suivi doit rester concentre sur les encaissements, la marge brute et la consommation de tresorerie.";
  pdf.wrapped(summaryText, margin, 154, 500, 10, 15);

  const cards = [
    ["CA projete", money(data.totalRevenue), "Chiffre d'affaires genere"],
    ["Cash-in", money(data.cashIn), "Encaissements attendus"],
    ["Cash-out", money(data.cashOut), "Decaissements attendus"],
    ["Marge brute", money(data.grossMargin), percent(data.marginRate)],
    ["Tresorerie finale", money(data.finalCash), data.finalCash < 0 ? "Critique" : "Solde projete"],
    ["Mois a risque", String(data.riskMonths.length), data.riskMonths.slice(0, 4).join(", ") || "Aucun"]
  ];
  cards.forEach((card, index) => {
    const col = index % 3;
    const row = Math.floor(index / 3);
    const x = margin + col * 171;
    const y = 210 + row * 92;
    const isRisk = card[0].includes("risque") || card[2] === "Critique";
    pdf.rect(x, y, 155, 70, isRisk ? "1 0.95 0.95" : "1 1 1", isRisk ? "0.95 0.45 0.45" : "0.82 0.86 0.9");
    pdf.text(card[0], x + 12, y + 20, 9, "F1", "0.29 0.34 0.43");
    pdf.text(card[1], x + 12, y + 42, 16, "F2", isRisk ? "0.7 0.1 0.1" : "0.04 0.12 0.18");
    pdf.text(card[2], x + 12, y + 59, 8, "F1", "0.39 0.45 0.55");
  });

  pdf.text("Tendance mensuelle CA / couts / cash", margin, 430, 14, "F2");
  pdf.rect(margin, 448, 512, 210, "1 1 1");
  drawLineChart(pdf, _projection.months.slice(0, 12), margin + 20, 468, 472, 160);

  pdf.text("Messages direction", margin, 700, 13, "F2");
  const messages = [
    `Marge brute projetee: ${money(data.grossMargin)} (${percent(data.marginRate)}).`,
    `Tresorerie finale projetee: ${money(data.finalCash)}.`,
    data.riskMonths.length ? `Mois a traiter en priorite: ${data.riskMonths.slice(0, 8).join(", ")}${data.riskMonths.length > 8 ? "..." : ""}.` : "Aucun mois negatif identifie dans l'horizon."
  ];
  messages.forEach((message, index) => pdf.wrapped(`- ${message}`, margin, 722 + index * 18, 500, 10, 14));
  footer(pdf, 1);
}

function monthlyPage(pdf: Pdf, months: any[]) {
  pdf.addPage();
  pageHeader(pdf, "Projection mensuelle", "Lecture budgetaire des revenus, couts, marge et cash par mois.");
  const x = margin;
  let y = 118;
  const headers = ["Mois", "CA", "Couts", "Marge", "Cash-in", "Cash-out", "Cash final", "Statut"];
  const widths = [58, 66, 66, 66, 66, 66, 72, 54];
  tableHeader(pdf, x, y, headers, widths);
  y += 24;
  months.slice(0, 18).forEach((month, index) => {
    const risk = (month.closingCash ?? 0) < 0 || (month.alerts?.length ?? 0) > 0;
    if (index % 2 === 0) pdf.fillRect(x, y - 13, 512, 24, "0.98 0.99 1");
    const values = [
      month.month,
      money(month.revenueGenerated),
      money(month.totalCosts ?? month.costsAccrued),
      money(month.grossMargin),
      money(month.cashInExpected),
      money(month.cashOutExpected),
      money(month.closingCash),
      risk ? "Risque" : "OK"
    ];
    let cx = x;
    values.forEach((value, cell) => {
      pdf.text(value, cx + 4, y, cell === 7 && risk ? 8 : 8, cell === 7 ? "F2" : "F1", cell === 7 && risk ? "0.72 0.09 0.09" : "0.10 0.13 0.18");
      cx += widths[cell];
    });
    y += 24;
  });
  pdf.line(x, y - 12, x + 512, y - 12);
  pdf.text("Points de lecture", margin, y + 28, 13, "F2");
  pdf.wrapped("Les mois en risque doivent etre analyses avec les causes: retard d'encaissement, fin de mission, intercontrat, derive des couts externes ou frais non prevus.", margin, y + 50, 500, 10, 15);
  footer(pdf, 2);
}

function alertsPage(pdf: Pdf, projection: Projection) {
  pdf.addPage();
  pageHeader(pdf, "Risques et alertes", "Priorites operationnelles a traiter par la direction.");
  pdf.text("Alertes prioritaires", margin, 118, 14, "F2");
  const alerts = projection.alerts.slice(0, 12);
  let y = 142;
  if (!alerts.length) {
    pdf.rect(margin, y - 18, 512, 42, "0.93 0.98 0.95", "0.48 0.8 0.63");
    pdf.text("Aucune alerte critique sur la projection.", margin + 14, y + 5, 10, "F2", "0.04 0.37 0.22");
    y += 56;
  } else {
    alerts.forEach((alert, index) => {
      pdf.rect(margin, y - 16, 512, 38, alert.severity === "critical" ? "1 0.94 0.94" : "1 0.98 0.9", alert.severity === "critical" ? "0.93 0.35 0.35" : "0.92 0.62 0.17");
      pdf.text(`${index + 1}. ${alert.severity ?? "warning"} - ${alert.month ?? ""}`, margin + 10, y, 9, "F2", alert.severity === "critical" ? "0.65 0.08 0.08" : "0.55 0.32 0.04");
      pdf.wrapped(alert.message ?? alert.type ?? "Alerte projection", margin + 150, y, 350, 8, 11);
      y += 46;
    });
  }

  pdf.text("Lecture direction", margin, Math.max(y + 18, 670), 14, "F2");
  pdf.wrapped("Les alertes doivent etre traitees comme une file d'arbitrage: impact cash, impact marge, responsable, decision attendue et date cible. Les points non expliques doivent etre rattaches a une mission, un client, une facture ou une action corrective.", margin, Math.max(y + 42, 694), 500, 10, 15);
  footer(pdf, 3);
}

function missionsPage(pdf: Pdf, topMissions: any[], bottomMissions: any[]) {
  pdf.addPage();
  pageHeader(pdf, "Rentabilite missions", "Identification des contributeurs de marge et des missions a arbitrer.");
  pdf.text("Top missions rentables", margin, 118, 14, "F2");
  let y = 142;
  tableHeader(pdf, margin, y, ["Mission", "CA", "Couts", "Marge", "Taux"], [190, 74, 74, 74, 62]);
  y += 24;
  topMissions.forEach((mission, index) => {
    if (index % 2 === 0) pdf.fillRect(margin, y - 13, 512, 24, "0.98 0.99 1");
    row(pdf, y, [mission.missionTitle ?? mission.title ?? "Mission", money(missionRevenue(mission)), money(missionCosts(mission)), money(mission.grossMargin), percent(mission.marginRate)], [190, 74, 74, 74, 62]);
    y += 24;
  });

  pdf.text("Missions a surveiller", margin, y + 30, 14, "F2");
  y += 54;
  tableHeader(pdf, margin, y, ["Mission", "Marge", "Taux", "Action recommandee"], [210, 80, 60, 160]);
  y += 24;
  bottomMissions.forEach((mission, index) => {
    if (index % 2 === 0) pdf.fillRect(margin, y - 13, 512, 24, "0.99 0.98 0.97");
    row(pdf, y, [mission.missionTitle ?? mission.title ?? "Mission", money(mission.grossMargin), percent(mission.marginRate), "Verifier TJM, cout externe et staffing"], [210, 80, 60, 160]);
    y += 24;
  });
  footer(pdf, 4);
}

function missionRevenue(mission: any) {
  return mission.revenue ?? mission.revenueWeighted ?? mission.revenueSigned ?? mission.revenueExpected ?? 0;
}

function missionCosts(mission: any) {
  return mission.costs ?? (mission.internalCosts ?? 0) + (mission.externalCosts ?? 0) + (mission.associatedCosts ?? 0);
}

function pageHeader(pdf: Pdf, title: string, subtitle: string) {
  pdf.fillRect(0, 0, W, 72, "0.04 0.12 0.18");
  pdf.text("ESN Forecast", margin, 27, 12, "F2", "1 1 1");
  pdf.text(title, margin, 52, 20, "F2", "1 1 1");
  pdf.text(subtitle, margin, 86, 9, "F1", "0.39 0.45 0.55");
}

function footer(pdf: Pdf, page: number) {
  pdf.line(margin, 804, W - margin, 804);
  pdf.text("Rapport direction - ESN Forecast", margin, 822, 8, "F1", "0.39 0.45 0.55");
  pdf.text(`Page ${page}`, W - margin - 36, 822, 8, "F1", "0.39 0.45 0.55");
}

function tableHeader(pdf: Pdf, x: number, y: number, headers: string[], widths: number[]) {
  pdf.fillRect(x, y - 17, widths.reduce((a, b) => a + b, 0), 24, "0.93 0.96 0.99");
  let cx = x;
  headers.forEach((header, index) => {
    pdf.text(header, cx + 4, y, 8, "F2", "0.20 0.25 0.33");
    cx += widths[index];
  });
}

function row(pdf: Pdf, y: number, values: string[], widths: number[]) {
  let cx = margin;
  values.forEach((value, index) => {
    pdf.text(value, cx + 4, y, 8);
    cx += widths[index];
  });
}

function drawLineChart(pdf: Pdf, months: any[], x: number, y: number, w: number, h: number) {
  const values = months.flatMap((month) => [month.revenueGenerated ?? 0, month.totalCosts ?? month.costsAccrued ?? 0, month.closingCash ?? 0]);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const scale = (value: number) => y + h - ((value - min) / (max - min || 1)) * h;
  for (let i = 0; i <= 4; i++) {
    const gy = y + (h / 4) * i;
    pdf.line(x, gy, x + w, gy, "0.9 0.93 0.96");
  }
  const series = [
    { key: "revenueGenerated", color: "0.05 0.48 0.42", label: "CA" },
    { key: "totalCosts", fallback: "costsAccrued", color: "0.86 0.15 0.15", label: "Couts" },
    { key: "closingCash", color: "0.15 0.37 0.92", label: "Cash" }
  ];
  series.forEach((serie) => {
    const points = months.map((month, index) => {
      const px = x + (w / Math.max(months.length - 1, 1)) * index;
      const py = scale(month[serie.key] ?? month[serie.fallback as string] ?? 0);
      return `${px} ${H - py} ${index === 0 ? "m" : "l"}`;
    }).join(" ");
    pdf.commands.push(`q ${serie.color} RG 1.8 w ${points} S Q`);
  });
  pdf.text("CA", x + 8, y + h + 24, 8, "F2", "0.05 0.48 0.42");
  pdf.text("Couts", x + 44, y + h + 24, 8, "F2", "0.86 0.15 0.15");
  pdf.text("Cash", x + 92, y + h + 24, 8, "F2", "0.15 0.37 0.92");
}
