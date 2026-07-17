import { db, hasDatabase } from "./db";

export async function financialInsights(userId: string) {
  if (!hasDatabase()) return { monthlySpend: 355000, projectedSavings: 32000, score: 84, categories: [{ type: "TRANSFER", amount: 230000 }, { type: "BILL_PAYMENT", amount: 95000 }, { type: "AIRTIME", amount: 30000 }], mock: true };
  const since = new Date(); since.setDate(since.getDate() - 30);
  const groups = await db().transaction.groupBy({ by: ["type"], where: { userId, createdAt: { gte: since }, status: { in: ["PROCESSING", "COMPLETED"] } }, _sum: { amount: true } });
  const categories = groups.map(item => ({ type: item.type, amount: Number(item._sum.amount || 0) }));
  const monthlySpend = categories.reduce((sum, item) => sum + item.amount, 0);
  const projectedSavings = Math.max(0, Math.round(monthlySpend * 0.09 / 1000) * 1000);
  const score = monthlySpend ? Math.max(40, Math.min(95, 90 - Math.round(categories.find(item => item.type === "AIRTIME")?.amount || 0) / Math.max(monthlySpend, 1) * 20)) : 75;
  return { monthlySpend, projectedSavings, score, categories, periodStart: since.toISOString(), mock: false };
}
