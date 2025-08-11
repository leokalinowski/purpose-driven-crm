
export type MarketStats = {
  zip_code: string;
  period_month: string; // YYYY-MM-01
  median_sale_price: number | null;
  median_list_price: number | null;
  homes_sold: number | null;
  new_listings: number | null;
  median_dom: number | null;
  avg_price_per_sqft: number | null;
  inventory: number | null;
};

function fmtUSD(n?: number | null) {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}
function fmtInt(n?: number | null) {
  if (typeof n !== "number" || isNaN(n)) return "—";
  return n.toLocaleString();
}
function yyyymmLabel(periodMonth: string) {
  // periodMonth = YYYY-MM-01
  const d = new Date(periodMonth);
  const ok = !isNaN(d.getTime());
  if (!ok) return periodMonth.slice(0, 7);
  return d.toLocaleDateString(undefined, { year: "numeric", month: "long" });
}

export function buildMarketReportHTML(zip: string, stats: MarketStats) {
  const monthLabel = yyyymmLabel(stats.period_month);

  return `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${zip} Market Report — ${monthLabel}</title>
  </head>
  <body style="font-family:ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, Apple Color Emoji, Segoe UI Emoji; color:#0f172a; background:#ffffff; padding:24px;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="background:hsl(222 47% 11%); color:white; padding:24px;">
          <h1 style="margin:0;font-size:20px;">${zip} Market Report</h1>
          <p style="margin:8px 0 0 0;opacity:.9;">${monthLabel}</p>
        </td>
      </tr>
      <tr>
        <td style="padding:24px;">
          <p style="margin-top:0;">
            Here’s a quick snapshot of your local real estate market for ${zip}.
          </p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin-top:8px;">
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median Sale Price</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtUSD(stats.median_sale_price)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median List Price</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtUSD(stats.median_list_price)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Homes Sold</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(stats.homes_sold)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">New Listings</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(stats.new_listings)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;">Median Days on Market</td>
              <td style="padding:12px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600;">${fmtInt(stats.median_dom)}</td>
            </tr>
            <tr>
              <td style="padding:12px;">Avg. Price per Sq Ft</td>
              <td style="padding:12px;text-align:right;font-weight:600;">${fmtUSD(stats.avg_price_per_sqft)}</td>
            </tr>
            <tr>
              <td style="padding:12px;border-top:1px dashed #e5e7eb;">Active Inventory</td>
              <td style="padding:12px;text-align:right;border-top:1px dashed #e5e7eb;font-weight:600;">${fmtInt(stats.inventory)}</td>
            </tr>
          </table>

          <p style="margin:24px 0 0 0; font-size:14px; color:#475569;">
            Want a more personalized breakdown or have questions about these numbers? Just reply to this email.
          </p>
        </td>
      </tr>
      <tr>
        <td style="padding:16px 24px; background:#f8fafc; font-size:12px; color:#64748b;">
          You are receiving this because you are in our database for ${zip}. Unsubscribe options are available upon request.
        </td>
      </tr>
    </table>
  </body>
</html>
`.trim();
}

export function monthKey(date?: Date) {
  const d = date ?? new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}
