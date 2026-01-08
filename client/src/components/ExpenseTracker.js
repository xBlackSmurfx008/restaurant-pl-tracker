import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function ExpenseTracker() {
  // State
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadConfigured, setUploadConfigured] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    start: '',
    end: '',
    vendor_id: '',
    category_id: '',
  });

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [formData, setFormData] = useState({
    expense_date: new Date().toISOString().split('T')[0],
    category_id: '',
    vendor_id: '',
    description: '',
    amount: '',
    payment_method: '',
    reference_number: '',
    notes: '',
  });

  // Detail view
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [lineItems, setLineItems] = useState([]);
  const [documents, setDocuments] = useState([]);
  
  // Upload state
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  // Line item form
  const [showLineItemForm, setShowLineItemForm] = useState(false);
  const [lineItemData, setLineItemData] = useState({
    raw_vendor_code: '',
    raw_description: '',
    quantity: '',
    unit: '',
    unit_price: '',
    line_total: '',
  });

  // Load initial data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [expensesData, categoriesData, vendorsData, uploadStatus] = await Promise.all([
        api.getExpenses(filters),
        api.getExpenseCategories(),
        api.getVendors(),
        api.getUploadStatus(),
      ]);
      setExpenses(expensesData);
      setCategories(categoriesData);
      setVendors(vendorsData);
      setUploadConfigured(uploadStatus.configured);
    } catch (error) {
      console.error('Error loading data:', error);
      alert('Error loading expenses: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Load expense details
  const loadExpenseDetails = async (expenseId) => {
    try {
      const data = await api.getExpense(expenseId);
      setSelectedExpense(data);
      setLineItems(data.line_items || []);
      setDocuments(data.documents || []);
    } catch (error) {
      alert('Error loading expense details: ' + error.message);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, formData);
      } else {
        await api.createExpense(formData);
      }
      setShowForm(false);
      setEditingExpense(null);
      resetForm();
      loadData();
    } catch (error) {
      alert('Error saving expense: ' + error.message);
    }
  };

  const resetForm = () => {
    setFormData({
      expense_date: new Date().toISOString().split('T')[0],
      category_id: '',
      vendor_id: '',
      description: '',
      amount: '',
      payment_method: '',
      reference_number: '',
      notes: '',
    });
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setFormData({
      expense_date: expense.expense_date?.split('T')[0] || '',
      category_id: expense.category_id || '',
      vendor_id: expense.vendor_id || '',
      description: expense.description || '',
      amount: expense.amount || '',
      payment_method: expense.payment_method || '',
      reference_number: expense.reference_number || '',
      notes: expense.notes || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await api.deleteExpense(id);
      if (selectedExpense?.id === id) {
        setSelectedExpense(null);
      }
      loadData();
    } catch (error) {
      alert('Error deleting expense: ' + error.message);
    }
  };

  // File upload
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files.length || !selectedExpense) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${files[i].name}`);
        await api.uploadFile(files[i], selectedExpense.id, selectedExpense.vendor_id);
      }
      setUploadProgress('');
      loadExpenseDetails(selectedExpense.id);
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  // Download document
  const handleDownload = async (doc) => {
    try {
      const data = await api.getDownloadUrl(doc.id);
      window.open(data.download_url, '_blank');
    } catch (error) {
      alert('Error getting download URL: ' + error.message);
    }
  };

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await api.deleteDocument(docId);
      loadExpenseDetails(selectedExpense.id);
    } catch (error) {
      alert('Error deleting document: ' + error.message);
    }
  };

  // Add line item
  const handleAddLineItem = async (e) => {
    e.preventDefault();
    if (!selectedExpense) return;
    try {
      await api.addExpenseLineItems(selectedExpense.id, [lineItemData]);
      setShowLineItemForm(false);
      setLineItemData({
        raw_vendor_code: '',
        raw_description: '',
        quantity: '',
        unit: '',
        unit_price: '',
        line_total: '',
      });
      loadExpenseDetails(selectedExpense.id);
    } catch (error) {
      alert('Error adding line item: ' + error.message);
    }
  };

  // Apply mappings
  const handleApplyMappings = async () => {
    if (!selectedExpense) return;
    try {
      const result = await api.applyMappings(selectedExpense.id);
      alert(`Applied mappings: ${result.applied}/${result.total} line items matched`);
      loadExpenseDetails(selectedExpense.id);
    } catch (error) {
      alert('Error applying mappings: ' + error.message);
    }
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Render
  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      {/* Header */}
      <div className="card-header">
        <h2 className="card-title">💸 Expense Tracker</h2>
        <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Add Expense
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">From</label>
            <input
              type="date"
              className="form-input"
              value={filters.start}
              onChange={(e) => setFilters({ ...filters, start: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">To</label>
            <input
              type="date"
              className="form-input"
              value={filters.end}
              onChange={(e) => setFilters({ ...filters, end: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Vendor</label>
            <select
              className="form-input"
              value={filters.vendor_id}
              onChange={(e) => setFilters({ ...filters, vendor_id: e.target.value })}
            >
              <option value="">All Vendors</option>
              {vendors.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Category</label>
            <select
              className="form-input"
              value={filters.category_id}
              onChange={(e) => setFilters({ ...filters, category_id: e.target.value })}
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <button
            className="btn btn-secondary"
            onClick={() => setFilters({ start: '', end: '', vendor_id: '', category_id: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Main Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: selectedExpense ? '1fr 1fr' : '1fr', gap: '20px' }}>
        
        {/* Expenses List */}
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Expenses ({expenses.length})</h3>
          {expenses.length === 0 ? (
            <p style={{ color: '#666', textAlign: 'center', padding: '40px' }}>
              No expenses found. Add your first expense!
            </p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Docs</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((expense) => (
                  <tr 
                    key={expense.id}
                    style={{ 
                      cursor: 'pointer',
                      background: selectedExpense?.id === expense.id ? '#f0f4ff' : 'transparent'
                    }}
                    onClick={() => loadExpenseDetails(expense.id)}
                  >
                    <td>{expense.expense_date?.split('T')[0]}</td>
                    <td style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {expense.description}
                    </td>
                    <td>{expense.vendor_name || '—'}</td>
                    <td style={{ fontWeight: '600' }}>{formatCurrency(expense.amount)}</td>
                    <td>
                      {expense.document_count > 0 && (
                        <span style={{ 
                          background: '#e3f2fd', 
                          padding: '2px 8px', 
                          borderRadius: '12px',
                          fontSize: '0.85rem'
                        }}>
                          📎 {expense.document_count}
                        </span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <button 
                        className="btn btn-secondary" 
                        style={{ padding: '4px 10px', marginRight: '5px' }}
                        onClick={() => handleEdit(expense)}
                      >
                        Edit
                      </button>
                      <button 
                        className="btn btn-danger" 
                        style={{ padding: '4px 10px' }}
                        onClick={() => handleDelete(expense.id)}
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Expense Detail Panel */}
        {selectedExpense && (
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3>Expense Details</h3>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px' }}
                onClick={() => setSelectedExpense(null)}
              >
                ✕ Close
              </button>
            </div>

            {/* Basic Info */}
            <div style={{ 
              background: '#f8f9fa', 
              padding: '15px', 
              borderRadius: '8px',
              marginBottom: '20px'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><strong>Date:</strong> {selectedExpense.expense_date?.split('T')[0]}</div>
                <div><strong>Amount:</strong> {formatCurrency(selectedExpense.amount)}</div>
                <div><strong>Category:</strong> {selectedExpense.category_name || '—'}</div>
                <div><strong>Vendor:</strong> {selectedExpense.vendor_name || '—'}</div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <strong>Description:</strong> {selectedExpense.description}
                </div>
                {selectedExpense.notes && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>Notes:</strong> {selectedExpense.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Documents Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4>📎 Documents ({documents.length})</h4>
                {uploadConfigured ? (
                  <label className="btn btn-primary" style={{ cursor: 'pointer' }}>
                    {uploading ? uploadProgress : '+ Upload'}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                      style={{ display: 'none' }}
                      onChange={handleFileUpload}
                      disabled={uploading}
                    />
                  </label>
                ) : (
                  <span style={{ color: '#999', fontSize: '0.85rem' }}>
                    Uploads not configured
                  </span>
                )}
              </div>
              {documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: '#f8f9fa',
                        padding: '10px',
                        borderRadius: '6px'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {doc.mime_type?.includes('pdf') ? 'PDF' : 'IMG'}
                        {doc.original_filename}
                        <span style={{ color: '#999', fontSize: '0.8rem' }}>
                          ({Math.round((doc.size_bytes || 0) / 1024)} KB)
                        </span>
                      </span>
                      <div>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', marginRight: '5px' }}
                          onClick={() => handleDownload(doc)}
                        >
                          Download
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '4px 10px' }}
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          ×
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: '#999', fontSize: '0.9rem' }}>No documents attached</p>
              )}
            </div>

            {/* Line Items Section */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4>Line Items ({lineItems.length})</h4>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {lineItems.length > 0 && (
                    <button className="btn btn-secondary" onClick={handleApplyMappings}>
                      Apply Mappings
                    </button>
                  )}
                  <button className="btn btn-primary" onClick={() => setShowLineItemForm(true)}>
                    + Add Item
                  </button>
                </div>
              </div>
              {lineItems.length > 0 ? (
                <table className="table" style={{ fontSize: '0.9rem' }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Description</th>
                      <th>Qty</th>
                      <th>Price</th>
                      <th>Total</th>
                      <th>Mapped</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item) => (
                      <tr key={item.id}>
                        <td style={{ fontFamily: 'monospace' }}>{item.raw_vendor_code || '—'}</td>
                        <td>{item.raw_description}</td>
                        <td>{item.quantity} {item.unit}</td>
                        <td>{formatCurrency(item.unit_price)}</td>
                        <td style={{ fontWeight: '600' }}>{formatCurrency(item.line_total)}</td>
                        <td>
                          {item.ingredient_name || item.mapped_category_name ? (
                            <span style={{ color: '#28a745' }}>✓ {item.ingredient_name || item.mapped_category_name}</span>
                          ) : (
                            <span style={{ color: '#ffc107' }}>!</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ color: '#999', fontSize: '0.9rem' }}>No line items. Add items from your receipt/invoice.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Expense Form Modal */}
      {showForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Category *</label>
                <select
                  className="form-input"
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                  required
                >
                  <option value="">Select category...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select
                  className="form-input"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                >
                  <option value="">Select vendor...</option>
                  {vendors.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Description *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What was this expense for?"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Amount *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Payment Method</label>
                <select
                  className="form-input"
                  value={formData.payment_method}
                  onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                >
                  <option value="">Select...</option>
                  <option value="cash">Cash</option>
                  <option value="check">Check</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="debit_card">Debit Card</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="vendor_credit">Vendor Credit</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Reference # (Invoice/Check)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.reference_number}
                  onChange={(e) => setFormData({ ...formData, reference_number: e.target.value })}
                  placeholder="Invoice or check number"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Additional notes..."
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => { setShowForm(false); setEditingExpense(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingExpense ? 'Save Changes' : 'Add Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Line Item Form Modal */}
      {showLineItemForm && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '450px' }}>
            <h3 style={{ marginBottom: '20px' }}>Add Line Item</h3>
            <form onSubmit={handleAddLineItem}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vendor Code</label>
                  <input
                    type="text"
                    className="form-input"
                    value={lineItemData.raw_vendor_code}
                    onChange={(e) => setLineItemData({ ...lineItemData, raw_vendor_code: e.target.value })}
                    placeholder="SKU/Code"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Description *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={lineItemData.raw_description}
                    onChange={(e) => setLineItemData({ ...lineItemData, raw_description: e.target.value })}
                    placeholder="Item description"
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '15px', marginTop: '15px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Qty</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={lineItemData.quantity}
                    onChange={(e) => setLineItemData({ ...lineItemData, quantity: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unit</label>
                  <input
                    type="text"
                    className="form-input"
                    value={lineItemData.unit}
                    onChange={(e) => setLineItemData({ ...lineItemData, unit: e.target.value })}
                    placeholder="ea, lb"
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Unit Price</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={lineItemData.unit_price}
                    onChange={(e) => setLineItemData({ ...lineItemData, unit_price: e.target.value })}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Line Total</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={lineItemData.line_total}
                    onChange={(e) => setLineItemData({ ...lineItemData, line_total: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => setShowLineItemForm(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseTracker;

