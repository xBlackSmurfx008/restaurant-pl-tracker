import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function TaxCenter() {
  const [activeTab, setActiveTab] = useState('schedule-c');
  const [taxYear, setTaxYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);

  const tabs = [
    { id: 'schedule-c', label: 'Schedule C' },
    { id: 'quarterly', label: 'Quarterly Estimates' },
    { id: '1099', label: '1099 Vendors' },
    { id: 'expenses', label: 'Expense Details' },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      let result;
      switch (activeTab) {
        case 'schedule-c':
          result = await api.getScheduleC(taxYear);
          break;
        case 'quarterly':
          result = await api.getQuarterlyEstimates(taxYear);
          break;
        case '1099':
          result = await api.get1099Vendors(taxYear);
          break;
        case 'expenses':
          result = await api.getTaxExpenseDetails(taxYear);
          break;
        default:
          result = null;
      }
      setData(result);
    } catch (error) {
      console.error('Tax data error:', error);
      alert('Error loading tax data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [activeTab, taxYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Export handler
  const handleExport = async (type) => {
    try {
      const blob = await api.exportTaxData(taxYear, type);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}-${taxYear}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  // Render Schedule C
  const renderScheduleC = () => {
    if (!data) return null;

    const incomeLines = [
      { line: '1', label: 'Gross receipts or sales', value: data.line_1_gross_receipts },
      { line: '2', label: 'Returns and allowances', value: data.line_2_returns_allowances },
      { line: '3', label: 'Net receipts (line 1 - line 2)', value: data.line_3_net_receipts, bold: true },
      { line: '4', label: 'Cost of goods sold', value: data.line_4_cost_of_goods_sold },
      { line: '5', label: 'Gross profit (line 3 - line 4)', value: data.line_5_gross_profit, bold: true, highlight: true },
    ];

    const expenseLines = [
      { line: '8', label: 'Advertising', value: data.line_8_advertising },
      { line: '9', label: 'Car and truck expenses', value: data.line_9_car_truck },
      { line: '10', label: 'Commissions and fees', value: data.line_10_commissions },
      { line: '11', label: 'Contract labor', value: data.line_11_contract_labor },
      { line: '13', label: 'Depreciation', value: data.line_13_depreciation },
      { line: '14', label: 'Employee benefit programs', value: data.line_14_employee_benefits },
      { line: '15', label: 'Insurance (other than health)', value: data.line_15_insurance },
      { line: '16a', label: 'Interest (mortgage)', value: data.line_16a_mortgage_interest },
      { line: '16b', label: 'Interest (other)', value: data.line_16b_other_interest },
      { line: '17', label: 'Legal and professional services', value: data.line_17_legal_professional },
      { line: '18', label: 'Office expense', value: data.line_18_office_expense },
      { line: '20b', label: 'Rent or lease (other)', value: data.line_20b_rent_other },
      { line: '21', label: 'Repairs and maintenance', value: data.line_21_repairs },
      { line: '22', label: 'Supplies', value: data.line_22_supplies },
      { line: '23', label: 'Taxes and licenses', value: data.line_23_taxes_licenses },
      { line: '24a', label: 'Travel', value: data.line_24a_travel },
      { line: '24b', label: 'Deductible meals', value: data.line_24b_meals },
      { line: '25', label: 'Utilities', value: data.line_25_utilities },
      { line: '26', label: 'Wages', value: data.line_26_wages },
      { line: '27a', label: 'Other expenses', value: data.line_27a_other_expenses },
    ].filter(l => l.value > 0);

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>Schedule C Preview — Tax Year {taxYear}</h3>
          <button className="btn btn-primary" onClick={() => handleExport('expenses')}>
            📥 Export CSV
          </button>
        </div>

        <div style={{ 
          background: '#fff3cd', 
          padding: '12px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          fontSize: '0.9rem'
        }}>
          This is a preview for planning purposes only. Consult a tax professional for actual filing.
        </div>

        {/* Part I - Income */}
        <h4 style={{ background: '#e8f5e9', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
          Part I — Income
        </h4>
        <table className="table" style={{ marginBottom: '25px' }}>
          <tbody>
            {incomeLines.map(line => (
              <tr key={line.line} style={{ background: line.highlight ? '#e8f5e9' : 'transparent' }}>
                <td style={{ width: '60px', color: '#666' }}>Line {line.line}</td>
                <td style={{ fontWeight: line.bold ? '600' : 'normal' }}>{line.label}</td>
                <td style={{ textAlign: 'right', fontWeight: line.bold ? '700' : 'normal', width: '150px' }}>
                  {formatCurrency(line.value)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Part II - Expenses */}
        <h4 style={{ background: '#ffebee', padding: '10px', borderRadius: '6px', marginBottom: '15px' }}>
          Part II — Expenses
        </h4>
        <table className="table" style={{ marginBottom: '15px' }}>
          <tbody>
            {expenseLines.map(line => (
              <tr key={line.line}>
                <td style={{ width: '60px', color: '#666' }}>Line {line.line}</td>
                <td>{line.label}</td>
                <td style={{ textAlign: 'right', width: '150px' }}>{formatCurrency(line.value)}</td>
              </tr>
            ))}
            <tr style={{ background: '#ffebee', fontWeight: '600' }}>
              <td>Line 28</td>
              <td>Total expenses</td>
              <td style={{ textAlign: 'right' }}>{formatCurrency(data.line_28_total_expenses)}</td>
            </tr>
          </tbody>
        </table>

        {/* Net Profit */}
        <div style={{ 
          background: data.line_31_net_profit >= 0 ? '#28a745' : '#dc3545',
          color: 'white',
          padding: '20px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', opacity: 0.9 }}>Line 31</div>
            <div style={{ fontSize: '1.2rem', fontWeight: '600' }}>Net profit (or loss)</div>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: '700' }}>
            {formatCurrency(data.line_31_net_profit)}
          </div>
        </div>
      </div>
    );
  };

  // Render Quarterly Estimates
  const renderQuarterly = () => {
    if (!data) return null;
    const { quarters, annual_totals } = data;

    return (
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>📆 Quarterly Tax Estimates — {taxYear}</h3>

        {/* Annual Summary */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
          <div className="metric-card">
            <div className="metric-label">Annual Gross Income</div>
            <div className="metric-value">{formatCurrency(annual_totals?.gross_income)}</div>
          </div>
          <div className="metric-card">
            <div className="metric-label">Annual Expenses</div>
            <div className="metric-value">{formatCurrency(annual_totals?.total_expenses)}</div>
          </div>
          <div className="metric-card" style={{ background: annual_totals?.net_income >= 0 ? '#e8f5e9' : '#ffebee' }}>
            <div className="metric-label">Net Income</div>
            <div className="metric-value" style={{ color: annual_totals?.net_income >= 0 ? '#28a745' : '#dc3545' }}>
              {formatCurrency(annual_totals?.net_income)}
            </div>
          </div>
          <div className="metric-card" style={{ background: '#fff3cd' }}>
            <div className="metric-label">Est. SE Tax</div>
            <div className="metric-value" style={{ color: '#f57c00' }}>
              {formatCurrency(annual_totals?.estimated_se_tax)}
            </div>
          </div>
        </div>

        {/* Quarters */}
        <table className="table">
          <thead>
            <tr>
              <th>Quarter</th>
              <th>Period</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Gross Income</th>
              <th style={{ textAlign: 'right' }}>Expenses</th>
              <th style={{ textAlign: 'right' }}>Net Income</th>
              <th style={{ textAlign: 'right' }}>YTD Net</th>
              <th style={{ textAlign: 'right' }}>Est. SE Tax</th>
            </tr>
          </thead>
          <tbody>
            {quarters?.map(q => {
              const isPast = new Date(q.due_date) < new Date();
              return (
                <tr key={q.quarter} style={{ background: isPast ? '#f8f9fa' : 'transparent' }}>
                  <td style={{ fontWeight: '600' }}>Q{q.quarter}</td>
                  <td>{q.period.start} to {q.period.end}</td>
                  <td>
                    <span style={{ 
                      background: isPast ? '#6c757d' : '#ffc107',
                      color: isPast ? 'white' : '#000',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85rem'
                    }}>
                      {q.due_date}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.gross_income)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.total_expenses)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600', color: q.net_income >= 0 ? '#28a745' : '#dc3545' }}>
                    {formatCurrency(q.net_income)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: '500' }}>{formatCurrency(q.ytd_net_income)}</td>
                  <td style={{ textAlign: 'right', color: '#f57c00' }}>{formatCurrency(q.estimated_se_tax)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong>Tip:</strong> Self-employment tax is 15.3% (12.4% SS + 2.9% Medicare) on 92.35% of net earnings.
          You may also owe income tax on top of this.
        </div>
      </div>
    );
  };

  // Render 1099 Vendors
  const render1099 = () => {
    if (!data) return null;
    const { vendors, threshold, total_amount } = data;

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>📄 1099 Vendor Report — {taxYear}</h3>
          <button className="btn btn-primary" onClick={() => handleExport('1099-vendors')}>
            📥 Export CSV
          </button>
        </div>

        <div style={{ 
          background: '#e3f2fd', 
          padding: '15px', 
          borderRadius: '8px', 
          marginBottom: '20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Vendors paid ≥ ${threshold}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{vendors?.length || 0} vendors</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '0.9rem', color: '#666' }}>Total Amount</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>{formatCurrency(total_amount)}</div>
          </div>
        </div>

        {vendors?.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No vendors paid ${threshold} or more this year.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Vendor Name</th>
                <th>Email</th>
                <th>Phone</th>
                <th style={{ textAlign: 'right' }}>Payments</th>
                <th style={{ textAlign: 'right' }}>Total Paid</th>
                <th>W-9 Status</th>
              </tr>
            </thead>
            <tbody>
              {vendors?.map(v => (
                <tr key={v.id}>
                  <td style={{ fontWeight: '500' }}>{v.name}</td>
                  <td>{v.email || '—'}</td>
                  <td>{v.phone || '—'}</td>
                  <td style={{ textAlign: 'right' }}>{v.payment_count}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(v.total_paid)}</td>
                  <td>
                    <span style={{ 
                      background: v.has_w9 ? '#28a745' : '#dc3545',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {v.has_w9 ? 'On File' : 'Needed'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px', fontSize: '0.9rem' }}>
          <strong>Reminder:</strong> 1099-NEC forms are due to recipients by January 31 and to the IRS by January 31.
          Collect W-9 forms from vendors before making payments.
        </div>
      </div>
    );
  };

  // Render Expense Details
  const renderExpenses = () => {
    if (!data) return null;
    const { by_category, total_deductible } = data;

    return (
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3>🧾 Tax-Deductible Expenses — {taxYear}</h3>
          <button className="btn btn-primary" onClick={() => handleExport('expenses')}>
            📥 Export CSV
          </button>
        </div>

        <div className="metric-card" style={{ marginBottom: '25px', background: '#e8f5e9' }}>
          <div className="metric-label">Total Deductible Expenses</div>
          <div className="metric-value" style={{ color: '#28a745' }}>{formatCurrency(total_deductible)}</div>
        </div>

        {Object.entries(by_category || {}).map(([category, catData]) => (
          <div key={category} style={{ marginBottom: '25px' }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              background: '#f8f9fa',
              padding: '10px 15px',
              borderRadius: '8px 8px 0 0',
              borderBottom: '2px solid #667eea'
            }}>
              <h4 style={{ margin: 0, textTransform: 'capitalize' }}>
                {category.replace(/_/g, ' ')}
              </h4>
              <span style={{ fontWeight: '700', color: '#667eea' }}>
                {formatCurrency(catData.total)}
              </span>
            </div>
            <table className="table" style={{ marginBottom: 0 }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {catData.expenses?.slice(0, 5).map((exp, idx) => (
                  <tr key={idx}>
                    <td>{exp.expense_date}</td>
                    <td>{exp.description}</td>
                    <td>{exp.vendor_name || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
                {catData.expenses?.length > 5 && (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                      ... and {catData.expenses.length - 5} more transactions
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Tax Center</h2>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Tax Year</label>
          <select
            className="form-input"
            value={taxYear}
            onChange={(e) => setTaxYear(parseInt(e.target.value))}
            style={{ width: '120px' }}
          >
            {[0, 1, 2, 3, 4].map(offset => {
              const year = new Date().getFullYear() - offset;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <button
            key={t.id}
            className={`tab-button ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="spinner"></div>
      ) : (
        <>
          {activeTab === 'schedule-c' && renderScheduleC()}
          {activeTab === 'quarterly' && renderQuarterly()}
          {activeTab === '1099' && render1099()}
          {activeTab === 'expenses' && renderExpenses()}
        </>
      )}
    </div>
  );
}

export default TaxCenter;

