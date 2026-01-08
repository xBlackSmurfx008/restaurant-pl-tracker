import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function ProfitLossReport() {
  const [pnl, setPnl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('month');
  const [customDates, setCustomDates] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0]
  });
  const [compareEnabled, setCompareEnabled] = useState(false);

  const getPeriodDates = useCallback(() => {
    const now = new Date();
    let start, end;

    switch (period) {
      case 'today':
        start = end = now.toISOString().split('T')[0];
        break;
      case 'week':
        start = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'month':
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'quarter':
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), qMonth, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'year':
        start = new Date(now.getFullYear(), 0, 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
        break;
      case 'custom':
        return customDates;
      default:
        start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        end = new Date().toISOString().split('T')[0];
    }

    return { start_date: start, end_date: end };
  }, [period, customDates]);

  const loadPnL = useCallback(async () => {
    try {
      setLoading(true);
      const dates = getPeriodDates();
      const data = await api.getPnLStatement(
        dates.start_date, 
        dates.end_date, 
        compareEnabled ? 'previous' : null
      );
      setPnl(data);
    } catch (error) {
      console.error('Error loading P&L:', error);
      alert('Error loading P&L report: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [getPeriodDates, compareEnabled]);

  useEffect(() => {
    loadPnL();
  }, [loadPnL]);

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(num);
  };

  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  const getVarianceColor = (variance) => {
    if (variance > 0) return '#28a745';
    if (variance < 0) return '#dc3545';
    return '#666';
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  const current = pnl?.current;

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">📊 Profit & Loss Statement</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.9rem' }}>
            <input
              type="checkbox"
              checked={compareEnabled}
              onChange={(e) => setCompareEnabled(e.target.checked)}
            />
            Compare to Previous
          </label>
        </div>
      </div>

      {/* Period Selector */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {[
          { value: 'today', label: 'Today' },
          { value: 'week', label: 'This Week' },
          { value: 'month', label: 'This Month' },
          { value: 'quarter', label: 'This Quarter' },
          { value: 'year', label: 'YTD' },
          { value: 'custom', label: 'Custom' }
        ].map(p => (
          <button
            key={p.value}
            className={`tab-button ${period === p.value ? 'active' : ''}`}
            onClick={() => setPeriod(p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {period === 'custom' && (
        <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>Start Date</label>
              <input
                type="date"
                className="form-control"
                value={customDates.start_date}
                onChange={(e) => setCustomDates({ ...customDates, start_date: e.target.value })}
              />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '5px' }}>End Date</label>
              <input
                type="date"
                className="form-control"
                value={customDates.end_date}
                onChange={(e) => setCustomDates({ ...customDates, end_date: e.target.value })}
              />
            </div>
            <button className="btn btn-primary" onClick={loadPnL}>Generate Report</button>
          </div>
        </div>
      )}

      {current && (
        <>
          {/* Key Metrics */}
          <div className="metrics-grid" style={{ marginBottom: '30px' }}>
            <div className="metric-card">
              <div className="metric-label">Net Revenue</div>
              <div className="metric-value">{formatCurrency(current.revenue?.net_sales)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Gross Profit</div>
              <div className="metric-value" style={{ color: current.gross_profit?.amount >= 0 ? '#28a745' : '#dc3545' }}>
                {formatCurrency(current.gross_profit?.amount)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {formatPercent(current.gross_profit?.margin_percent)} margin
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net Income</div>
              <div className="metric-value" style={{ color: current.net_income?.amount >= 0 ? '#28a745' : '#dc3545' }}>
                {formatCurrency(current.net_income?.amount)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>
                {formatPercent(current.net_income?.margin_percent)} margin
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Food Cost %</div>
              <div className="metric-value" style={{ 
                color: current.metrics?.food_cost_percent <= 30 ? '#28a745' : 
                       current.metrics?.food_cost_percent <= 35 ? '#ffc107' : '#dc3545' 
              }}>
                {formatPercent(current.metrics?.food_cost_percent)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Target: 30%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Labor Cost %</div>
              <div className="metric-value" style={{ 
                color: current.metrics?.labor_cost_percent <= 30 ? '#28a745' : 
                       current.metrics?.labor_cost_percent <= 35 ? '#ffc107' : '#dc3545' 
              }}>
                {formatPercent(current.metrics?.labor_cost_percent)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Target: 30%</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Prime Cost %</div>
              <div className="metric-value" style={{ 
                color: current.metrics?.prime_cost_percent <= 60 ? '#28a745' : 
                       current.metrics?.prime_cost_percent <= 65 ? '#ffc107' : '#dc3545' 
              }}>
                {formatPercent(current.metrics?.prime_cost_percent)}
              </div>
              <div style={{ fontSize: '0.85rem', color: '#666' }}>Target: 60%</div>
            </div>
          </div>

          {/* P&L Statement */}
          <div className="card">
            <h3 style={{ marginBottom: '20px' }}>
              📋 Statement for {pnl?.period?.start_date} to {pnl?.period?.end_date}
            </h3>

            <table className="table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '50%' }}>Line Item</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th style={{ textAlign: 'right' }}>% of Revenue</th>
                  {compareEnabled && pnl?.comparison && (
                    <>
                      <th style={{ textAlign: 'right' }}>Prior Period</th>
                      <th style={{ textAlign: 'right' }}>Variance</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {/* REVENUE SECTION */}
                <tr style={{ background: '#e8f5e9' }}>
                  <td colSpan={compareEnabled && pnl?.comparison ? 5 : 3} style={{ fontWeight: '600' }}>
                    📈 REVENUE
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '20px' }}>Food Sales</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.food_sales)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {current.revenue?.net_sales > 0 
                      ? formatPercent((current.revenue?.food_sales / current.revenue?.net_sales) * 100)
                      : '0%'}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '20px' }}>Beverage Sales</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.beverage_sales)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {current.revenue?.net_sales > 0 
                      ? formatPercent((current.revenue?.beverage_sales / current.revenue?.net_sales) * 100)
                      : '0%'}
                  </td>
                </tr>
                {current.revenue?.alcohol_sales > 0 && (
                  <tr>
                    <td style={{ paddingLeft: '20px' }}>Alcohol Sales</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.alcohol_sales)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPercent((current.revenue?.alcohol_sales / current.revenue?.net_sales) * 100)}
                    </td>
                  </tr>
                )}
                {current.revenue?.catering_sales > 0 && (
                  <tr>
                    <td style={{ paddingLeft: '20px' }}>Catering Sales</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.catering_sales)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {formatPercent((current.revenue?.catering_sales / current.revenue?.net_sales) * 100)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ paddingLeft: '20px' }}>Gross Sales</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.gross_sales)}</td>
                  <td style={{ textAlign: 'right' }}>-</td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '20px', color: '#dc3545' }}>Less: Discounts & Comps</td>
                  <td style={{ textAlign: 'right', color: '#dc3545' }}>
                    ({formatCurrency((current.revenue?.discounts || 0) + (current.revenue?.comps || 0) + (current.revenue?.refunds || 0))})
                  </td>
                  <td style={{ textAlign: 'right' }}>-</td>
                </tr>
                <tr style={{ fontWeight: '600', borderTop: '2px solid #333' }}>
                  <td style={{ paddingLeft: '20px' }}>Net Sales</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.revenue?.net_sales)}</td>
                  <td style={{ textAlign: 'right' }}>100%</td>
                  {compareEnabled && pnl?.comparison && (
                    <>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(pnl.comparison.revenue?.net_sales)}</td>
                      <td style={{ textAlign: 'right', color: getVarianceColor(pnl.variance?.revenue?.net_sales) }}>
                        {pnl.variance?.revenue?.net_sales > 0 ? '+' : ''}{formatPercent(pnl.variance?.revenue?.net_sales)}
                      </td>
                    </>
                  )}
                </tr>

                {/* COGS SECTION */}
                <tr style={{ background: '#ffebee' }}>
                  <td colSpan={compareEnabled && pnl?.comparison ? 5 : 3} style={{ fontWeight: '600' }}>
                    📦 COST OF GOODS SOLD
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingLeft: '20px' }}>Food Cost (Calculated)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.cost_of_goods_sold?.food_cost_calculated)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {current.revenue?.net_sales > 0 
                      ? formatPercent((current.cost_of_goods_sold?.food_cost_calculated / current.revenue?.net_sales) * 100)
                      : '0%'}
                  </td>
                </tr>
                {current.cost_of_goods_sold?.cogs_expenses?.map((exp, i) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: '20px' }}>{exp.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {current.revenue?.net_sales > 0 
                        ? formatPercent((exp.amount / current.revenue?.net_sales) * 100)
                        : '0%'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: '600', borderTop: '2px solid #333' }}>
                  <td style={{ paddingLeft: '20px' }}>Total COGS</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.cost_of_goods_sold?.total_cogs)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(current.metrics?.food_cost_percent)}</td>
                </tr>

                {/* GROSS PROFIT */}
                <tr style={{ background: '#e3f2fd', fontWeight: '600' }}>
                  <td>💰 GROSS PROFIT</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.gross_profit?.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(current.gross_profit?.margin_percent)}</td>
                  {compareEnabled && pnl?.comparison && (
                    <>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(pnl.comparison.gross_profit?.amount)}</td>
                      <td style={{ textAlign: 'right', color: getVarianceColor(pnl.variance?.gross_profit?.amount) }}>
                        {pnl.variance?.gross_profit?.amount > 0 ? '+' : ''}{formatPercent(pnl.variance?.gross_profit?.amount)}
                      </td>
                    </>
                  )}
                </tr>

                {/* LABOR COSTS */}
                <tr style={{ background: '#fff3e0' }}>
                  <td colSpan={compareEnabled && pnl?.comparison ? 5 : 3} style={{ fontWeight: '600' }}>
                    👥 LABOR COSTS
                  </td>
                </tr>
                {current.labor_costs?.payroll?.total > 0 && (
                  <tr>
                    <td style={{ paddingLeft: '20px' }}>Payroll (Gross + Taxes)</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(current.labor_costs?.payroll?.total)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {current.revenue?.net_sales > 0 
                        ? formatPercent((current.labor_costs?.payroll?.total / current.revenue?.net_sales) * 100)
                        : '0%'}
                    </td>
                  </tr>
                )}
                {current.labor_costs?.labor_expenses?.map((exp, i) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: '20px' }}>{exp.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {current.revenue?.net_sales > 0 
                        ? formatPercent((exp.amount / current.revenue?.net_sales) * 100)
                        : '0%'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: '600', borderTop: '2px solid #333' }}>
                  <td style={{ paddingLeft: '20px' }}>Total Labor</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.labor_costs?.total_labor)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(current.metrics?.labor_cost_percent)}</td>
                </tr>

                {/* PRIME COST */}
                <tr style={{ background: '#fce4ec', fontWeight: '600' }}>
                  <td>🔥 PRIME COST (COGS + Labor)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.prime_cost?.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(current.prime_cost?.percent)}</td>
                </tr>

                {/* OPERATING EXPENSES */}
                <tr style={{ background: '#f3e5f5' }}>
                  <td colSpan={compareEnabled && pnl?.comparison ? 5 : 3} style={{ fontWeight: '600' }}>
                    🏢 OPERATING EXPENSES
                  </td>
                </tr>
                {current.operating_expenses?.items?.map((exp, i) => (
                  <tr key={i}>
                    <td style={{ paddingLeft: '20px' }}>{exp.category}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                    <td style={{ textAlign: 'right' }}>
                      {current.revenue?.net_sales > 0 
                        ? formatPercent((exp.amount / current.revenue?.net_sales) * 100)
                        : '0%'}
                    </td>
                  </tr>
                ))}
                <tr style={{ fontWeight: '600' }}>
                  <td style={{ paddingLeft: '20px' }}>Total Operating</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.operating_expenses?.total)}</td>
                  <td style={{ textAlign: 'right' }}>
                    {current.revenue?.net_sales > 0 
                      ? formatPercent((current.operating_expenses?.total / current.revenue?.net_sales) * 100)
                      : '0%'}
                  </td>
                </tr>

                {/* MARKETING EXPENSES */}
                {current.marketing_expenses?.total > 0 && (
                  <>
                    <tr style={{ background: '#fff8e1' }}>
                      <td colSpan={compareEnabled && pnl?.comparison ? 5 : 3} style={{ fontWeight: '600' }}>
                        📣 MARKETING EXPENSES
                      </td>
                    </tr>
                    {current.marketing_expenses?.items?.map((exp, i) => (
                      <tr key={i}>
                        <td style={{ paddingLeft: '20px' }}>{exp.category}</td>
                        <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                        <td style={{ textAlign: 'right' }}>
                          {current.revenue?.net_sales > 0 
                            ? formatPercent((exp.amount / current.revenue?.net_sales) * 100)
                            : '0%'}
                        </td>
                      </tr>
                    ))}
                    <tr style={{ fontWeight: '600' }}>
                      <td style={{ paddingLeft: '20px' }}>Total Marketing</td>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(current.marketing_expenses?.total)}</td>
                      <td style={{ textAlign: 'right' }}>
                        {current.revenue?.net_sales > 0 
                          ? formatPercent((current.marketing_expenses?.total / current.revenue?.net_sales) * 100)
                          : '0%'}
                      </td>
                    </tr>
                  </>
                )}

                {/* NET INCOME */}
                <tr style={{ 
                  background: current.net_income?.amount >= 0 ? '#c8e6c9' : '#ffcdd2', 
                  fontWeight: '700',
                  fontSize: '1.1rem'
                }}>
                  <td>💵 NET INCOME</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(current.net_income?.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatPercent(current.net_income?.margin_percent)}</td>
                  {compareEnabled && pnl?.comparison && (
                    <>
                      <td style={{ textAlign: 'right' }}>{formatCurrency(pnl.comparison.net_income?.amount)}</td>
                      <td style={{ textAlign: 'right', color: getVarianceColor(pnl.variance?.net_income?.amount) }}>
                        {pnl.variance?.net_income?.amount > 0 ? '+' : ''}{formatPercent(pnl.variance?.net_income?.amount)}
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Additional Metrics */}
          <div className="card" style={{ marginTop: '20px' }}>
            <h3>📈 Additional Metrics</h3>
            <div className="metrics-grid" style={{ marginTop: '15px' }}>
              <div className="metric-card">
                <div className="metric-label">Items Sold</div>
                <div className="metric-value">{current.metrics?.items_sold?.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Transactions</div>
                <div className="metric-value">{current.metrics?.transaction_count?.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Customers</div>
                <div className="metric-value">{current.metrics?.customer_count?.toLocaleString()}</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Avg Check</div>
                <div className="metric-value">{formatCurrency(current.metrics?.average_check)}</div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default ProfitLossReport;

