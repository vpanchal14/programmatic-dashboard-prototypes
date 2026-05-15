const DashboardData = (() => {
  const numberFields = [
    "imps_won",
    "clicks",
    "ctr",
    "total_ecpm",
    "total_ecpc",
    "total_ecpa",
    "ctc",
    "vtc",
    "total_conversions",
    "click_cvr",
    "view_cvr",
    "total_cvrm",
    "ctc_revenue",
    "vtc_revenue",
    "total_revenue",
    "media_spend",
    "data_spend",
    "total_spend",
    "audio_video_starts",
    "complete_25",
    "complete_50",
    "complete_75",
    "complete_100",
    "completion_rate",
    "ecpcv",
    "companion_imps_won",
    "companion_clicks",
    "companion_ctc",
    "companion_ctc_revenue",
  ];

  function parseCsvLine(line) {
    const values = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"' && inQuotes && next === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        values.push(current);
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current);
    return values;
  }

  function parseCsv(text) {
    const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
    if (!lines.length) {
      return [];
    }

    const headers = parseCsvLine(lines[0]);
    return lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row = {};
      headers.forEach((header, index) => {
        row[header] = values[index] ?? "";
      });

      numberFields.forEach((field) => {
        const value = Number(row[field]);
        row[field] = Number.isFinite(value) ? value : 0;
      });

      return row;
    });
  }

  function sum(rows, field) {
    return rows.reduce((total, row) => total + (Number(row[field]) || 0), 0);
  }

  function groupBy(rows, keyFn) {
    const map = new Map();
    rows.forEach((row) => {
      const key = keyFn(row);
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(row);
    });
    return map;
  }

  function topGroups(rows, key, metric, limit = 8) {
    return Array.from(groupBy(rows, (row) => row[key]).entries())
      .map(([label, items]) => ({
        label,
        [metric]: sum(items, metric),
        spend: sum(items, "total_spend"),
        imps: sum(items, "imps_won"),
        clicks: sum(items, "clicks"),
        conversions: sum(items, "total_conversions"),
      }))
      .sort((a, b) => b[metric] - a[metric])
      .slice(0, limit);
  }

  function getDateSeries(rows) {
    return Array.from(groupBy(rows, (row) => row.report_date).entries())
      .map(([date, items]) => {
        const spend = sum(items, "total_spend");
        const imps = sum(items, "imps_won");
        const clicks = sum(items, "clicks");
        const conversions = sum(items, "total_conversions");
        return {
          date: new Date(date),
          spend,
          imps,
          clicks,
          conversions,
          ctr: imps ? (clicks / imps) * 100 : 0,
          cpa: conversions ? spend / conversions : 0,
        };
      })
      .sort((a, b) => a.date - b.date);
  }

  function getKpis(rows) {
    const spend = sum(rows, "total_spend");
    const imps = sum(rows, "imps_won");
    const clicks = sum(rows, "clicks");
    const conversions = sum(rows, "total_conversions");
    const starts = sum(rows, "audio_video_starts");
    const complete100 = sum(rows, "complete_100");

    return {
      spend,
      imps,
      clicks,
      conversions,
      ctr: imps ? (clicks / imps) * 100 : 0,
      cvr: clicks ? (conversions / clicks) * 100 : 0,
      cpa: conversions ? spend / conversions : 0,
      cpm: imps ? (spend / imps) * 1000 : 0,
      completionRate: starts ? (complete100 / starts) * 100 : 0,
    };
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      value
    );
  }

  function formatCurrency(value) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatPercent(value, digits = 2) {
    return `${value.toFixed(digits)}%`;
  }

  async function loadRows(filePath = "centro-data.csv") {
    const response = await fetch(filePath);
    if (!response.ok) {
      throw new Error(`Unable to load ${filePath}`);
    }
    const text = await response.text();
    return parseCsv(text);
  }

  function renderKpiCards(containerId, items) {
    const container = document.getElementById(containerId);
    container.innerHTML = items
      .map(
        (item) => `
          <div class="kpi-card">
            <div class="kpi-label">${item.label}</div>
            <div class="kpi-value">${item.value}</div>
            <div class="kpi-meta">${item.meta || "&nbsp;"}</div>
          </div>
        `
      )
      .join("");
  }

  return {
    loadRows,
    sum,
    topGroups,
    getDateSeries,
    getKpis,
    formatNumber,
    formatCurrency,
    formatPercent,
    renderKpiCards,
  };
})();
