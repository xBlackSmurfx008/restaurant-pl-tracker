import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function AccountingDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [payables, setPayables] = useState([]);
  const [receivables, setReceivables] = useState([]);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [agingReport, setAgingReport] = useState(null);
  const [settings, setSettings] = useState({});
  
  // Clear Data Modal
  const [showClearDataModal, setShowClearDataModal] = useState(false);
  const [clearDataConfirmation, setClearDataConfirmation] = useState('');
  const [clearingData, setClearingData] = useState(false);

  // Forms
  const [showPayableForm, setShowPayableForm] = useState(false);
  const [showReceivableForm, setShowReceivableForm] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(null); // { type: 'ap'|'ar', id: number }

  const [vendors, setVendors] = useState([]);

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'payables', label: 'Accounts Payable' },
    { id: 'receivables', label: 'Accounts Receivable' },
    { id: 'bank', label: 'Bank Accounts' },
    { id: 'settings', label: 'Settings' },
  ];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [ap, ar, banks, aging, vendorList, settingsData] = await Promise.all([
        api.getAccountsPayable({ status: '' }),
        api.getAccountsReceivable({ status: '' }),
        api.getBankAccounts(),
        api.getAPAgingReport(),
        api.getVendors(),
        api.getBusinessSettings()
      ]);
      setPayables(ap);
      setReceivables(ar);
      setBankAccounts(banks);
      setAgingReport(aging);
      setVendors(vendorList);
      setSettings(settingsData);
    } catch (error) {
      console.error('Load error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Calculate totals
  const apTotal = payables
    .filter(p => p.status !== 'paid')
    .reduce((s, p) => s + (parseFloat(p.amount) - parseFloat(p.amount_paid || 0)), 0);
  const arTotal = receivables
    .filter(r => r.status !== 'paid')
    .reduce((s, r) => s + (parseFloat(r.amount) - parseFloat(r.amount_received || 0)), 0);
  const bankTotal = bankAccounts.reduce((s, b) => s + parseFloat(b.current_balance || 0), 0);

  // AP Form
  const [apForm, setApForm] = useState({
    vendor_id: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    terms: 'net_30',
    notes: ''
  });

  // AR Form
  const [arForm, setArForm] = useState({
    customer_name: '',
    customer_contact: '',
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    amount: '',
    description: '',
    service_type: 'catering',
    notes: ''
  });

  // Bank Form
  const [bankForm, setBankForm] = useState({
    account_name: '',
    bank_name: '',
    account_type: 'checking',
    account_number_last_four: '',
    opening_balance: '',
    is_primary: false
  });

  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState('');

  // Handle AP Submit
  const handleApSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createAccountPayable(apForm);
      setShowPayableForm(false);
      setApForm({
        vendor_id: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: '',
        terms: 'net_30',
        notes: ''
      });
      loadData();
    } catch (error) {
      alert('Error creating payable: ' + error.message);
    }
  };

  // Handle AR Submit
  const handleArSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createAccountReceivable(arForm);
      setShowReceivableForm(false);
      setArForm({
        customer_name: '',
        customer_contact: '',
        invoice_number: '',
        invoice_date: new Date().toISOString().split('T')[0],
        due_date: '',
        amount: '',
        description: '',
        service_type: 'catering',
        notes: ''
      });
      loadData();
    } catch (error) {
      alert('Error creating receivable: ' + error.message);
    }
  };

  // Handle Bank Submit
  const handleBankSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createBankAccount(bankForm);
      setShowBankForm(false);
      setBankForm({
        account_name: '',
        bank_name: '',
        account_type: 'checking',
        account_number_last_four: '',
        opening_balance: '',
        is_primary: false
      });
      loadData();
    } catch (error) {
      alert('Error creating bank account: ' + error.message);
    }
  };

  // Handle Payment
  const handlePayment = async () => {
    if (!paymentAmount || !showPaymentForm) return;
    try {
      if (showPaymentForm.type === 'ap') {
        await api.recordAPPayment(showPaymentForm.id, { amount: parseFloat(paymentAmount) });
      } else {
        await api.recordARPayment(showPaymentForm.id, { amount: parseFloat(paymentAmount) });
      }
      setShowPaymentForm(null);
      setPaymentAmount('');
      loadData();
    } catch (error) {
      alert('Error recording payment: ' + error.message);
    }
  };

  // Handle Settings Update
  const handleSettingUpdate = async (key, value) => {
    try {
      await api.updateBusinessSetting(key, value);
      setSettings({ ...settings, [key]: value });
    } catch (error) {
      alert('Error updating setting: ' + error.message);
    }
  };

  // Handle Clear All Data
  const handleClearAllData = async () => {
    if (clearDataConfirmation !== 'DELETE ALL DATA') {
      alert('Please type "DELETE ALL DATA" exactly to confirm.');
      return;
    }
    
    setClearingData(true);
    try {
      const result = await api.clearAllData();
      alert(`Success! ${result.message}\n\nPreserved: ${result.preserved.join(', ')}`);
      setShowClearDataModal(false);
      setClearDataConfirmation('');
      loadData(); // Reload to show empty state
    } catch (error) {
      alert('Error clearing data: ' + error.message);
    } finally {
      setClearingData(false);
    }
  };

  // Render Overview
  const renderOverview = () => (
    <div>
      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px', marginBottom: '25px' }}>
        <div className="metric-card" style={{ background: '#e8f5e9' }}>
          <div className="metric-label">Bank Balance</div>
          <div className="metric-value" style={{ color: '#28a745' }}>{formatCurrency(bankTotal)}</div>
        </div>
        <div className="metric-card" style={{ background: '#ffebee' }}>
          <div className="metric-label">Accounts Payable</div>
          <div className="metric-value" style={{ color: '#dc3545' }}>{formatCurrency(apTotal)}</div>
        </div>
        <div className="metric-card" style={{ background: '#e3f2fd' }}>
          <div className="metric-label">Accounts Receivable</div>
          <div className="metric-value" style={{ color: '#1976d2' }}>{formatCurrency(arTotal)}</div>
        </div>
        <div className="metric-card" style={{ 
          background: (bankTotal - apTotal + arTotal) >= 0 ? '#e8f5e9' : '#ffebee'
        }}>
          <div className="metric-label">Net Position</div>
          <div className="metric-value" style={{ 
            color: (bankTotal - apTotal + arTotal) >= 0 ? '#28a745' : '#dc3545'
          }}>
            {formatCurrency(bankTotal - apTotal + arTotal)}
          </div>
        </div>
      </div>

      {/* AP Aging */}
      {agingReport && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h4 style={{ marginBottom: '15px' }}>AP Aging Summary</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px' }}>
            <div className="metric-card" style={{ padding: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>Current</div>
              <div style={{ fontWeight: '600', color: '#28a745' }}>{formatCurrency(agingReport.totals?.current)}</div>
            </div>
            <div className="metric-card" style={{ padding: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>1-30 Days</div>
              <div style={{ fontWeight: '600', color: '#ffc107' }}>{formatCurrency(agingReport.totals?.days_1_30)}</div>
            </div>
            <div className="metric-card" style={{ padding: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>31-60 Days</div>
              <div style={{ fontWeight: '600', color: '#f57c00' }}>{formatCurrency(agingReport.totals?.days_31_60)}</div>
            </div>
            <div className="metric-card" style={{ padding: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>61-90 Days</div>
              <div style={{ fontWeight: '600', color: '#e64a19' }}>{formatCurrency(agingReport.totals?.days_61_90)}</div>
            </div>
            <div className="metric-card" style={{ padding: '10px' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>90+ Days</div>
              <div style={{ fontWeight: '600', color: '#dc3545' }}>{formatCurrency(agingReport.totals?.over_90)}</div>
            </div>
            <div className="metric-card" style={{ padding: '10px', background: '#f8f9fa' }}>
              <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Due</div>
              <div style={{ fontWeight: '700' }}>{formatCurrency(agingReport.totals?.total)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Bank Accounts */}
      <div className="card">
        <h4 style={{ marginBottom: '15px' }}>Bank Accounts</h4>
        {bankAccounts.length === 0 ? (
          <p style={{ color: '#666' }}>No bank accounts configured.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '15px' }}>
            {bankAccounts.map(bank => (
              <div key={bank.id} style={{ 
                background: '#f8f9fa', 
                padding: '15px', 
                borderRadius: '8px',
                border: bank.is_primary ? '2px solid #667eea' : '1px solid #ddd'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{bank.account_name}</div>
                    <div style={{ fontSize: '0.85rem', color: '#666' }}>
                      {bank.bank_name} • ****{bank.account_number_last_four}
                    </div>
                  </div>
                  {bank.is_primary && (
                    <span style={{ 
                      background: '#667eea', 
                      color: 'white', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.75rem'
                    }}>
                      Primary
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700', marginTop: '10px', color: parseFloat(bank.current_balance) >= 0 ? '#28a745' : '#dc3545' }}>
                  {formatCurrency(bank.current_balance)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // Render Payables
  const renderPayables = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Accounts Payable</h3>
        <button className="btn btn-primary" onClick={() => setShowPayableForm(true)}>
          + Add Payable
        </button>
      </div>

      {payables.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No accounts payable.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Vendor</th>
              <th>Invoice #</th>
              <th>Invoice Date</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Paid</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {payables.map(ap => {
              const balance = parseFloat(ap.amount) - parseFloat(ap.amount_paid || 0);
              const isOverdue = new Date(ap.due_date) < new Date() && ap.status !== 'paid';
              return (
                <tr key={ap.id} style={{ background: isOverdue ? '#ffebee' : 'transparent' }}>
                  <td style={{ fontWeight: '500' }}>{ap.vendor_name}</td>
                  <td>{ap.invoice_number || '—'}</td>
                  <td>{ap.invoice_date}</td>
                  <td style={{ color: isOverdue ? '#dc3545' : 'inherit' }}>
                    {ap.due_date}
                    {isOverdue && ' (Overdue)'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(ap.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(ap.amount_paid)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(balance)}</td>
                  <td>
                    <span style={{ 
                      background: ap.status === 'paid' ? '#28a745' : ap.status === 'partial' ? '#ffc107' : isOverdue ? '#dc3545' : '#17a2b8',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {ap.status}
                    </span>
                  </td>
                  <td>
                    {ap.status !== 'paid' && (
                      <button 
                        className="btn btn-success" 
                        style={{ padding: '4px 10px' }}
                        onClick={() => { setShowPaymentForm({ type: 'ap', id: ap.id }); setPaymentAmount(balance.toString()); }}
                      >
                        Pay
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  // Render Receivables
  const renderReceivables = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>📥 Accounts Receivable</h3>
        <button className="btn btn-primary" onClick={() => setShowReceivableForm(true)}>
          + Add Receivable
        </button>
      </div>

      {receivables.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No accounts receivable.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Type</th>
              <th>Invoice #</th>
              <th>Due Date</th>
              <th style={{ textAlign: 'right' }}>Amount</th>
              <th style={{ textAlign: 'right' }}>Received</th>
              <th style={{ textAlign: 'right' }}>Balance</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {receivables.map(ar => {
              const balance = parseFloat(ar.amount) - parseFloat(ar.amount_received || 0);
              const isOverdue = new Date(ar.due_date) < new Date() && ar.status !== 'paid';
              return (
                <tr key={ar.id} style={{ background: isOverdue ? '#fff3cd' : 'transparent' }}>
                  <td style={{ fontWeight: '500' }}>{ar.customer_name}</td>
                  <td>
                    <span style={{ 
                      background: '#e3f2fd', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {ar.service_type}
                    </span>
                  </td>
                  <td>{ar.invoice_number || '—'}</td>
                  <td style={{ color: isOverdue ? '#f57c00' : 'inherit' }}>
                    {ar.due_date}
                    {isOverdue && ' (Overdue)'}
                  </td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(ar.amount)}</td>
                  <td style={{ textAlign: 'right' }}>{formatCurrency(ar.amount_received)}</td>
                  <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(balance)}</td>
                  <td>
                    <span style={{ 
                      background: ar.status === 'paid' ? '#28a745' : ar.status === 'partial' ? '#ffc107' : '#17a2b8',
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.8rem'
                    }}>
                      {ar.status}
                    </span>
                  </td>
                  <td>
                    {ar.status !== 'paid' && (
                      <button 
                        className="btn btn-success" 
                        style={{ padding: '4px 10px' }}
                        onClick={() => { setShowPaymentForm({ type: 'ar', id: ar.id }); setPaymentAmount(balance.toString()); }}
                      >
                        Receive
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );

  // Render Bank Accounts
  const renderBank = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Bank Accounts</h3>
        <button className="btn btn-primary" onClick={() => setShowBankForm(true)}>
          + Add Account
        </button>
      </div>

      {bankAccounts.length === 0 ? (
        <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>No bank accounts. Add one to track your cash flow.</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Account Name</th>
              <th>Bank</th>
              <th>Type</th>
              <th>Last 4</th>
              <th style={{ textAlign: 'right' }}>Opening Balance</th>
              <th style={{ textAlign: 'right' }}>Current Balance</th>
              <th>Primary</th>
            </tr>
          </thead>
          <tbody>
            {bankAccounts.map(bank => (
              <tr key={bank.id}>
                <td style={{ fontWeight: '500' }}>{bank.account_name}</td>
                <td>{bank.bank_name || '—'}</td>
                <td style={{ textTransform: 'capitalize' }}>{bank.account_type}</td>
                <td>****{bank.account_number_last_four}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(bank.opening_balance)}</td>
                <td style={{ textAlign: 'right', fontWeight: '600', color: parseFloat(bank.current_balance) >= 0 ? '#28a745' : '#dc3545' }}>
                  {formatCurrency(bank.current_balance)}
                </td>
                <td>
                  {bank.is_primary && (
                    <span style={{ color: '#667eea' }}>✓</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Render Settings
  const renderSettings = () => (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: '20px' }}>Business Settings</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div className="form-group">
            <label className="form-label">Business Name</label>
            <input
              type="text"
              className="form-input"
              value={settings.business_name || ''}
              onChange={(e) => handleSettingUpdate('business_name', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Tax ID (EIN)</label>
            <input
              type="text"
              className="form-input"
              value={settings.tax_id || ''}
              onChange={(e) => handleSettingUpdate('tax_id', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Target Food Cost %</label>
            <input
              type="number"
              className="form-input"
              value={settings.target_food_cost_percent || '30'}
              onChange={(e) => handleSettingUpdate('target_food_cost_percent', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Target Labor Cost %</label>
            <input
              type="number"
              className="form-input"
              value={settings.target_labor_cost_percent || '30'}
              onChange={(e) => handleSettingUpdate('target_labor_cost_percent', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Default Hourly Wage</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={settings.default_hourly_wage || '15.00'}
              onChange={(e) => handleSettingUpdate('default_hourly_wage', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Sales Tax Rate %</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              value={settings.sales_tax_rate || '0'}
              onChange={(e) => handleSettingUpdate('sales_tax_rate', e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Danger Zone - Clear All Data */}
      <div className="card" style={{ marginTop: '30px', border: '2px solid #dc3545' }}>
        <h3 style={{ marginBottom: '15px', color: '#dc3545' }}>Danger Zone</h3>
        
        <div style={{ 
          background: '#fff5f5', 
          padding: '20px', 
          borderRadius: '8px',
          marginBottom: '15px'
        }}>
          <h4 style={{ marginBottom: '10px', color: '#c82333' }}>Clear All Data</h4>
          <p style={{ marginBottom: '15px', color: '#721c24', fontSize: '0.9rem' }}>
            This will permanently delete all transactional data including:
          </p>
          <ul style={{ 
            marginBottom: '15px', 
            paddingLeft: '20px', 
            color: '#721c24',
            fontSize: '0.85rem',
            lineHeight: '1.8'
          }}>
            <li>All sales records</li>
            <li>All expenses and receipts</li>
            <li>All employees and payroll records</li>
            <li>All accounts payable and receivable</li>
            <li>All bank accounts and transactions</li>
            <li>All journal entries</li>
            <li>All inventory movements</li>
            <li>All POS data and labor records</li>
          </ul>
          <p style={{ marginBottom: '15px', color: '#155724', fontSize: '0.9rem', fontWeight: '600' }}>
            ✓ Your menu items, ingredients, recipes, and vendors will be preserved.
          </p>
          <button
            className="btn"
            style={{ 
              background: '#dc3545', 
              color: 'white',
              padding: '10px 20px',
              fontWeight: '600'
            }}
            onClick={() => setShowClearDataModal(true)}
          >
            Clear All Data & Start Fresh
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Accounting</h2>
      </div>

      {/* Tabs */}
      <div className="sub-tab-container">
        {tabs.map(t => (
          <button
            key={t.id}
            className={`sub-tab ${activeTab === t.id ? 'active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'overview' && renderOverview()}
      {activeTab === 'payables' && renderPayables()}
      {activeTab === 'receivables' && renderReceivables()}
      {activeTab === 'bank' && renderBank()}
      {activeTab === 'settings' && renderSettings()}

      {/* AP Form Modal */}
      {showPayableForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add Accounts Payable</h3>
            <form onSubmit={handleApSubmit}>
              <div className="form-group">
                <label className="form-label">Vendor *</label>
                <select
                  className="form-input"
                  value={apForm.vendor_id}
                  onChange={(e) => setApForm({ ...apForm, vendor_id: e.target.value })}
                  required
                >
                  <option value="">Select vendor...</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Invoice #</label>
                  <input
                    type="text"
                    className="form-input"
                    value={apForm.invoice_number}
                    onChange={(e) => setApForm({ ...apForm, invoice_number: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={apForm.amount}
                    onChange={(e) => setApForm({ ...apForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Invoice Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={apForm.invoice_date}
                    onChange={(e) => setApForm({ ...apForm, invoice_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={apForm.due_date}
                    onChange={(e) => setApForm({ ...apForm, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPayableForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* AR Form Modal */}
      {showReceivableForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add Accounts Receivable</h3>
            <form onSubmit={handleArSubmit}>
              <div className="form-group">
                <label className="form-label">Customer Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={arForm.customer_name}
                  onChange={(e) => setArForm({ ...arForm, customer_name: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Service Type</label>
                  <select
                    className="form-input"
                    value={arForm.service_type}
                    onChange={(e) => setArForm({ ...arForm, service_type: e.target.value })}
                  >
                    <option value="catering">Catering</option>
                    <option value="private_event">Private Event</option>
                    <option value="gift_card">Gift Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Amount *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={arForm.amount}
                    onChange={(e) => setArForm({ ...arForm, amount: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Invoice Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={arForm.invoice_date}
                    onChange={(e) => setArForm({ ...arForm, invoice_date: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date *</label>
                  <input
                    type="date"
                    className="form-input"
                    value={arForm.due_date}
                    onChange={(e) => setArForm({ ...arForm, due_date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowReceivableForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bank Form Modal */}
      {showBankForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '400px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add Bank Account</h3>
            <form onSubmit={handleBankSubmit}>
              <div className="form-group">
                <label className="form-label">Account Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={bankForm.account_name}
                  onChange={(e) => setBankForm({ ...bankForm, account_name: e.target.value })}
                  placeholder="e.g., Business Checking"
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Bank Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={bankForm.bank_name}
                    onChange={(e) => setBankForm({ ...bankForm, bank_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Account Type</label>
                  <select
                    className="form-input"
                    value={bankForm.account_type}
                    onChange={(e) => setBankForm({ ...bankForm, account_type: e.target.value })}
                  >
                    <option value="checking">Checking</option>
                    <option value="savings">Savings</option>
                    <option value="credit_card">Credit Card</option>
                    <option value="petty_cash">Petty Cash</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Last 4 Digits</label>
                  <input
                    type="text"
                    className="form-input"
                    maxLength="4"
                    value={bankForm.account_number_last_four}
                    onChange={(e) => setBankForm({ ...bankForm, account_number_last_four: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Opening Balance</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={bankForm.opening_balance}
                    onChange={(e) => setBankForm({ ...bankForm, opening_balance: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowBankForm(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">Add</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentForm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '300px' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {showPaymentForm.type === 'ap' ? 'Record Payment' : 'Record Receipt'}
            </h3>
            <div className="form-group">
              <label className="form-label">Amount</label>
              <input
                type="number"
                step="0.01"
                className="form-input"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowPaymentForm(null)}>
                Cancel
              </button>
              <button className="btn btn-success" onClick={handlePayment}>
                {showPaymentForm.type === 'ap' ? 'Pay' : 'Receive'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear All Data Confirmation Modal */}
      {showClearDataModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', border: '3px solid #dc3545' }}>
            <h3 style={{ marginBottom: '20px', color: '#dc3545' }}>
              Confirm Data Deletion
            </h3>
            
            <div style={{ 
              background: '#fff5f5', 
              padding: '15px', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <p style={{ fontWeight: '600', color: '#721c24', marginBottom: '10px' }}>
                This action cannot be undone!
              </p>
              <p style={{ color: '#721c24', fontSize: '0.9rem' }}>
                All sales, expenses, payroll, accounting entries, and other transactional data will be permanently deleted. 
                Only your menu items, ingredients, recipes, and vendors will be preserved.
              </p>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ fontWeight: '600' }}>
                Type <span style={{ color: '#dc3545', fontFamily: 'monospace' }}>DELETE ALL DATA</span> to confirm:
              </label>
              <input
                type="text"
                className="form-input"
                placeholder="Type here to confirm..."
                value={clearDataConfirmation}
                onChange={(e) => setClearDataConfirmation(e.target.value)}
                style={{ 
                  border: clearDataConfirmation === 'DELETE ALL DATA' ? '2px solid #28a745' : '1px solid #ddd'
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setShowClearDataModal(false);
                  setClearDataConfirmation('');
                }}
                disabled={clearingData}
              >
                Cancel
              </button>
              <button 
                className="btn"
                style={{ 
                  background: clearDataConfirmation === 'DELETE ALL DATA' ? '#dc3545' : '#ccc',
                  color: 'white',
                  cursor: clearDataConfirmation === 'DELETE ALL DATA' ? 'pointer' : 'not-allowed'
                }}
                onClick={handleClearAllData}
                disabled={clearDataConfirmation !== 'DELETE ALL DATA' || clearingData}
              >
                {clearingData ? 'Clearing...' : 'Clear All Data'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AccountingDashboard;
