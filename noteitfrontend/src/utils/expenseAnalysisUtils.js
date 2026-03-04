/**
 * Expense Analysis Utility Functions
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
 * Returns sorted array (oldest first) of { key, label, expenses, investments, total, expenseTotal, investmentTotal }
 */
export const computeMonthlyBreakdown = (expenses) => {
    const currentMonth = getCurrentMonthKey();
    const grouped = {};

    expenses.forEach((exp) => {
        const key = getMonthKey(exp.date);
        if (key === currentMonth) return; // exclude current month

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
export const computeOverviewStats = (monthlyData) => {
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
export const computeCategoryAnalysis = (expenses) => {
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
export const computeInvestmentAnalysis = (monthlyData) => {
    const totalInvested = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const avgMonthly = monthlyData.length > 0 ? totalInvested / monthlyData.length : 0;

    const trend = monthlyData.map((m) => ({
        label: m.label,
        amount: m.investmentTotal,
    }));

    // Growth: compare last 3 months avg to previous 3 months avg
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
 * Financial Health Score (0-100)
 */
export const computeFinancialHealthScore = (monthlyData) => {
    if (monthlyData.length < 2) return { score: null, breakdown: {} };

    // 1. Investment rate (max 35 pts) – higher investment ratio is better
    const totalSpent = monthlyData.reduce((s, m) => s + m.expenseTotal, 0);
    const totalInvestment = monthlyData.reduce((s, m) => s + m.investmentTotal, 0);
    const grandTotal = totalSpent + totalInvestment;
    const investmentRate = grandTotal > 0 ? totalInvestment / grandTotal : 0;
    const investmentScore = Math.min(investmentRate / 0.3, 1) * 35; // 30% investment = perfect

    // 2. Spending consistency (max 25 pts) – lower variance is better
    const avgSpend = totalSpent / monthlyData.length;
    const variance = monthlyData.reduce((s, m) => s + Math.pow(m.expenseTotal - avgSpend, 2), 0) / monthlyData.length;
    const stdDev = Math.sqrt(variance);
    const cv = avgSpend > 0 ? stdDev / avgSpend : 0;
    const consistencyScore = Math.max(0, (1 - cv) * 25);

    // 3. Expense trend (max 20 pts) – decreasing expenses is better
    const recentHalf = monthlyData.slice(Math.floor(monthlyData.length / 2));
    const olderHalf = monthlyData.slice(0, Math.floor(monthlyData.length / 2));
    const recentAvg = recentHalf.reduce((s, m) => s + m.expenseTotal, 0) / (recentHalf.length || 1);
    const olderAvg = olderHalf.reduce((s, m) => s + m.expenseTotal, 0) / (olderHalf.length || 1);
    let trendScore = 10; // neutral
    if (olderAvg > 0) {
        const changePct = ((recentAvg - olderAvg) / olderAvg) * 100;
        trendScore = Math.max(0, Math.min(20, 10 - changePct / 5));
    }

    // 4. Investment growth (max 20 pts)
    let investGrowthScore = 10;
    if (monthlyData.length >= 4) {
        const recentInv = monthlyData.slice(-Math.floor(monthlyData.length / 2)).reduce((s, m) => s + m.investmentTotal, 0);
        const olderInv = monthlyData.slice(0, Math.floor(monthlyData.length / 2)).reduce((s, m) => s + m.investmentTotal, 0);
        if (olderInv > 0) {
            const growthPct = ((recentInv - olderInv) / olderInv) * 100;
            investGrowthScore = Math.max(0, Math.min(20, 10 + growthPct / 5));
        }
    }

    const score = Math.round(investmentScore + consistencyScore + trendScore + investGrowthScore);

    return {
        score: Math.min(100, score),
        breakdown: {
            investmentScore: Math.round(investmentScore),
            consistencyScore: Math.round(consistencyScore),
            trendScore: Math.round(trendScore),
            investGrowthScore: Math.round(investGrowthScore),
        },
        grade: score >= 80 ? 'A' : score >= 60 ? 'B' : score >= 40 ? 'C' : score >= 20 ? 'D' : 'F',
    };
};

/**
 * Inflation Tracking – Month-over-Month and Year-over-Year
 * Returns { monthly: [...], yearly: [...] } for both expenses and investments
 */
export const computeInflation = (monthlyData) => {
    const monthly = [];
    for (let i = 1; i < monthlyData.length; i++) {
        const prev = monthlyData[i - 1];
        const curr = monthlyData[i];
        monthly.push({
            label: curr.label,
            expenseChange: prev.expenseTotal > 0
                ? (((curr.expenseTotal - prev.expenseTotal) / prev.expenseTotal) * 100).toFixed(1)
                : null,
            investmentChange: prev.investmentTotal > 0
                ? (((curr.investmentTotal - prev.investmentTotal) / prev.investmentTotal) * 100).toFixed(1)
                : null,
        });
    }

    // Year-over-Year: group by year
    const yearMap = {};
    monthlyData.forEach((m) => {
        const year = m.key.split('-')[0];
        if (!yearMap[year]) yearMap[year] = { expenseTotal: 0, investmentTotal: 0 };
        yearMap[year].expenseTotal += m.expenseTotal;
        yearMap[year].investmentTotal += m.investmentTotal;
    });

    const years = Object.keys(yearMap).sort();
    const yearly = [];
    for (let i = 1; i < years.length; i++) {
        const prev = yearMap[years[i - 1]];
        const curr = yearMap[years[i]];
        yearly.push({
            label: years[i],
            expenseChange: prev.expenseTotal > 0
                ? (((curr.expenseTotal - prev.expenseTotal) / prev.expenseTotal) * 100).toFixed(1)
                : null,
            investmentChange: prev.investmentTotal > 0
                ? (((curr.investmentTotal - prev.investmentTotal) / prev.investmentTotal) * 100).toFixed(1)
                : null,
        });
    }

    return { monthly, yearly };
};

/**
 * Forecasting using simple moving average
 * Returns forecast for requested number of months (3 and 6)
 */
export const computeForecast = (monthlyData, lookback = 3) => {
    if (monthlyData.length < lookback) return null;

    const recent = monthlyData.slice(-lookback);
    const avgExpense = recent.reduce((s, m) => s + m.expenseTotal, 0) / lookback;
    const avgInvestment = recent.reduce((s, m) => s + m.investmentTotal, 0) / lookback;

    // Generate forecast months
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
 * Since no income data, savings is estimated from investment ratio
 */
export const computeSavings = (monthlyData) => {
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
 * Emergency Fund Calculation
 * 6 months of average monthly expenses, adjusted for inflation
 */
export const computeEmergencyFund = (monthlyData) => {
    if (monthlyData.length < 2) return null;

    const avgMonthlyExpense = monthlyData.reduce((s, m) => s + m.expenseTotal, 0) / monthlyData.length;

    // Calculate avg monthly inflation rate from expenses
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

    // Project 6 months with compounding inflation
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
 * All-in-one analysis
 */
export const computeFullAnalysis = (expenses) => {
    const monthlyData = computeMonthlyBreakdown(expenses);
    return {
        monthlyData,
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
