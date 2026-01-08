import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function ReportsPanel() {
  const [activeReport, setActiveReport] = useState('pnl');
  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState(null);
  
  // Date range
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // First of month
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [comparePeriod, setComparePeriod] = useState('');

  const reports = [
    { id: 'pnl', label: 'P&L Statement' },
    { id: 'cash-flow', label: 'Cash Flow' },
    { id: 'daily', label: 'Daily Summary', icon: '📅' },
    { id: 'vendor', label: 'Vendor Analysis', icon: '🏪' },
    { id: 'budget', label: 'Budget vs Actual' },
  ];

  const loadReport = useCallback(async () => {
    setLoading(true);
    try {
      let data;
      switch (activeReport) {
        case 'pnl':
          data = await api.getPnLStatement(startDate, endDate, comparePeriod || null);
          break;
        case 'cash-flow':
          data = await api.getCashFlowReport(startDate, endDate);
          break;
        case 'daily':
          data = await api.getDailySummary(startDate, endDate);
          break;
        case 'vendor':
          data = await api.getVendorAnalysis(startDate, endDate);
          break;
        case 'budget':
          const month = new Date(startDate).getMonth() + 1;
          const year = new Date(startDate).getFullYear();
          data = await api.getBudgetVsActual(month, year);
          break;
        default:
          data = null;
      }
      setReportData(data);
    } catch (error) {
      console.error('Report error:', error);
      alert('Error loading report: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [activeReport, startDate, endDate, comparePeriod]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatPercent = (value) => {
    return `${parseFloat(value || 0).toFixed(1)}%`;
  };

  // Quick date presets
  const setPreset = (preset) => {
    const now = new Date();
    let start, end;
    
    switch (preset) {
      case 'mtd':
        start = new Date(now.getFullYear(), now.getMonth(), 1);
        end = now;
        break;
      case 'last-month':
        start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        end = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case 'qtd':
        const quarter = Math.floor(now.getMonth() / 3);
        start = new Date(now.getFullYear(), quarter * 3, 1);
        end = now;
        break;
      case 'ytd':
        start = new Date(now.getFullYear(), 0, 1);
        end = now;
        break;
      case 'last-year':
        start = new Date(now.getFullYear() - 1, 0, 1);
        end = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        return;
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  // Render P&L Statement
  const renderPnL = () => {
    if (!reportData) return null;
    const { revenue, cost_of_goods_sold, gross_profit, operating_expenses, 
            marketing_expenses, payroll, other_expenses, net_income, ratios, comparison } = reportData; // eslint-disable-line no-unused-vars

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px', borderBottom: '2px solid #667eea', paddingBottom: '10px' }}>
          Profit & Loss Statement
        </h3>
        
        {/* Revenue Section */}
        <div style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#28a745', marginBottom: '10px' }}>Revenue</h4>
          <table className="table" style={{ marginBottom: '0' }}>
            <tbody>
              <tr><td>Food Sales</td><td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.food_sales)}</td></tr>
              <tr><td>Beverage Sales</td><td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.beverage_sales)}</td></tr>
              <tr><td>Alcohol Sales</td><td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.alcohol_sales)}</td></tr>
              <tr><td>Catering</td><td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.catering_sales)}</td></tr>
              <tr><td>Other</td><td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.other_sales)}</td></tr>
              <tr style={{ background: '#f8f9fa' }}>
                <td><strong>Gross Revenue</strong></td>
                <td style={{ textAlign: 'right' }}><strong>{formatCurrency(revenue?.gross_revenue)}</strong></td>
              </tr>
              <tr><td style={{ color: '#dc3545' }}>Less: Discounts</td><td style={{ textAlign: 'right', color: '#dc3545' }}>({formatCurrency(revenue?.discounts)})</td></tr>
              <tr style={{ background: '#e8f5e9', fontWeight: '600' }}>
                <td>Net Revenue</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(revenue?.net_revenue)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* COGS Section */}
        <div style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#dc3545', marginBottom: '10px' }}>Cost of Goods Sold</h4>
          <table className="table" style={{ marginBottom: '0' }}>
            <tbody>
              <tr><td>Food Cost</td><td style={{ textAlign: 'right' }}>{formatCurrency(cost_of_goods_sold?.food_cost)}</td></tr>
              <tr style={{ background: '#ffebee', fontWeight: '600' }}>
                <td>Total COGS</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(cost_of_goods_sold?.total_cogs)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Gross Profit */}
        <div style={{ background: '#e3f2fd', padding: '15px', borderRadius: '8px', marginBottom: '25px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.1rem', fontWeight: '600' }}>Gross Profit</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.3rem', fontWeight: '700', color: gross_profit >= 0 ? '#28a745' : '#dc3545' }}>
                {formatCurrency(gross_profit)}
              </div>
              <div style={{ fontSize: '0.9rem', color: '#666' }}>
                {formatPercent(reportData.gross_profit_margin)} margin
              </div>
            </div>
          </div>
        </div>

        {/* Operating Expenses */}
        <div style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#6c757d', marginBottom: '10px' }}>Operating Expenses</h4>
          <table className="table" style={{ marginBottom: '0' }}>
            <tbody>
              {operating_expenses?.items?.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.category_name || item.tax_category}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(item.total_amount)}</td>
                </tr>
              ))}
              <tr style={{ background: '#f8f9fa', fontWeight: '600' }}>
                <td>Total Operating</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(operating_expenses?.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Payroll */}
        <div style={{ marginBottom: '25px' }}>
          <h4 style={{ color: '#17a2b8', marginBottom: '10px' }}>Payroll & Labor</h4>
          <table className="table" style={{ marginBottom: '0' }}>
            <tbody>
              <tr><td>Gross Wages</td><td style={{ textAlign: 'right' }}>{formatCurrency(payroll?.gross_wages)}</td></tr>
              <tr><td>Payroll Taxes</td><td style={{ textAlign: 'right' }}>{formatCurrency(payroll?.payroll_taxes)}</td></tr>
              <tr style={{ background: '#e0f7fa', fontWeight: '600' }}>
                <td>Total Payroll</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(payroll?.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Marketing */}
        {marketing_expenses?.total > 0 && (
          <div style={{ marginBottom: '25px' }}>
            <h4 style={{ color: '#9c27b0', marginBottom: '10px' }}>Marketing</h4>
            <table className="table" style={{ marginBottom: '0' }}>
              <tbody>
                <tr style={{ background: '#f3e5f5', fontWeight: '600' }}>
                  <td>Total Marketing</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(marketing_expenses?.total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Net Income */}
        <div style={{ 
          background: net_income >= 0 ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)' : 'linear-gradient(135deg, #dc3545 0%, #e83e8c 100%)', 
          padding: '20px', 
          borderRadius: '12px',
          color: 'white'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '1.2rem', fontWeight: '600' }}>Net Income</span>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '700' }}>
                {formatCurrency(net_income)}
              </div>
              <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>
                {formatPercent(reportData.net_income_margin)} of revenue
              </div>
            </div>
          </div>
        </div>

        {/* Key Ratios */}
        <div style={{ marginTop: '25px' }}>
          <h4 style={{ marginBottom: '15px' }}>Key Ratios</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px' }}>
            <div className="metric-card">
              <div className="metric-label">Food Cost %</div>
              <div className="metric-value" style={{ color: parseFloat(ratios?.food_cost_percent) > 35 ? '#dc3545' : '#28a745' }}>
                {formatPercent(ratios?.food_cost_percent)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Labor Cost %</div>
              <div className="metric-value" style={{ color: parseFloat(ratios?.labor_cost_percent) > 35 ? '#dc3545' : '#28a745' }}>
                {formatPercent(ratios?.labor_cost_percent)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Prime Cost %</div>
              <div className="metric-value" style={{ color: parseFloat(ratios?.prime_cost_percent) > 65 ? '#dc3545' : '#28a745' }}>
                {formatPercent(ratios?.prime_cost_percent)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Operating %</div>
              <div className="metric-value">
                {formatPercent(ratios?.operating_expense_percent)}
              </div>
            </div>
          </div>
        </div>

        {/* Comparison */}
        {comparison && (
          <div style={{ marginTop: '25px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
            <h4 style={{ marginBottom: '10px' }}>vs Previous Period</h4>
            <div style={{ display: 'flex', gap: '20px' }}>
              <div>Previous Revenue: {formatCurrency(comparison.revenue)}</div>
              <div style={{ color: comparison.revenue_change >= 0 ? '#28a745' : '#dc3545', fontWeight: '600' }}>
                {comparison.revenue_change >= 0 ? '+' : ''}{formatCurrency(comparison.revenue_change)} ({comparison.revenue_change_percent}%)
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // Render Cash Flow
  const renderCashFlow = () => {
    if (!reportData) return null;
    const { weekly, totals } = reportData;

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Cash Flow Analysis</h3>
        
        {/* Summary Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div className="metric-card" style={{ background: '#e8f5e9' }}>
            <div className="metric-label">Total Inflows</div>
            <div className="metric-value" style={{ color: '#28a745' }}>{formatCurrency(totals?.total_in)}</div>
          </div>
          <div className="metric-card" style={{ background: '#ffebee' }}>
            <div className="metric-label">Total Outflows</div>
            <div className="metric-value" style={{ color: '#dc3545' }}>{formatCurrency(totals?.total_out)}</div>
          </div>
          <div className="metric-card" style={{ background: totals?.net_change >= 0 ? '#e3f2fd' : '#fff3cd' }}>
            <div className="metric-label">Net Change</div>
            <div className="metric-value" style={{ color: totals?.net_change >= 0 ? '#1976d2' : '#f57c00' }}>
              {formatCurrency(totals?.net_change)}
            </div>
          </div>
        </div>

        {/* Weekly Breakdown */}
        <table className="table">
          <thead>
            <tr>
              <th>Week Starting</th>
              <th style={{ textAlign: 'right' }}>Cash In</th>
              <th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Payroll</th>
              <th style={{ textAlign: 'right' }}>Net Flow</th>
              <th style={{ textAlign: 'right' }}>Running Balance</th>
            </tr>
          </thead>
          <tbody>
            {weekly?.map((week, idx) => (
              <tr key={idx}>
                <td>{week.week_start}</td>
                <td style={{ textAlign: 'right', color: '#28a745' }}>{formatCurrency(week.cash_in)}</td>
                <td style={{ textAlign: 'right', color: '#dc3545' }}>{formatCurrency(week.expenses_out)}</td>
                <td style={{ textAlign: 'right', color: '#dc3545' }}>{formatCurrency(week.payroll_out)}</td>
                <td style={{ textAlign: 'right', fontWeight: '600', color: week.net_cash_flow >= 0 ? '#28a745' : '#dc3545' }}>
                  {formatCurrency(week.net_cash_flow)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(week.running_balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Daily Summary
  const renderDaily = () => {
    if (!reportData) return null;
    const { daily, totals } = reportData;

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>📅 Daily Summary</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div className="metric-card">
            <div className="metric-label">Total Revenue</div>
            <div className="metric-value">{formatCurrency(totals?.revenue)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Expenses</div>
            <div className="metric-value">{formatCurrency(totals?.expenses)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Net</div>
            <div className="metric-value" style={{ color: totals?.net >= 0 ? '#28a745' : '#dc3545' }}>
              {formatCurrency(totals?.net)}
            </div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Avg Daily Revenue</div>
            <div className="metric-value">{formatCurrency(totals?.avg_daily_revenue)}</div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th style={{ textAlign: 'right' }}>Revenue</th>
              <th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Net</th>
              <th style={{ textAlign: 'right' }}>Transactions</th>
            </tr>
          </thead>
          <tbody>
            {daily?.map((day, idx) => (
              <tr key={idx}>
                <td>{day.date}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(day.revenue)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(day.expenses)}</td>
                <td style={{ textAlign: 'right', fontWeight: '600', color: day.net >= 0 ? '#28a745' : '#dc3545' }}>
                  {formatCurrency(day.net)}
                </td>
                <td style={{ textAlign: 'right' }}>{day.transaction_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Vendor Analysis
  const renderVendor = () => {
    if (!reportData) return null;
    const { vendors, total_spend } = reportData;

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>🏪 Vendor Spending Analysis</h3>
        
        <div className="metric-card" style={{ marginBottom: '20px', background: '#f8f9fa' }}>
          <div className="metric-label">Total Vendor Spend</div>
          <div className="metric-value">{formatCurrency(total_spend)}</div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th style={{ textAlign: 'right' }}>Transactions</th>
              <th style={{ textAlign: 'right' }}>Total Spent</th>
              <th style={{ textAlign: 'right' }}>Avg Transaction</th>
              <th style={{ textAlign: 'right' }}>% of Total</th>
              <th>Last Purchase</th>
            </tr>
          </thead>
          <tbody>
            {vendors?.map((v, idx) => (
              <tr key={idx}>
                <td style={{ fontWeight: '500' }}>{v.name}</td>
                <td style={{ textAlign: 'right' }}>{v.transaction_count}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(v.total_spent)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(v.avg_transaction)}</td>
                <td style={{ textAlign: 'right' }}>
                  <span style={{ 
                    background: '#e3f2fd', 
                    padding: '2px 8px', 
                    borderRadius: '12px',
                    fontSize: '0.85rem'
                  }}>
                    {v.percent_of_total}%
                  </span>
                </td>
                <td>{v.last_purchase}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  // Render Budget vs Actual
  const renderBudget = () => {
    if (!reportData) return null;
    const { categories, totals, period } = reportData;

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Budget vs Actual — {period?.month}/{period?.year}</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div className="metric-card">
            <div className="metric-label">Total Budget</div>
            <div className="metric-value">{formatCurrency(totals?.total_budget)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Total Actual</div>
            <div className="metric-value">{formatCurrency(totals?.total_actual)}</div>
          </div>
          <div className="metric-card" style={{ background: totals?.total_actual <= totals?.total_budget ? '#e8f5e9' : '#ffebee' }}>
            <div className="metric-label">Variance</div>
            <div className="metric-value" style={{ color: totals?.total_actual <= totals?.total_budget ? '#28a745' : '#dc3545' }}>
              {formatCurrency((totals?.total_budget || 0) - (totals?.total_actual || 0))}
            </div>
          </div>
        </div>

        <table className="table">
          <thead>
            <tr>
              <th>Category</th>
              <th>Type</th>
              <th style={{ textAlign: 'right' }}>Budget</th>
              <th style={{ textAlign: 'right' }}>Actual</th>
              <th style={{ textAlign: 'right' }}>Variance</th>
              <th style={{ textAlign: 'right' }}>% Used</th>
            </tr>
          </thead>
          <tbody>
            {categories?.map((c, idx) => (
              <tr key={idx} style={{ background: c.over_budget ? '#ffebee' : 'transparent' }}>
                <td style={{ fontWeight: '500' }}>{c.name}</td>
                <td>
                  <span style={{ 
                    background: '#f0f0f0', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    fontSize: '0.8rem'
                  }}>
                    {c.expense_type}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(c.budget_monthly)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(c.actual_spent)}</td>
                <td style={{ textAlign: 'right', color: c.variance >= 0 ? '#28a745' : '#dc3545', fontWeight: '600' }}>
                  {formatCurrency(c.variance)}
                </td>
                <td style={{ textAlign: 'right' }}>
                  {c.budget_monthly > 0 && (
                    <span style={{ 
                      background: c.over_budget ? '#dc3545' : '#28a745',
                      color: 'white',
                      padding: '2px 8px', 
                      borderRadius: '12px',
                      fontSize: '0.85rem'
                    }}>
                      {c.variance_percent}%
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Financial Reports</h2>
      </div>

      {/* Report Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {reports.map(r => (
          <button
            key={r.id}
            className={`tab-button ${activeReport === r.id ? 'active' : ''}`}
            onClick={() => setActiveReport(r.id)}
          >
            {r.icon} {r.label}
          </button>
        ))}
      </div>

      {/* Date Range */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Start Date</label>
            <input
              type="date"
              className="form-input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">End Date</label>
            <input
              type="date"
              className="form-input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
          {activeReport === 'pnl' && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Compare To</label>
              <select
                className="form-input"
                value={comparePeriod}
                onChange={(e) => setComparePeriod(e.target.value)}
              >
                <option value="">No Comparison</option>
                <option value="previous_period">Previous Period</option>
                <option value="previous_year">Same Period Last Year</option>
              </select>
            </div>
          )}
          <div style={{ display: 'flex', gap: '5px' }}>
            <button className="btn btn-secondary" onClick={() => setPreset('mtd')}>MTD</button>
            <button className="btn btn-secondary" onClick={() => setPreset('last-month')}>Last Month</button>
            <button className="btn btn-secondary" onClick={() => setPreset('qtd')}>QTD</button>
            <button className="btn btn-secondary" onClick={() => setPreset('ytd')}>YTD</button>
          </div>
          <button className="btn btn-primary" onClick={loadReport}>
            Generate Report
          </button>
        </div>
      </div>

      {/* Report Content */}
      {loading ? (
        <div className="spinner"></div>
      ) : (
        <>
          {activeReport === 'pnl' && renderPnL()}
          {activeReport === 'cash-flow' && renderCashFlow()}
          {activeReport === 'daily' && renderDaily()}
          {activeReport === 'vendor' && renderVendor()}
          {activeReport === 'budget' && renderBudget()}
        </>
      )}
    </div>
  );
}

export default ReportsPanel;

