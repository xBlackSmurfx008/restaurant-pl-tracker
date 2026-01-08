import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function TaxPrep() {
  const [scheduleC, setScheduleC] = useState(null);
  const [quarterlyEstimates, setQuarterlyEstimates] = useState(null);
  const [vendors1099, setVendors1099] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('schedule-c');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [scheduleData, quarterlyData, vendorsData] = await Promise.all([
        api.getScheduleC(selectedYear),
        api.getQuarterlyEstimates(selectedYear),
        api.get1099Vendors(selectedYear)
      ]);
      setScheduleC(scheduleData);
      setQuarterlyEstimates(quarterlyData);
      setVendors1099(vendorsData);
    } catch (error) {
      console.error('Error loading tax data:', error);
      alert('Error loading tax data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(parseFloat(value) || 0);
  };

  const downloadCSV = async (type) => {
    try {
      const response = await fetch(`http://localhost:5001/api/tax/export/${selectedYear}/${type}`);
      if (!response.ok) throw new Error('Export failed');
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${selectedYear}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (error) {
      alert('Error downloading file: ' + error.message);
    }
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  const sc = scheduleC?.schedule_c;

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">📋 Tax Preparation</h2>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <label>Tax Year:</label>
          <select
            className="form-control"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            style={{ width: '120px' }}
          >
            {[0, 1, 2, 3].map(offset => {
              const year = new Date().getFullYear() - offset;
              return <option key={year} value={year}>{year}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        {[
          { value: 'schedule-c', label: '📋 Schedule C', icon: '📋' },
          { value: 'quarterly', label: '📅 Quarterly Estimates', icon: '📅' },
          { value: '1099', label: '📄 1099 Vendors', icon: '📄' },
          { value: 'export', label: '⬇️ Export Data', icon: '⬇️' }
        ].map(tab => (
          <button
            key={tab.value}
            className={`tab-button ${activeTab === tab.value ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.value)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Schedule C View */}
      {activeTab === 'schedule-c' && sc && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Schedule C Summary - {selectedYear}</h3>
          
          {/* Key Numbers */}
          <div className="metrics-grid" style={{ marginBottom: '30px' }}>
            <div className="metric-card">
              <div className="metric-label">Gross Receipts (Line 1)</div>
              <div className="metric-value" style={{ color: '#28a745' }}>
                {formatCurrency(sc.line1_gross_receipts)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Expenses (Line 28)</div>
              <div className="metric-value" style={{ color: '#dc3545' }}>
                {formatCurrency(sc.line28_total_expenses)}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Net Profit (Line 31)</div>
              <div className="metric-value" style={{ color: sc.line31_net_profit >= 0 ? '#28a745' : '#dc3545' }}>
                {formatCurrency(sc.line31_net_profit)}
              </div>
            </div>
          </div>

          {/* Part I - Income */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ background: '#e8f5e9', padding: '10px', borderRadius: '4px' }}>
              Part I - Income
            </h4>
            <table className="table">
              <tbody>
                <tr>
                  <td>1. Gross receipts or sales</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line1_gross_receipts)}</td>
                </tr>
                <tr>
                  <td>2. Returns and allowances</td>
                  <td style={{ textAlign: 'right' }}>({formatCurrency(sc.line2_returns_allowances)})</td>
                </tr>
                <tr style={{ fontWeight: '600' }}>
                  <td>3. Net receipts (line 1 minus line 2)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line3_net_receipts)}</td>
                </tr>
                <tr>
                  <td>4. Cost of goods sold</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line4_cost_of_goods_sold)}</td>
                </tr>
                <tr style={{ fontWeight: '600' }}>
                  <td>5. Gross profit (line 3 minus line 4)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line5_gross_profit)}</td>
                </tr>
                <tr>
                  <td>6. Other income</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line6_other_income)}</td>
                </tr>
                <tr style={{ fontWeight: '700', background: '#c8e6c9' }}>
                  <td>7. Gross income (line 5 plus line 6)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line7_gross_income)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Part II - Expenses */}
          <div style={{ marginBottom: '30px' }}>
            <h4 style={{ background: '#ffebee', padding: '10px', borderRadius: '4px' }}>
              Part II - Expenses
            </h4>
            <table className="table">
              <tbody>
                <tr>
                  <td>8. Advertising</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line8_advertising)}</td>
                </tr>
                <tr>
                  <td>9. Car and truck expenses</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line9_car_truck)}</td>
                </tr>
                <tr>
                  <td>10. Commissions and fees</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line10_commissions)}</td>
                </tr>
                <tr>
                  <td>11. Contract labor</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line11_contract_labor)}</td>
                </tr>
                <tr>
                  <td>13. Depreciation</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line13_depreciation)}</td>
                </tr>
                <tr>
                  <td>14. Employee benefit programs</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line14_employee_benefits)}</td>
                </tr>
                <tr>
                  <td>15. Insurance (other than health)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line15_insurance)}</td>
                </tr>
                <tr>
                  <td>16b. Other interest</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line16b_other_interest)}</td>
                </tr>
                <tr>
                  <td>17. Legal and professional services</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line17_legal_professional)}</td>
                </tr>
                <tr>
                  <td>18. Office expense</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line18_office)}</td>
                </tr>
                <tr>
                  <td>20b. Rent - other business property</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line20b_rent_other)}</td>
                </tr>
                <tr>
                  <td>21. Repairs and maintenance</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line21_repairs)}</td>
                </tr>
                <tr>
                  <td>22. Supplies</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line22_supplies)}</td>
                </tr>
                <tr>
                  <td>23. Taxes and licenses</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line23_taxes_licenses)}</td>
                </tr>
                <tr>
                  <td>24a. Travel</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line24a_travel)}</td>
                </tr>
                <tr>
                  <td>24b. Deductible meals (50%)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line24b_meals)}</td>
                </tr>
                <tr>
                  <td>25. Utilities</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line25_utilities)}</td>
                </tr>
                <tr>
                  <td>26. Wages</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line26_wages)}</td>
                </tr>
                <tr>
                  <td>27a. Other expenses</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line27a_other_expenses)}</td>
                </tr>
                <tr style={{ fontWeight: '700', background: '#ffcdd2' }}>
                  <td>28. Total expenses (add lines 8-27a)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line28_total_expenses)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Net Profit */}
          <div style={{ 
            background: sc.line31_net_profit >= 0 ? '#c8e6c9' : '#ffcdd2',
            padding: '20px',
            borderRadius: '8px',
            marginTop: '20px'
          }}>
            <h4 style={{ marginBottom: '15px' }}>Net Profit or Loss</h4>
            <table className="table" style={{ background: 'transparent' }}>
              <tbody>
                <tr>
                  <td>29. Tentative profit (line 7 minus line 28)</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(sc.line29_tentative_profit)}</td>
                </tr>
                <tr>
                  <td>30. Home office deduction</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line30_home_office)}</td>
                </tr>
                <tr style={{ fontWeight: '700', fontSize: '1.2rem' }}>
                  <td>31. Net profit or (loss)</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(sc.line31_net_profit)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
            <strong>⚠️ Important:</strong> This is an estimate based on your entered data. 
            Please consult with a tax professional for accurate tax filing. 
            Some deductions may require additional documentation.
          </div>
        </div>
      )}

      {/* Quarterly Estimates View */}
      {activeTab === 'quarterly' && quarterlyEstimates && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Quarterly Estimated Tax Payments - {selectedYear}</h3>
          
          <table className="table">
            <thead>
              <tr>
                <th>Quarter</th>
                <th>Period</th>
                <th>Due Date</th>
                <th style={{ textAlign: 'right' }}>Revenue</th>
                <th style={{ textAlign: 'right' }}>Expenses</th>
                <th style={{ textAlign: 'right' }}>Net Income</th>
                <th style={{ textAlign: 'right' }}>Est. SE Tax</th>
                <th style={{ textAlign: 'right' }}>Est. Income Tax</th>
                <th style={{ textAlign: 'right', fontWeight: '600' }}>Quarterly Payment</th>
              </tr>
            </thead>
            <tbody>
              {quarterlyEstimates.quarters?.map(q => (
                <tr key={q.quarter}>
                  <td>Q{q.quarter}</td>
                  <td>{q.period.start} to {q.period.end}</td>
                  <td>
                    <span style={{ 
                      color: new Date(q.due_date) < new Date() ? '#dc3545' : '#333'
                    }}>
                      {new Date(q.due_date).toLocaleDateString()}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.revenue)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.expenses + q.payroll)}</td>
                  <td style={{ textAlign: 'right', color: q.net_income >= 0 ? '#28a745' : '#dc3545' }}>
                    {formatCurrency(q.net_income)}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.estimated_se_tax)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(q.estimated_income_tax)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>
                    {formatCurrency(q.estimated_quarterly_payment)}
                  </td>
                </tr>
              ))}
              <tr style={{ fontWeight: '700', background: '#e8f5e9' }}>
                <td colSpan="3">Annual Total</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.revenue)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.expenses + quarterlyEstimates.annual_totals?.payroll)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.net_income)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.estimated_se_tax)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.estimated_income_tax)}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(quarterlyEstimates.annual_totals?.total_estimated_tax)}</td>
              </tr>
            </tbody>
          </table>

          <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px' }}>
            <strong>💡 Note:</strong> These are rough estimates using simplified tax rates. 
            Self-employment tax is calculated at 15.3% on 92.35% of net income. 
            Income tax estimate uses 22% bracket. Your actual rates may vary.
          </div>
        </div>
      )}

      {/* 1099 Vendors View */}
      {activeTab === '1099' && vendors1099 && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>1099-NEC Vendors - {selectedYear}</h3>
          
          <div style={{ marginBottom: '20px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
            <strong>📝 1099-NEC Requirement:</strong> You must file Form 1099-NEC for any vendor 
            (contractors, professionals) to whom you paid $600 or more during the tax year.
          </div>

          {vendors1099.vendors_requiring_1099?.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
              No vendors requiring 1099 forms were found for {selectedYear}.
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Vendor Name</th>
                  <th>Contact</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th style={{ textAlign: 'right' }}>Total Paid</th>
                  <th>1099 Required</th>
                </tr>
              </thead>
              <tbody>
                {vendors1099.vendors_requiring_1099?.map(v => (
                  <tr key={v.id}>
                    <td style={{ fontWeight: '600' }}>{v.name}</td>
                    <td>{v.contact_person || '-'}</td>
                    <td>{v.phone || '-'}</td>
                    <td>{v.email || '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(v.total_paid)}</td>
                    <td>
                      <span style={{ color: '#28a745', fontWeight: '600' }}>✓ Yes</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div style={{ marginTop: '20px' }}>
            <strong>Total 1099s to file:</strong> {vendors1099.total_vendors || 0}
          </div>
        </div>
      )}

      {/* Export View */}
      {activeTab === 'export' && (
        <div className="card">
          <h3 style={{ marginBottom: '20px' }}>Export Tax Data - {selectedYear}</h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>📋 Expenses Report</h4>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                Export all expenses with tax categories for easy import into tax software.
              </p>
              <button className="btn btn-primary" onClick={() => downloadCSV('expenses')}>
                ⬇️ Download Expenses CSV
              </button>
            </div>
            
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>📊 Revenue Report</h4>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                Export daily revenue data including sales breakdown by category.
              </p>
              <button className="btn btn-primary" onClick={() => downloadCSV('revenue')}>
                ⬇️ Download Revenue CSV
              </button>
            </div>
            
            <div style={{ padding: '20px', border: '1px solid #ddd', borderRadius: '8px' }}>
              <h4>👥 Payroll Report</h4>
              <p style={{ color: '#666', marginBottom: '15px' }}>
                Export payroll records with tax withholdings for W-2 preparation.
              </p>
              <button className="btn btn-primary" onClick={() => downloadCSV('payroll')}>
                ⬇️ Download Payroll CSV
              </button>
            </div>
          </div>

          <div style={{ marginTop: '30px', padding: '20px', background: '#e8f5e9', borderRadius: '8px' }}>
            <h4>💡 Tips for Tax Time</h4>
            <ul style={{ marginTop: '10px', paddingLeft: '20px' }}>
              <li>Keep all receipts organized by category matching Schedule C</li>
              <li>Ensure all vendor 1099 information is complete before year-end</li>
              <li>Review expense categorization for accuracy</li>
              <li>Document business use for any mixed-use expenses (vehicle, phone, etc.)</li>
              <li>Keep records for at least 7 years</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaxPrep;

