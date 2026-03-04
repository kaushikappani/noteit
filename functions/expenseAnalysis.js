/**
 * Expense Analysis Functions (Backend)
 * All computations exclude the current (incomplete) month.
 */

// Helper: get "YYYY-MM" key from a date
const getMonthKey = (date) => {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const getMonthLabel = (key) => {
    const [year, month] = key.split('-');
    const date = new Date(year, parseInt(month) - 1);
    return date.toLocaleString('default', { month: 'short', year: 'numeric' });
};

const getCurrentMonthKey = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Group expenses by month, excluding current month.
 */
const computeMonthlyBreakdown = (expenses) => {
    const currentMonth = getCurrentMonthKey();
    const grouped = {};

    expenses.forEach((exp) => {
        const key = getMonthKey(exp.date);
        if (key === currentMonth) return;

        if (!grouped[key]) {
            grouped[key] = {
                key,
                label: getMonthLabel(key),
                expenses: [],
                investments: [],
                total: 0,
                expenseTotal: 0,
                investmentTotal: 0,
                byCategory: {},
            };
        }

        grouped[key].total += exp.cost;

        if (exp.category === 'Investments') {
            grouped[key].investments.push(exp);
            grouped[key].investmentTotal += exp.cost;
        } else {
            grouped[key].expenses.push(exp);
            grouped[key].expenseTotal += exp.cost;
        }

        if (!grouped[key].byCategory[exp.category]) {
            grouped[key].byCategory[exp.category] = 0;
        }
        grouped[key].byCategory[exp.category] += exp.cost;
    });

    return Object.keys(grouped)
        .sort()
        .map((k) => grouped[k]);
};

/**
 * Overview Stats
 */
const computeOverviewStats = (monthlyData) => {
    if (!monthlyData.length) return null;

    const totalSpent = monthlyData.reduce((s, m) => s + m.expenseTotal, 0);
    const totalInvestment = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const grandTotal = totalSpent + totalInvestment;
    const avgMonthlySpend = totalSpent / monthlyData.length;
    const avgMonthlyInvestment = totalInvestment / monthlyData.length;

    const highestMonth = monthlyData.reduce((max, m) => (m.expenseTotal > max.expenseTotal ? m : max), monthlyData[0]);
    const lowestMonth = monthlyData.reduce((min, m) => (m.expenseTotal < min.expenseTotal ? m : min), monthlyData[0]);

    const expenseToInvestmentRatio = totalInvestment > 0 ? (totalSpent / totalInvestment).toFixed(2) : 'N/A';
    const investmentRate = grandTotal > 0 ? ((totalInvestment / grandTotal) * 100).toFixed(1) : 0;

    return {
        totalSpent,
        totalInvestment,
        grandTotal,
        avgMonthlySpend,
        avgMonthlyInvestment,
        highestMonth: { label: highestMonth.label, amount: highestMonth.expenseTotal },
        lowestMonth: { label: lowestMonth.label, amount: lowestMonth.expenseTotal },
        expenseToInvestmentRatio,
        investmentRate,
        totalMonths: monthlyData.length,
    };
};

/**
 * Category Analysis (excluding Investments)
 */
const computeCategoryAnalysis = (expenses) => {
    const currentMonth = getCurrentMonthKey();
    const categories = {};
    let total = 0;

    expenses.forEach((exp) => {
        if (exp.category === 'Investments') return;
        if (getMonthKey(exp.date) === currentMonth) return;

        if (!categories[exp.category]) {
            categories[exp.category] = { total: 0, count: 0 };
        }
        categories[exp.category].total += exp.cost;
        categories[exp.category].count += 1;
        total += exp.cost;
    });

    return Object.entries(categories).map(([name, data]) => ({
        name,
        total: data.total,
        count: data.count,
        percentage: total > 0 ? ((data.total / total) * 100).toFixed(1) : 0,
    })).sort((a, b) => b.total - a.total);
};

/**
 * Investment Analysis
 */
const computeInvestmentAnalysis = (monthlyData) => {
    const totalInvested = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const avgMonthly = monthlyData.length > 0 ? totalInvested / monthlyData.length : 0;

    const trend = monthlyData.map((m) => ({
        label: m.label,
        amount: m.investmentTotal,
    }));

    let growthRate = null;
    if (monthlyData.length >= 6) {
        const recent3 = monthlyData.slice(-3).reduce((s, m) => s + m.investmentTotal, 0) / 3;
        const prev3 = monthlyData.slice(-6, -3).reduce((s, m) => s + m.investmentTotal, 0) / 3;
        if (prev3 > 0) {
            growthRate = (((recent3 - prev3) / prev3) * 100).toFixed(1);
        }
    }

    return { totalInvested, avgMonthly, trend, growthRate };
};

/**
 * Financial Health Score (0-100) — FIXED scoring
 * Scoring breakdown:
 *   Investment rate:       0-30 pts (30% of total = full marks)
 *   Spending consistency:  0-25 pts (lower CV = better)
 *   Expense trend:         0-25 pts (decreasing = better)
 *   Investment growth:     0-20 pts (increasing = better)
 */
const computeFinancialHealthScore = (monthlyData) => {
    if (monthlyData.length < 2) return { score: null, breakdown: {} };

    const totalSpent = monthlyData.reduce((s, m) => s + m.expenseTotal, 0);
    const totalInvestment = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const grandTotal = totalSpent + totalInvestment;

    // 1. Investment rate (max 30 pts)
    // Target: 30% investment rate = full score. 0 investments = 0 pts.
    let investmentScore = 0;
    if (totalInvestment > 0 && grandTotal > 0) {
        const investmentRate = totalInvestment / grandTotal;
        investmentScore = Math.min(investmentRate / 0.3, 1) * 30;
    }

    // 2. Spending consistency (max 25 pts)
    // Uses coefficient of variation; CV=0 is perfect, CV>=1 is 0 pts
    const avgSpend = totalSpent / monthlyData.length;
    const variance = monthlyData.reduce((s, m) => s + Math.pow(m.expenseTotal - avgSpend, 2), 0) / monthlyData.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgSpend > 0 ? stdDev / avgSpend : 1;
    const consistencyScore = Math.max(0, (1 - cv)) * 25;

    // 3. Expense trend (max 25 pts)
    // Compare recent half avg vs older half avg
    // If expenses decreased by 20%+ => 25 pts, increased by 20%+ => 0 pts
    const halfIdx = Math.floor(monthlyData.length / 2);
    const olderHalf = monthlyData.slice(0, halfIdx);
    const recentHalf = monthlyData.slice(halfIdx);
    const olderAvg = olderHalf.reduce((s, m) => s + m.expenseTotal, 0) / (olderHalf.length || 1);
    const recentAvg = recentHalf.reduce((s, m) => s + m.expenseTotal, 0) / (recentHalf.length || 1);
    let trendScore = 12.5; // neutral default
    if (olderAvg > 0) {
        const changePct = ((recentAvg - olderAvg) / olderAvg) * 100;
        // -20% change => 25pts, 0% => 12.5pts, +20% => 0pts
        trendScore = Math.max(0, Math.min(25, 12.5 - (changePct / 20) * 12.5));
    }

    // 4. Investment growth (max 20 pts)
    // Compare recent half investment vs older half investment
    let investGrowthScore = 0;
    if (monthlyData.length >= 4) {
        const olderInv = olderHalf.reduce((s, m) => s + m.investmentTotal, 0) / (olderHalf.length || 1);
        const recentInv = recentHalf.reduce((s, m) => s + m.investmentTotal, 0) / (recentHalf.length || 1);
        if (olderInv > 0) {
            const growthPct = ((recentInv - olderInv) / olderInv) * 100;
            // +20% growth => 20pts, 0% => 10pts, -20% => 0pts
            investGrowthScore = Math.max(0, Math.min(20, 10 + (growthPct / 20) * 10));
        } else if (recentInv > 0) {
            investGrowthScore = 20; // started investing from nothing
        }
    }

    const rawScore = Math.round(investmentScore + consistencyScore + trendScore + investGrowthScore);
    const score = Math.min(100, Math.max(0, rawScore));

    let grade;
    if (score >= 85) grade = 'A';
    else if (score >= 70) grade = 'B';
    else if (score >= 50) grade = 'C';
    else if (score >= 30) grade = 'D';
    else grade = 'F';

    return {
        score,
        breakdown: {
            investmentScore: Math.round(investmentScore),
            consistencyScore: Math.round(consistencyScore),
            trendScore: Math.round(trendScore),
            investGrowthScore: Math.round(investGrowthScore),
        },
        maxBreakdown: {
            investmentScore: 30,
            consistencyScore: 25,
            trendScore: 25,
            investGrowthScore: 20,
        },
        grade,
    };
};

/**
 * Inflation Tracking – MoM, YoY (pro-rata), 6mo/12mo trends, avg/median/max
 */
const computeInflation = (monthlyData) => {
    const monthly = [];
    const expChanges = [];
    const invChanges = [];

    for (let i = 1; i < monthlyData.length; i++) {
        const prev = monthlyData[i - 1];
        const curr = monthlyData[i];

        let expChange = null;
        if (prev.expenseTotal > 0) {
            expChange = ((curr.expenseTotal - prev.expenseTotal) / prev.expenseTotal) * 100;
            expChanges.push(expChange);
        }

        let invChange = null;
        if (prev.investmentTotal > 0) {
            invChange = ((curr.investmentTotal - prev.investmentTotal) / prev.investmentTotal) * 100;
            invChanges.push(invChange);
        }

        monthly.push({
            label: curr.label,
            expenseChange: expChange !== null ? parseFloat(expChange.toFixed(1)) : null,
            investmentChange: invChange !== null ? parseFloat(invChange.toFixed(1)) : null,
        });
    }

    // Helper for stats
    const calcStats = (arr) => {
        if (!arr.length) return null;
        const sorted = [...arr].sort((a, b) => a - b);
        const avg = arr.reduce((s, v) => s + v, 0) / arr.length;
        const median = sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];
        const max = sorted[sorted.length - 1];
        const min = sorted[0];
        return {
            avg: parseFloat(avg.toFixed(2)),
            median: parseFloat(median.toFixed(2)),
            max: parseFloat(max.toFixed(1)),
            min: parseFloat(min.toFixed(1)),
            count: arr.length,
        };
    };

    // Overall stats
    const expenseStats = calcStats(expChanges);
    const investmentStats = calcStats(invChanges);

    // Last 6 months trend
    const last6ExpChanges = expChanges.slice(-Math.min(6, expChanges.length));
    const last6InvChanges = invChanges.slice(-Math.min(6, invChanges.length));
    const last6Expense = calcStats(last6ExpChanges);
    const last6Investment = calcStats(last6InvChanges);

    // Last 12 months trend
    const last12ExpChanges = expChanges.slice(-Math.min(12, expChanges.length));
    const last12InvChanges = invChanges.slice(-Math.min(12, invChanges.length));
    const last12Expense = calcStats(last12ExpChanges);
    const last12Investment = calcStats(last12InvChanges);

    // Trend direction (is inflation accelerating or decelerating?)
    let expenseTrendDirection = null;
    if (last6ExpChanges.length >= 3) {
        const firstHalf = last6ExpChanges.slice(0, Math.floor(last6ExpChanges.length / 2));
        const secondHalf = last6ExpChanges.slice(Math.floor(last6ExpChanges.length / 2));
        const firstAvg = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
        expenseTrendDirection = secondAvg > firstAvg ? 'accelerating' : 'decelerating';
    }

    // Year-over-Year (pro-rata annualized)
    const yearMap = {};
    monthlyData.forEach((m) => {
        const year = m.key.split('-')[0];
        if (!yearMap[year]) yearMap[year] = { expenseTotal: 0, investmentTotal: 0, monthCount: 0 };
        yearMap[year].expenseTotal += m.expenseTotal;
        yearMap[year].investmentTotal += m.investmentTotal;
        yearMap[year].monthCount += 1;
    });

    const years = Object.keys(yearMap).sort();
    const yearly = [];
    for (let i = 1; i < years.length; i++) {
        const prev = yearMap[years[i - 1]];
        const curr = yearMap[years[i]];

        const prevAnnualExp = (prev.expenseTotal / prev.monthCount) * 12;
        const currAnnualExp = (curr.expenseTotal / curr.monthCount) * 12;
        const prevAnnualInv = (prev.investmentTotal / prev.monthCount) * 12;
        const currAnnualInv = (curr.investmentTotal / curr.monthCount) * 12;

        yearly.push({
            label: `${years[i]}${curr.monthCount < 12 ? ` (${curr.monthCount}mo, annualized)` : ''}`,
            expenseChange: prevAnnualExp > 0
                ? parseFloat((((currAnnualExp - prevAnnualExp) / prevAnnualExp) * 100).toFixed(1))
                : null,
            investmentChange: prevAnnualInv > 0
                ? parseFloat((((currAnnualInv - prevAnnualInv) / prevAnnualInv) * 100).toFixed(1))
                : null,
            monthCount: curr.monthCount,
            annualizedExpense: Math.round(currAnnualExp),
            annualizedInvestment: Math.round(currAnnualInv),
        });
    }

    return {
        monthly,
        yearly,
        expenseStats,
        investmentStats,
        last6: { expense: last6Expense, investment: last6Investment },
        last12: { expense: last12Expense, investment: last12Investment },
        expenseTrendDirection,
    };
};

/**
 * Forecasting using simple moving average (3 and 6 months)
 */
const computeForecast = (monthlyData, lookback = 3) => {
    if (monthlyData.length < lookback) return null;

    const recent = monthlyData.slice(-lookback);
    const avgExpense = recent.reduce((s, m) => s + m.expenseTotal, 0) / lookback;
    const avgInvestment = recent.reduce((s, m) => s + m.investmentTotal, 0) / lookback;

    const lastKey = monthlyData[monthlyData.length - 1].key;
    const [lastYear, lastMonth] = lastKey.split('-').map(Number);

    const forecastMonths = [];
    for (let i = 1; i <= 6; i++) {
        let newMonth = lastMonth + i;
        let newYear = lastYear;
        while (newMonth > 12) {
            newMonth -= 12;
            newYear += 1;
        }
        const key = `${newYear}-${String(newMonth).padStart(2, '0')}`;
        forecastMonths.push({
            label: getMonthLabel(key),
            projectedExpense: Math.round(avgExpense),
            projectedInvestment: Math.round(avgInvestment),
            projectedTotal: Math.round(avgExpense + avgInvestment),
        });
    }

    return {
        threeMonth: forecastMonths.slice(0, 3),
        sixMonth: forecastMonths,
        avgExpense: Math.round(avgExpense),
        avgInvestment: Math.round(avgInvestment),
    };
};

/**
 * Savings Analysis
 */
const computeSavings = (monthlyData) => {
    if (!monthlyData.length) return null;

    const monthlySavings = monthlyData.map((m) => ({
        label: m.label,
        invested: m.investmentTotal,
        spent: m.expenseTotal,
        savingsRate: m.total > 0 ? ((m.investmentTotal / m.total) * 100).toFixed(1) : 0,
    }));

    const totalInvested = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const totalSpent = monthlyData.reduce((s, m) => s + m.expenseTotal, 0);
    const overallRate = (totalInvested + totalSpent) > 0
        ? ((totalInvested / (totalInvested + totalSpent)) * 100).toFixed(1)
        : 0;

    return { monthlySavings, overallRate, totalInvested, totalSpent };
};

/**
 * Emergency Fund Calculation (6 months, inflation-adjusted)
 */
const computeEmergencyFund = (monthlyData) => {
    if (monthlyData.length < 2) return null;

    const avgMonthlyExpense = monthlyData.reduce((s, m) => s + m.expenseTotal, 0) / monthlyData.length;

    let totalInflation = 0;
    let inflationCount = 0;
    for (let i = 1; i < monthlyData.length; i++) {
        if (monthlyData[i - 1].expenseTotal > 0) {
            const change = (monthlyData[i].expenseTotal - monthlyData[i - 1].expenseTotal) / monthlyData[i - 1].expenseTotal;
            totalInflation += change;
            inflationCount++;
        }
    }
    const avgMonthlyInflation = inflationCount > 0 ? totalInflation / inflationCount : 0;

    let emergencyFund = 0;
    for (let i = 1; i <= 6; i++) {
        emergencyFund += avgMonthlyExpense * Math.pow(1 + avgMonthlyInflation, i);
    }

    const baselineFund = avgMonthlyExpense * 6;

    return {
        avgMonthlyExpense: Math.round(avgMonthlyExpense),
        monthlyInflationRate: (avgMonthlyInflation * 100).toFixed(2),
        baselineEmergencyFund: Math.round(baselineFund),
        adjustedEmergencyFund: Math.round(emergencyFund),
        inflationImpact: Math.round(emergencyFund - baselineFund),
    };
};

/**
 * Compute full analysis from raw expenses array
 */
const computeFullAnalysis = (expenses) => {
    const monthlyData = computeMonthlyBreakdown(expenses);

    // Strip raw expense objects from monthlyData to keep response lean
    const monthlyDataClean = monthlyData.map(m => ({
        key: m.key,
        label: m.label,
        total: m.total,
        expenseTotal: m.expenseTotal,
        investmentTotal: m.investmentTotal,
        byCategory: m.byCategory,
    }));

    return {
        monthlyData: monthlyDataClean,
        overview: computeOverviewStats(monthlyData),
        categories: computeCategoryAnalysis(expenses),
        investments: computeInvestmentAnalysis(monthlyData),
        healthScore: computeFinancialHealthScore(monthlyData),
        inflation: computeInflation(monthlyData),
        forecast: computeForecast(monthlyData),
        savings: computeSavings(monthlyData),
        emergencyFund: computeEmergencyFund(monthlyData),
    };
};

module.exports = { computeFullAnalysis };
