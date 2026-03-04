import React, { useState, useEffect } from 'react';
import { Line, Doughnut, Bar } from 'react-chartjs-2';
import axios from 'axios';
import './css/ExpenseAnalysis.css';

const TABS = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'trend', label: '📈 Trends' },
    { key: 'categories', label: '🏷️ Categories' },
    { key: 'investments', label: '💰 Investments' },
    { key: 'health', label: '❤️ Health Score' },
    { key: 'inflation', label: '📉 Inflation' },
    { key: 'forecast', label: '🔮 Forecast' },
    { key: 'savings', label: '🐷 Savings' },
    { key: 'emergency', label: '🚨 Emergency Fund' },
];

const categoryColors = {
    Investments: '#4CAF50',
    Food: '#2196F3',
    Needs: '#FFC107',
    Wants: '#FF5722',
    Others: '#9C27B0',
};

const formatCurrency = (n) => {
    if (n == null) return '—';
    return '₹' + Number(n).toLocaleString('en-IN');
};

const ExpenseAnalysis = ({ open, onClose }) => {
    const [activeTab, setActiveTab] = useState('overview');
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open) return;
        const fetchAnalysis = async () => {
            setLoading(true);
            setError(null);
            try {
                const config = { withCredentials: true };
                const { data } = await axios.get('/api/expenses/analysis', config);
                setAnalysis(data);
            } catch (e) {
                setError(e.response ? e.response.data.message : e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalysis();
    }, [open]);

    if (!open) return null;

    if (loading) {
        return (
            <div className="analysis-overlay" onClick={onClose}>
                <div className="analysis-container" onClick={(e) => e.stopPropagation()}>
                    <div className="analysis-header">
                        <h2>📊 Financial Analysis</h2>
                        <button className="analysis-close-btn" onClick={onClose}>✕</button>
                    </div>
                    <div className="no-data-msg">⏳ Crunching your numbers...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="analysis-overlay" onClick={onClose}>
                <div className="analysis-container" onClick={(e) => e.stopPropagation()}>
                    <div className="analysis-header">
                        <h2>📊 Financial Analysis</h2>
                        <button className="analysis-close-btn" onClick={onClose}>✕</button>
                    </div>
                    <div className="no-data-msg">❌ {error}</div>
                </div>
            </div>
        );
    }

    if (!analysis || !analysis.overview) {
        return (
            <div className="analysis-overlay" onClick={onClose}>
                <div className="analysis-container" onClick={(e) => e.stopPropagation()}>
                    <div className="analysis-header">
                        <h2>📊 Financial Analysis</h2>
                        <button className="analysis-close-btn" onClick={onClose}>✕</button>
                    </div>
                    <div className="no-data-msg">Not enough data for analysis. Add expenses across multiple months to see insights.</div>
                </div>
            </div>
        );
    }

    const { monthlyData, overview, categories, investments, healthScore, inflation, forecast, savings, emergencyFund } = analysis;

    // ─── Chart data builders ───
    const trendChartData = {
        labels: monthlyData.map((m) => m.label),
        datasets: [
            {
                label: 'Expenses',
                data: monthlyData.map((m) => m.expenseTotal),
                borderColor: '#f5576c',
                backgroundColor: 'rgba(245,87,108,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
            {
                label: 'Investments',
                data: monthlyData.map((m) => m.investmentTotal),
                borderColor: '#43e97b',
                backgroundColor: 'rgba(67,233,123,0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
            },
        ],
    };

    const categoryChartData = {
        labels: categories.map((c) => c.name),
        datasets: [
            {
                data: categories.map((c) => c.total),
                backgroundColor: categories.map((c) => categoryColors[c.name] || '#CCCCCC'),
                borderWidth: 0,
                hoverOffset: 10,
            },
        ],
    };

    const investmentTrendData = {
        labels: investments.trend.map((t) => t.label),
        datasets: [
            {
                label: 'Monthly Investment',
                data: investments.trend.map((t) => t.amount),
                borderColor: '#43e97b',
                backgroundColor: 'rgba(67,233,123,0.15)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
            },
        ],
    };

    const savingsChartData = savings ? {
        labels: savings.monthlySavings.map((s) => s.label),
        datasets: [
            {
                label: 'Spent',
                data: savings.monthlySavings.map((s) => s.spent),
                backgroundColor: 'rgba(245,87,108,0.7)',
                borderRadius: 4,
            },
            {
                label: 'Invested',
                data: savings.monthlySavings.map((s) => s.invested),
                backgroundColor: 'rgba(67,233,123,0.7)',
                borderRadius: 4,
            },
        ],
    } : null;

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 } } },
        },
        scales: {
            x: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
            y: { ticks: { color: 'rgba(255,255,255,0.5)', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } },
        },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { position: 'bottom', labels: { color: 'rgba(255,255,255,0.7)', font: { size: 11 }, padding: 15 } },
        },
    };

    const getHealthGaugeStyle = (score) => {
        const color = score >= 80 ? '#43e97b' : score >= 60 ? '#4facfe' : score >= 40 ? '#fee140' : '#f5576c';
        return {
            background: `conic-gradient(${color} ${score * 3.6}deg, rgba(255,255,255,0.05) ${score * 3.6}deg)`,
        };
    };

    // ─── Tab Renders ───
    const renderOverview = () => (
        <div>
            <div className="stats-grid">
                <div className="stat-card stat-card-purple">
                    <div className="stat-label">Total Expenses</div>
                    <div className="stat-value">{formatCurrency(overview.totalSpent)}</div>
                    <div className="stat-sub">{overview.totalMonths} months analyzed</div>
                </div>
                <div className="stat-card stat-card-green">
                    <div className="stat-label">Total Invested</div>
                    <div className="stat-value">{formatCurrency(overview.totalInvestment)}</div>
                    <div className="stat-sub">{overview.investmentRate}% of total</div>
                </div>
                <div className="stat-card stat-card-blue">
                    <div className="stat-label">Avg Monthly Spend</div>
                    <div className="stat-value">{formatCurrency(Math.round(overview.avgMonthlySpend))}</div>
                </div>
                <div className="stat-card stat-card-teal">
                    <div className="stat-label">Avg Monthly Investment</div>
                    <div className="stat-value">{formatCurrency(Math.round(overview.avgMonthlyInvestment))}</div>
                </div>
                <div className="stat-card stat-card-orange">
                    <div className="stat-label">Highest Spend Month</div>
                    <div className="stat-value">{formatCurrency(overview.highestMonth.amount)}</div>
                    <div className="stat-sub">{overview.highestMonth.label}</div>
                </div>
                <div className="stat-card stat-card-red">
                    <div className="stat-label">Lowest Spend Month</div>
                    <div className="stat-value">{formatCurrency(overview.lowestMonth.amount)}</div>
                    <div className="stat-sub">{overview.lowestMonth.label}</div>
                </div>
                <div className="stat-card stat-card-purple">
                    <div className="stat-label">Expense : Investment</div>
                    <div className="stat-value">{overview.expenseToInvestmentRatio}</div>
                    <div className="stat-sub">Ratio</div>
                </div>
                <div className="stat-card stat-card-green">
                    <div className="stat-label">Grand Total</div>
                    <div className="stat-value">{formatCurrency(overview.grandTotal)}</div>
                </div>
            </div>
        </div>
    );

    const renderTrend = () => (
        <div className="chart-section">
            <h3>📈 Monthly Spending Trend (Expenses vs Investments)</h3>
            <div className="chart-wrapper">
                <Line data={trendChartData} options={chartOptions} />
            </div>
        </div>
    );

    const renderCategories = () => (
        <div>
            <div className="chart-row">
                <div className="chart-section">
                    <h3>🏷️ Category Distribution</h3>
                    <div className="chart-wrapper" style={{ maxWidth: 320, margin: '0 auto' }}>
                        <Doughnut data={categoryChartData} options={doughnutOptions} />
                    </div>
                </div>
                <div className="chart-section">
                    <h3>📋 Category Details</h3>
                    <table className="category-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th>Total</th>
                                <th>Count</th>
                                <th>Share</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map((c) => (
                                <tr key={c.name}>
                                    <td>
                                        <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', backgroundColor: categoryColors[c.name] || '#ccc', marginRight: 8 }}></span>
                                        {c.name}
                                    </td>
                                    <td>{formatCurrency(c.total)}</td>
                                    <td>{c.count}</td>
                                    <td>
                                        {c.percentage}%
                                        <div className="category-bar">
                                            <div className="category-bar-fill" style={{ width: `${c.percentage}%`, backgroundColor: categoryColors[c.name] || '#667eea' }}></div>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );

    const renderInvestments = () => (
        <div>
            <div className="stats-grid">
                <div className="stat-card stat-card-green">
                    <div className="stat-label">Total Invested</div>
                    <div className="stat-value">{formatCurrency(investments.totalInvested)}</div>
                </div>
                <div className="stat-card stat-card-teal">
                    <div className="stat-label">Avg Monthly</div>
                    <div className="stat-value">{formatCurrency(Math.round(investments.avgMonthly))}</div>
                </div>
                {investments.growthRate !== null && (
                    <div className="stat-card stat-card-blue">
                        <div className="stat-label">Growth Rate</div>
                        <div className="stat-value" style={{ color: investments.growthRate >= 0 ? '#43e97b' : '#f5576c' }}>
                            {investments.growthRate > 0 ? '+' : ''}{investments.growthRate}%
                        </div>
                        <div className="stat-sub">Recent 3mo vs Previous 3mo</div>
                    </div>
                )}
            </div>
            <div className="chart-section">
                <h3>💰 Investment Trend</h3>
                <div className="chart-wrapper">
                    <Line data={investmentTrendData} options={chartOptions} />
                </div>
            </div>
        </div>
    );

    const renderHealth = () => {
        if (healthScore.score === null) return <div className="no-data-msg">Need at least 2 completed months for health score.</div>;
        const { score, breakdown, maxBreakdown, grade } = healthScore;
        const bars = [
            { label: 'Investment Rate', value: breakdown.investmentScore, max: (maxBreakdown && maxBreakdown.investmentScore) || 30, color: '#43e97b' },
            { label: 'Spending Consistency', value: breakdown.consistencyScore, max: (maxBreakdown && maxBreakdown.consistencyScore) || 25, color: '#4facfe' },
            { label: 'Expense Trend', value: breakdown.trendScore, max: (maxBreakdown && maxBreakdown.trendScore) || 25, color: '#fee140' },
            { label: 'Investment Growth', value: breakdown.investGrowthScore, max: (maxBreakdown && maxBreakdown.investGrowthScore) || 20, color: '#fa709a' },
        ];

        return (
            <div className="chart-section">
                <h3>❤️ Financial Health Score</h3>
                <div className="health-score-container">
                    <div className="health-gauge" style={getHealthGaugeStyle(score)}>
                        <div className="health-gauge-inner">
                            <div className="health-score-value">{score}</div>
                            <div className={`health-grade grade-${grade}`}>Grade {grade}</div>
                        </div>
                    </div>
                    <div className="health-breakdown">
                        {bars.map((bar) => (
                            <div className="health-bar-item" key={bar.label}>
                                <div className="health-bar-label">
                                    <span>{bar.label}</span>
                                    <span>{bar.value}/{bar.max}</span>
                                </div>
                                <div className="health-bar-track">
                                    <div className="health-bar-fill" style={{ width: `${(bar.value / bar.max) * 100}%`, background: bar.color }}></div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderInflationStat = (label, stats) => {
        if (!stats) return null;
        return (
            <div className="chart-section" style={{ marginBottom: 16 }}>
                <h3>{label}</h3>
                <div className="stats-grid">
                    <div className="stat-card stat-card-orange">
                        <div className="stat-label">Average</div>
                        <div className="stat-value" style={{ color: stats.avg > 0 ? '#f5576c' : '#43e97b', fontSize: '1.2rem' }}>
                            {stats.avg > 0 ? '+' : ''}{stats.avg}%
                        </div>
                    </div>
                    <div className="stat-card stat-card-blue">
                        <div className="stat-label">Median</div>
                        <div className="stat-value" style={{ color: stats.median > 0 ? '#f5576c' : '#43e97b', fontSize: '1.2rem' }}>
                            {stats.median > 0 ? '+' : ''}{stats.median}%
                        </div>
                    </div>
                    <div className="stat-card stat-card-red">
                        <div className="stat-label">Max Spike</div>
                        <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                            {stats.max > 0 ? '+' : ''}{stats.max}%
                        </div>
                    </div>
                    <div className="stat-card stat-card-green">
                        <div className="stat-label">Max Drop</div>
                        <div className="stat-value" style={{ fontSize: '1.2rem' }}>
                            {stats.min > 0 ? '+' : ''}{stats.min}%
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderInflation = () => (
        <div>
            {/* Trend direction banner */}
            {inflation.expenseTrendDirection && (
                <div className="stat-card" style={{ marginBottom: 16, textAlign: 'center', borderColor: inflation.expenseTrendDirection === 'accelerating' ? 'rgba(245,87,108,0.3)' : 'rgba(67,233,123,0.3)' }}>
                    <div className="stat-label">Expense Inflation Trend</div>
                    <div className="stat-value" style={{ color: inflation.expenseTrendDirection === 'accelerating' ? '#f5576c' : '#43e97b', fontSize: '1.1rem' }}>
                        {inflation.expenseTrendDirection === 'accelerating' ? '📈 Accelerating' : '📉 Decelerating'}
                    </div>
                    <div className="stat-sub">Based on last 6 months</div>
                </div>
            )}

            {/* Overall Expense Inflation Stats */}
            {renderInflationStat('📊 Overall Expense Inflation', inflation.expenseStats)}

            {/* Last 6 Months */}
            {renderInflationStat('📅 Last 6 Months — Expense Inflation', inflation.last6 && inflation.last6.expense)}

            {/* Last 12 Months */}
            {renderInflationStat('📅 Last 12 Months — Expense Inflation', inflation.last12 && inflation.last12.expense)}

            {/* Investment inflation stats if available */}
            {inflation.investmentStats && renderInflationStat('💰 Overall Investment Inflation', inflation.investmentStats)}

            {/* Monthly MoM Table */}
            <div className="chart-section">
                <h3>📉 Monthly Inflation (MoM % Change)</h3>
                {inflation.monthly.length > 0 ? (
                    <table className="inflation-table">
                        <thead>
                            <tr>
                                <th>Month</th>
                                <th>Expense Change</th>
                                <th>Investment Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[...inflation.monthly].reverse().map((m, i) => (
                                <tr key={i}>
                                    <td>{m.label}</td>
                                    <td className={m.expenseChange > 0 ? 'positive-change' : 'negative-change'}>
                                        {m.expenseChange !== null ? `${m.expenseChange > 0 ? '+' : ''}${m.expenseChange}%` : '—'}
                                    </td>
                                    <td className={m.investmentChange > 0 ? 'positive-change' : (m.investmentChange < 0 ? 'negative-change' : '')}>
                                        {m.investmentChange !== null ? `${m.investmentChange > 0 ? '+' : ''}${m.investmentChange}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <div className="no-data-msg">Need at least 2 completed months.</div>}
            </div>

            {/* Yearly YoY Table */}
            <div className="chart-section">
                <h3>📉 Yearly Inflation (YoY % Change — Pro-Rata Annualized)</h3>
                {inflation.yearly.length > 0 ? (
                    <table className="inflation-table">
                        <thead>
                            <tr>
                                <th>Year</th>
                                <th>Expense Change</th>
                                <th>Investment Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {inflation.yearly.map((y, i) => (
                                <tr key={i}>
                                    <td>{y.label}</td>
                                    <td className={y.expenseChange > 0 ? 'positive-change' : 'negative-change'}>
                                        {y.expenseChange !== null ? `${y.expenseChange > 0 ? '+' : ''}${y.expenseChange}%` : '—'}
                                    </td>
                                    <td className={y.investmentChange > 0 ? 'positive-change' : (y.investmentChange < 0 ? 'negative-change' : '')}>
                                        {y.investmentChange !== null ? `${y.investmentChange > 0 ? '+' : ''}${y.investmentChange}%` : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : <div className="no-data-msg">Need at least 2 years of data.</div>}
            </div>
        </div>
    );

    const renderForecast = () => {
        if (!forecast) return <div className="no-data-msg">Not enough data for forecasting. Need at least 3 completed months.</div>;

        return (
            <div>
                <div className="stats-grid" style={{ marginBottom: 24 }}>
                    <div className="stat-card stat-card-purple">
                        <div className="stat-label">Avg Monthly Expense</div>
                        <div className="stat-value">{formatCurrency(forecast.avgExpense)}</div>
                        <div className="stat-sub">Based on last 3 months</div>
                    </div>
                    <div className="stat-card stat-card-green">
                        <div className="stat-label">Avg Monthly Investment</div>
                        <div className="stat-value">{formatCurrency(forecast.avgInvestment)}</div>
                        <div className="stat-sub">Based on last 3 months</div>
                    </div>
                </div>
                <div className="forecast-grid">
                    <div className="forecast-card">
                        <h4>🔮 3-Month Forecast</h4>
                        {forecast.threeMonth.map((m, i) => (
                            <div className="forecast-month" key={i}>
                                <span>{m.label}</span>
                                <span>
                                    Exp: {formatCurrency(m.projectedExpense)} &nbsp;|&nbsp; Inv: {formatCurrency(m.projectedInvestment)}
                                </span>
                            </div>
                        ))}
                        <div className="forecast-month" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 8, paddingTop: 12, fontWeight: 700 }}>
                            <span>3-Mo Total</span>
                            <span>{formatCurrency(forecast.threeMonth.reduce((s, m) => s + m.projectedTotal, 0))}</span>
                        </div>
                    </div>
                    <div className="forecast-card">
                        <h4>🔮 6-Month Forecast</h4>
                        {forecast.sixMonth.map((m, i) => (
                            <div className="forecast-month" key={i}>
                                <span>{m.label}</span>
                                <span>
                                    Exp: {formatCurrency(m.projectedExpense)} &nbsp;|&nbsp; Inv: {formatCurrency(m.projectedInvestment)}
                                </span>
                            </div>
                        ))}
                        <div className="forecast-month" style={{ borderTop: '1px solid rgba(255,255,255,0.15)', marginTop: 8, paddingTop: 12, fontWeight: 700 }}>
                            <span>6-Mo Total</span>
                            <span>{formatCurrency(forecast.sixMonth.reduce((s, m) => s + m.projectedTotal, 0))}</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const renderSavings = () => {
        if (!savings) return <div className="no-data-msg">No data available.</div>;

        return (
            <div>
                <div className="stats-grid">
                    <div className="stat-card stat-card-green">
                        <div className="stat-label">Overall Savings Rate</div>
                        <div className="stat-value">{savings.overallRate}%</div>
                        <div className="stat-sub">Investment / Total</div>
                    </div>
                    <div className="stat-card stat-card-purple">
                        <div className="stat-label">Total Invested</div>
                        <div className="stat-value">{formatCurrency(savings.totalInvested)}</div>
                    </div>
                    <div className="stat-card stat-card-red">
                        <div className="stat-label">Total Spent</div>
                        <div className="stat-value">{formatCurrency(savings.totalSpent)}</div>
                    </div>
                </div>
                <div className="chart-section">
                    <h3>🐷 Monthly Spending vs Investing</h3>
                    <div className="chart-wrapper">
                        {savingsChartData && (
                            <Bar data={savingsChartData} options={{ ...chartOptions, plugins: { ...chartOptions.plugins, }, scales: { ...chartOptions.scales, x: { ...chartOptions.scales.x, stacked: true }, y: { ...chartOptions.scales.y, stacked: true } } }} />
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const renderEmergency = () => {
        if (!emergencyFund) return <div className="no-data-msg">Need at least 2 completed months for emergency fund calculation.</div>;

        return (
            <div className="chart-section">
                <h3>🚨 6-Month Emergency Fund (Inflation Adjusted)</h3>
                <div className="emergency-fund-card">
                    <div className="ef-item">
                        <div className="ef-value">{formatCurrency(emergencyFund.avgMonthlyExpense)}</div>
                        <div className="ef-label">Avg Monthly Expense</div>
                    </div>
                    <div className="ef-item">
                        <div className="ef-value">{emergencyFund.monthlyInflationRate}%</div>
                        <div className="ef-label">Avg Monthly Inflation</div>
                    </div>
                    <div className="ef-item">
                        <div className="ef-value">{formatCurrency(emergencyFund.baselineEmergencyFund)}</div>
                        <div className="ef-label">Baseline (No Inflation)</div>
                    </div>
                    <div className="ef-item ef-highlight">
                        <div className="ef-value" style={{ color: '#667eea' }}>{formatCurrency(emergencyFund.adjustedEmergencyFund)}</div>
                        <div className="ef-label">Inflation-Adjusted Fund</div>
                    </div>
                    <div className="ef-item">
                        <div className="ef-value" style={{ color: '#fa709a' }}>{formatCurrency(emergencyFund.inflationImpact)}</div>
                        <div className="ef-label">Inflation Impact</div>
                    </div>
                </div>
            </div>
        );
    };

    const tabContent = {
        overview: renderOverview,
        trend: renderTrend,
        categories: renderCategories,
        investments: renderInvestments,
        health: renderHealth,
        inflation: renderInflation,
        forecast: renderForecast,
        savings: renderSavings,
        emergency: renderEmergency,
    };

    return (
        <div className="analysis-overlay" onClick={onClose}>
            <div className="analysis-container" onClick={(e) => e.stopPropagation()}>
                <div className="analysis-header">
                    <h2>📊 Financial Analysis</h2>
                    <button className="analysis-close-btn" onClick={onClose}>✕</button>
                </div>

                <div className="analysis-tabs">
                    {TABS.map((tab) => (
                        <button
                            key={tab.key}
                            className={`analysis-tab ${activeTab === tab.key ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab.key)}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="analysis-content">
                    {tabContent[activeTab] ? tabContent[activeTab]() : null}
                </div>
            </div>
        </div>
    );
};

export default ExpenseAnalysis;
