import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  const [pendingFiles, setPendingFiles] = useState([]); // Files to upload with new expense
  const [dragActive, setDragActive] = useState(false);
  const quickUploadRef = useRef(null);

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
      let expenseId;
      let vendorId = formData.vendor_id;
      
      if (editingExpense) {
        await api.updateExpense(editingExpense.id, formData);
        expenseId = editingExpense.id;
      } else {
        const result = await api.createExpense(formData);
        expenseId = result.id;
      }
      
      // Upload any pending files
      if (pendingFiles.length > 0 && expenseId) {
        setUploading(true);
        try {
          for (let i = 0; i < pendingFiles.length; i++) {
            setUploadProgress(`Uploading ${i + 1}/${pendingFiles.length}: ${pendingFiles[i].name}`);
            await api.uploadFile(pendingFiles[i], expenseId, vendorId);
          }
        } catch (uploadError) {
          alert('Expense saved but some files failed to upload: ' + uploadError.message);
        } finally {
          setUploading(false);
          setUploadProgress('');
        }
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
    setPendingFiles([]);
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

  // File upload for existing expense
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

  // Handle pending files for new expense
  const handlePendingFiles = (files) => {
    const fileArray = Array.from(files);
    const validFiles = fileArray.filter(f => 
      f.type.includes('pdf') || f.type.includes('image')
    );
    if (validFiles.length > 0) {
      setPendingFiles(prev => [...prev, ...validFiles]);
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e, forExpense = null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files.length) {
      if (forExpense) {
        // Upload directly to expense
        uploadFilesToExpense(files, forExpense);
      } else {
        // Add to pending files
        handlePendingFiles(files);
      }
    }
  };

  // Upload files directly to an expense
  const uploadFilesToExpense = async (files, expense) => {
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        setUploadProgress(`Uploading ${i + 1}/${files.length}: ${files[i].name}`);
        await api.uploadFile(files[i], expense.id, expense.vendor_id);
      }
      setUploadProgress('');
      if (selectedExpense?.id === expense.id) {
        loadExpenseDetails(expense.id);
      }
      loadData();
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Remove pending file
  const removePendingFile = (index) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  // Quick upload handler - creates expense and attaches files
  const handleQuickUpload = async (files) => {
    if (!files.length) return;
    
    // Open the form with files ready
    setShowForm(true);
    handlePendingFiles(files);
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
        <div style={{ display: 'flex', gap: '12px' }}>
          {uploadConfigured && (
            <label 
              className="btn btn-secondary" 
              style={{ 
                cursor: 'pointer', 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                background: '#2D6B4F',
                border: '2px dashed #4CAF50',
              }}
            >
              📄 Upload Receipt/Invoice
              <input
                type="file"
                ref={quickUploadRef}
                multiple
                accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files.length) {
                    handleQuickUpload(e.target.files);
                    e.target.value = '';
                  }
                }}
              />
            </label>
          )}
          <button className="btn btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
            + Add Expense
          </button>
        </div>
      </div>
      
      {/* Upload Progress Banner */}
      {uploading && (
        <div style={{
          background: 'linear-gradient(135deg, #E3F2FD 0%, #BBDEFB 100%)',
          border: '2px solid #2196F3',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          animation: 'pulse 1.5s infinite'
        }}>
          <div className="spinner" style={{ width: '24px', height: '24px', margin: 0 }}></div>
          <div>
            <strong style={{ color: '#1565C0' }}>Uploading Documents...</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#1976D2' }}>
              {uploadProgress || 'Please wait...'}
            </p>
          </div>
        </div>
      )}
      
      {/* Upload Status Banner */}
      {!uploadConfigured && (
        <div style={{
          background: 'linear-gradient(135deg, #FFF3E0 0%, #FFE0B2 100%)',
          border: '1px solid #FF9800',
          borderRadius: '8px',
          padding: '16px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.5rem' }}>⚠️</span>
          <div>
            <strong style={{ color: '#E65100' }}>Document Upload Not Configured</strong>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.9rem', color: '#BF360C' }}>
              Contact your administrator to enable PDF/receipt uploads via Supabase storage.
            </p>
          </div>
        </div>
      )}

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
                  <th>📎 Receipts</th>
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
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {expense.document_count > 0 ? (
                          <span style={{ 
                            background: '#e3f2fd', 
                            padding: '4px 10px', 
                            borderRadius: '12px',
                            fontSize: '0.85rem',
                            fontWeight: '500'
                          }}>
                            📎 {expense.document_count}
                          </span>
                        ) : (
                          <span style={{ color: '#ccc', fontSize: '0.85rem' }}>—</span>
                        )}
                        {uploadConfigured && (
                          <label style={{ 
                            cursor: 'pointer',
                            background: '#E8F5E9',
                            border: '1px solid #4CAF50',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            color: '#2E7D32',
                            fontWeight: '500',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}>
                            📤
                            <input
                              type="file"
                              multiple
                              accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                              style={{ display: 'none' }}
                              onChange={(e) => {
                                if (e.target.files.length) {
                                  uploadFilesToExpense(e.target.files, expense);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </label>
                        )}
                      </div>
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

            {/* Documents Section - Made More Prominent */}
            <div style={{ 
              marginBottom: '20px',
              background: 'linear-gradient(135deg, #f8f9fa 0%, #e8f5e9 100%)',
              borderRadius: '12px',
              padding: '16px',
              border: '2px solid #c8e6c9'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.3rem' }}>📎</span> 
                  Documents ({documents.length})
                </h4>
                {uploadConfigured ? (
                  <label 
                    className="btn btn-primary" 
                    style={{ 
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '10px 18px',
                      fontSize: '0.95rem'
                    }}
                  >
                    {uploading ? (
                      <>{uploadProgress}</>
                    ) : (
                      <>📤 Upload PDF/Image</>
                    )}
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
                  <span style={{ 
                    color: '#f57c00', 
                    fontSize: '0.85rem',
                    background: '#fff3e0',
                    padding: '6px 12px',
                    borderRadius: '4px'
                  }}>
                    ⚠️ Uploads not configured
                  </span>
                )}
              </div>
              
              {/* Drop Zone for existing expense */}
              {uploadConfigured && (
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={(e) => handleDrop(e, selectedExpense)}
                  style={{
                    border: dragActive ? '2px solid #4CAF50' : '2px dashed #9AC636',
                    borderRadius: '8px',
                    padding: '16px',
                    marginBottom: '12px',
                    background: dragActive ? 'rgba(76, 175, 80, 0.15)' : 'rgba(255,255,255,0.8)',
                    textAlign: 'center',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span style={{ fontSize: '1.2rem' }}>📄</span>
                  <span style={{ marginLeft: '8px', color: '#666' }}>
                    Drop files here to attach to this expense
                  </span>
                </div>
              )}
              
              {documents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {documents.map((doc) => (
                    <div 
                      key={doc.id} 
                      style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center',
                        background: 'white',
                        padding: '12px 16px',
                        borderRadius: '8px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                      }}
                    >
                      <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ 
                          fontSize: '1.5rem',
                          width: '40px',
                          height: '40px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: doc.mime_type?.includes('pdf') ? '#FFEBEE' : '#E3F2FD',
                          borderRadius: '8px'
                        }}>
                          {doc.mime_type?.includes('pdf') ? '📄' : '🖼️'}
                        </span>
                        <div>
                          <div style={{ fontWeight: '500' }}>{doc.original_filename}</div>
                          <div style={{ color: '#999', fontSize: '0.8rem' }}>
                            {Math.round((doc.size_bytes || 0) / 1024)} KB
                          </div>
                        </div>
                      </span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '8px 14px' }}
                          onClick={() => handleDownload(doc)}
                        >
                          ⬇️ View
                        </button>
                        <button 
                          className="btn btn-danger" 
                          style={{ padding: '8px 12px' }}
                          onClick={() => handleDeleteDocument(doc.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '20px',
                  color: '#666',
                  background: 'rgba(255,255,255,0.6)',
                  borderRadius: '8px'
                }}>
                  <div style={{ fontSize: '2rem', marginBottom: '8px', opacity: 0.5 }}>📎</div>
                  <p style={{ margin: 0, fontSize: '0.95rem' }}>No documents attached yet</p>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#999' }}>
                    Upload receipts, invoices, or other supporting documents
                  </p>
                </div>
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
          <div className="card" style={{ width: '560px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {editingExpense ? 'Edit Expense' : 'Add Expense'}
            </h3>
            
            {/* Upload Zone - Prominent at the top */}
            {uploadConfigured && (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={(e) => handleDrop(e)}
                style={{
                  border: dragActive ? '3px solid #4CAF50' : '3px dashed #9AC636',
                  borderRadius: '12px',
                  padding: '24px',
                  marginBottom: '24px',
                  background: dragActive ? 'rgba(76, 175, 80, 0.1)' : 'linear-gradient(135deg, rgba(154, 198, 54, 0.08) 0%, rgba(154, 198, 54, 0.15) 100%)',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onClick={() => document.getElementById('form-file-input').click()}
              >
                <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>📄</div>
                <div style={{ 
                  fontSize: '1.1rem', 
                  fontWeight: '600', 
                  color: '#1A1A1A',
                  marginBottom: '4px'
                }}>
                  Drop Receipt or Invoice Here
                </div>
                <div style={{ fontSize: '0.9rem', color: '#666' }}>
                  or <span style={{ color: '#9AC636', fontWeight: '600', textDecoration: 'underline' }}>click to browse</span>
                </div>
                <div style={{ fontSize: '0.8rem', color: '#999', marginTop: '8px' }}>
                  Supports PDF, PNG, JPG, JPEG, GIF, WEBP
                </div>
                <input
                  id="form-file-input"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.gif,.webp"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    handlePendingFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            )}
            
            {/* Pending Files Preview */}
            {pendingFiles.length > 0 && (
              <div style={{
                background: '#E8F5E9',
                border: '1px solid #4CAF50',
                borderRadius: '8px',
                padding: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ fontWeight: '600', marginBottom: '8px', color: '#2E7D32' }}>
                  📎 {pendingFiles.length} file(s) ready to upload
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {pendingFiles.map((file, idx) => (
                    <div key={idx} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      background: 'white',
                      padding: '8px 12px',
                      borderRadius: '4px'
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {file.type.includes('pdf') ? '📄' : '🖼️'}
                        <span style={{ fontSize: '0.9rem' }}>{file.name}</span>
                        <span style={{ fontSize: '0.8rem', color: '#999' }}>
                          ({Math.round(file.size / 1024)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removePendingFile(idx)}
                        style={{
                          background: '#ffebee',
                          border: 'none',
                          borderRadius: '4px',
                          padding: '4px 8px',
                          cursor: 'pointer',
                          color: '#c62828'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
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

