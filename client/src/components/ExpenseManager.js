import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function ExpenseManager() {
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState({});
  const [vendors, setVendors] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list', 'summary', 'recurring'
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
    expense_type: '',
    category_id: ''
  });

  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    vendor_id: '',
    description: '',
    amount: '',
    payment_method: 'credit_card',
    reference_number: '',
    tax_deductible: true,
    notes: ''
  });

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesData, categoriesData, vendorsData, summaryData] = await Promise.all([
        api.getExpenses({ start: filters.start_date, end: filters.end_date, category_id: filters.category_id }),
        api.getExpenseCategories(),
        api.getVendors(),
        api.getExpenseSummary(filters.start_date, filters.end_date)
      ]);
      
      // Expenses is now an array, not { expenses: [] }
      setExpenses(Array.isArray(expensesData) ? expensesData : expensesData.expenses || []);
      
      // Group categories by expense_type for the dropdown
      const grouped = (categoriesData || []).reduce((acc, cat) => {
        const type = cat.expense_type || 'other';
        if (!acc[type]) acc[type] = [];
        acc[type].push(cat);
        return acc;
      }, {});
      setCategories(grouped);
      
      setVendors(vendorsData || []);
      
      // Convert summary format
      const summaryByType = (summaryData || []).reduce((acc, item) => {
        const type = item.expense_type || 'other';
        if (!acc.summary) acc.summary = [];
        const existing = acc.summary.find(s => s.expense_type === type);
        if (existing) {
          existing.total_amount = parseFloat(existing.total_amount) + parseFloat(item.total_amount);
          existing.transaction_count = (existing.transaction_count || 0) + parseInt(item.expense_count);
        } else {
          acc.summary.push({
            expense_type: type,
            total_amount: parseFloat(item.total_amount),
            transaction_count: parseInt(item.expense_count)
          });
        }
        return acc;
      }, { summary: [] });
      summaryByType.totals = {
        total_amount: summaryByType.summary.reduce((sum, s) => sum + s.total_amount, 0),
        transaction_count: summaryByType.summary.reduce((sum, s) => sum + s.transaction_count, 0)
      };
      setSummary(summaryByType);
    } catch (error) {
      console.error('Error loading data:', error);
      // Don't alert on error, just show empty state
      setExpenses([]);
      setCategories({});
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.createExpense(formData);
      setShowForm(false);
      setFormData({
        expense_date: new Date().toISOString().split('T')[0],
        category_id: '',
        vendor_id: '',
        description: '',
        amount: '',
        payment_method: 'credit_card',
        reference_number: '',
        tax_deductible: true,
        notes: ''
      });
      loadData();
    } catch (error) {
      alert('Error creating expense: ' + error.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      loadData();
    } catch (error) {
      alert('Error deleting expense: ' + error.message);
    }
  };

  const expenseTypes = [
    { value: 'cogs', label: 'Cost of Goods Sold', color: '#dc3545' },
    { value: 'operating', label: 'Operating Expenses', color: '#17a2b8' },
    { value: 'marketing', label: 'Marketing', color: '#ffc107' },
    { value: 'payroll', label: 'Payroll', color: '#28a745' },
    { value: 'other', label: 'Other', color: '#6c757d' }
  ];

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'check', label: 'Check' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'vendor_credit', label: 'Vendor Credit' }
  ];

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Expense Manager</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ Add Expense'}
        </button>
      </div>

      {/* Tabs */}
      <div className="sub-tab-container">
        {['list', 'summary', 'recurring'].map(tab => (
          <button
            key={tab}
            className={`sub-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'list' ? 'All Expenses' : tab === 'summary' ? 'Summary' : 'Recurring'}
          </button>
        ))}
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="metrics-grid" style={{ marginBottom: '20px' }}>
          {expenseTypes.map(type => {
            const typeData = summary.summary?.find(s => s.expense_type === type.value);
            return (
              <div key={type.value} className="metric-card">
                <div className="metric-label">{type.label}</div>
                <div className="metric-value" style={{ color: type.color }}>
                  ${(parseFloat(typeData?.total_amount) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </div>
                <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.7)' }}>
                  {typeData?.transaction_count || 0} transactions
                </div>
              </div>
            );
          })}
          <div className="metric-card">
            <div className="metric-label">Total Expenses</div>
            <div className="metric-value" style={{ color: '#333' }}>
              ${(summary.totals?.total_amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px', padding: '15px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Start Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>End Date</label>
            <input
              type="date"
              className="form-control"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.85rem' }}>Type</label>
            <select
              className="form-control"
              value={filters.expense_type}
              onChange={(e) => setFilters({ ...filters, expense_type: e.target.value })}
            >
              <option value="">All Types</option>
              {expenseTypes.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-secondary" onClick={loadData}>Apply Filters</button>
        </div>
      </div>

      {/* Add Expense Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <h3>Add New Expense</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
              <div className="form-group">
                <label>Date *</label>
                <input
                  type="date"
                  className="form-control"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Category *</label>
                <select
                  className="form-control"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="">Select Category</option>
                  {Object.entries(categories).map(([type, cats]) => (
                    <optgroup key={type} label={expenseTypes.find(t => t.value === type)?.label || type}>
                      {cats.map(cat => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Vendor</label>
                <select
                  className="form-control"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                >
                  <option value="">Select Vendor (optional)</option>
                  {vendors.map(v => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-control"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-group">
                <label>Payment Method</label>
                <select
                  className="form-control"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  {paymentMethods.map(pm => (
                    <option key={pm.value} value={pm.value}>{pm.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Reference #</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Check #, Invoice #, etc."
                />
              </div>
              <div className="form-group" style={{ gridColumn: 'span 2' }}>
                <label>Description *</label>
                <input
                  type="text"
                  className="form-control"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What was this expense for?"
                  required
                />
              </div>
              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <input
                    type="checkbox"
                    checked={formData.tax_deductible}
                    onChange={(e) => setFormData({ ...formData, tax_deductible: e.target.checked })}
                  />
                  Tax Deductible
                </label>
              </div>
            </div>
            <div className="form-group">
              <label>Notes</label>
              <textarea
                className="form-control"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows="2"
                placeholder="Additional notes..."
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
              <button type="submit" className="btn btn-primary">Save Expense</button>
              <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Expenses List */}
      {activeTab === 'list' && (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th>Vendor</th>
                <th>Description</th>
                <th>Amount</th>
                <th>Payment</th>
                <th>Tax</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                    No expenses found for this period. Add your first expense above!
                  </td>
                </tr>
              ) : (
                expenses.map(expense => {
                  const typeInfo = expenseTypes.find(t => t.value === expense.expense_type);
                  return (
                    <tr key={expense.id}>
                      <td>{new Date(expense.expense_date).toLocaleDateString()}</td>
                      <td>
                        <span style={{ color: typeInfo?.color }}>
                          {expense.category_name}
                        </span>
                      </td>
                      <td>{expense.vendor_name || '-'}</td>
                      <td>{expense.description}</td>
                      <td style={{ fontWeight: '600' }}>${parseFloat(expense.amount).toFixed(2)}</td>
                      <td>{expense.payment_method?.replace('_', ' ')}</td>
                      <td>{expense.tax_deductible ? 'Yes' : 'No'}</td>
                      <td>
                        <button
                          className="btn btn-danger"
                          style={{ padding: '4px 8px', fontSize: '0.8rem' }}
                          onClick={() => handleDelete(expense.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary View */}
      {activeTab === 'summary' && summary && (
        <div className="card">
          <h3>Expense Summary by Type</h3>
          <div style={{ marginTop: '20px' }}>
            {summary.summary?.map(item => {
              const typeInfo = expenseTypes.find(t => t.value === item.expense_type);
              const percentage = summary.totals?.total_amount > 0 
                ? (parseFloat(item.total_amount) / summary.totals.total_amount * 100).toFixed(1)
                : 0;
              return (
                <div key={item.expense_type} style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                    <span>{typeInfo?.label || item.expense_type}</span>
                    <span style={{ fontWeight: '600' }}>
                      ${parseFloat(item.total_amount).toLocaleString()} ({percentage}%)
                    </span>
                  </div>
                  <div style={{ 
                    background: '#e0e0e0', 
                    borderRadius: '4px', 
                    height: '20px',
                    overflow: 'hidden'
                  }}>
                    <div style={{
                      background: typeInfo?.color || '#666',
                      width: `${percentage}%`,
                      height: '100%',
                      transition: 'width 0.3s ease'
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseManager;

