import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function SalesInput() {
  const [menuItems, setMenuItems] = useState([]);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [sales, setSales] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addSaleForm, setAddSaleForm] = useState({
    menu_item_id: '',
    quantity_sold: '',
  });
  const [adding, setAdding] = useState(false);

  const loadMenuItems = useCallback(async () => {
    try {
      const data = await api.getMenuItems();
      setMenuItems(data);
    } catch (error) {
      alert('Error loading menu items: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSalesForDate = useCallback(async () => {
    try {
      setLoading(true);
      const salesData = await api.getSalesByDate(selectedDate);
      const salesMap = {};
      salesData.forEach((sale) => {
        salesMap[sale.menu_item_id] = sale.quantity_sold;
      });
      setSales(salesMap);
    } catch (error) {
      alert('Error loading sales: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadMenuItems();
  }, [loadMenuItems]);

  useEffect(() => {
    loadSalesForDate();
  }, [loadSalesForDate]);

  const handleQuantityChange = (menuItemId, value) => {
    const numValue = parseInt(value) || 0;
    setSales({ ...sales, [menuItemId]: numValue });
  };

  const handleKeyPress = (e, menuItemId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const nextIndex = menuItems.findIndex(item => item.id === menuItemId) + 1;
      if (nextIndex < menuItems.length) {
        const nextInput = document.getElementById(`qty-${menuItems[nextIndex].id}`);
        if (nextInput) nextInput.focus();
      } else {
        handleSave();
      }
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const salesArray = menuItems.map((item) => ({
        menu_item_id: item.id,
        quantity_sold: sales[item.id] || 0,
      }));

      await api.saveDailySales(selectedDate, salesArray);
      setLastSaved(new Date().toLocaleTimeString());
      loadSalesForDate();
    } catch (error) {
      alert('Error saving sales: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const calculateDailyTotal = () => {
    return menuItems.reduce((total, item) => {
      const qty = sales[item.id] || 0;
      const sellingPrice = parseFloat(item.selling_price) || 0;
      return total + (qty * sellingPrice);
    }, 0);
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleAddSale = async (e) => {
    e.preventDefault();
    if (!addSaleForm.menu_item_id || !addSaleForm.quantity_sold || parseFloat(addSaleForm.quantity_sold) <= 0) {
      alert('Please select a menu item and enter a valid quantity');
      return;
    }

    try {
      setAdding(true);
      await api.addSales(
        selectedDate,
        addSaleForm.menu_item_id,
        parseInt(addSaleForm.quantity_sold)
      );
      
      // Reload sales for the date to show updated quantities
      await loadSalesForDate();
      
      // Reset form and close modal
      setAddSaleForm({ menu_item_id: '', quantity_sold: '' });
      setShowAddModal(false);
    } catch (error) {
      alert('Error adding sales: ' + error.message);
    } finally {
      setAdding(false);
    }
  };

  const openAddModal = () => {
    setAddSaleForm({ menu_item_id: '', quantity_sold: '' });
    setShowAddModal(true);
  };

  if (loading && menuItems.length === 0) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Daily Sales Input</h2>
        <div style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <strong>Date:</strong>
            <input
              type="date"
              className="form-input"
              value={selectedDate}
              onChange={handleDateChange}
              style={{ width: 'auto' }}
            />
          </label>
          <button
            className="btn btn-primary"
            onClick={openAddModal}
            style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
          >
            + Add Sales
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save All Sales'}
          </button>
          {lastSaved && (
            <span style={{ fontSize: '0.9rem', color: '#28a745' }}>
              Saved at {lastSaved}
            </span>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <strong>Total Revenue:</strong>
            <div style={{ fontSize: '1.5rem', color: '#667eea', fontWeight: '600', marginTop: '5px' }}>
              ${calculateDailyTotal().toFixed(2)}
            </div>
          </div>
          <div>
            <strong>Total Items Sold:</strong>
            <div style={{ fontSize: '1.5rem', color: '#667eea', fontWeight: '600', marginTop: '5px' }}>
              {Object.values(sales).reduce((sum, qty) => sum + (qty || 0), 0)}
            </div>
          </div>
        </div>
      </div>

      {menuItems.length === 0 ? (
        <div className="card">
          <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            No menu items found. Create menu items in the Recipes tab first.
          </p>
        </div>
      ) : (
        <div className="card">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Menu Item</th>
                <th style={{ width: '15%' }}>Price</th>
                <th style={{ width: '20%' }}>Quantity Sold</th>
                <th style={{ width: '20%' }}>Subtotal</th>
                <th style={{ width: '15%' }}>Food Cost %</th>
              </tr>
            </thead>
            <tbody>
              {menuItems.map((item, index) => {
                const qty = sales[item.id] || 0;
                const sellingPrice = parseFloat(item.selling_price) || 0;
                const subtotal = qty * sellingPrice;
                return (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.name}</strong>
                    </td>
                    <td>${sellingPrice.toFixed(2)}</td>
                    <td>
                      <input
                        id={`qty-${item.id}`}
                        type="number"
                        min="0"
                        className="form-input"
                        value={qty}
                        onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                        onKeyPress={(e) => handleKeyPress(e, item.id)}
                        style={{ width: '100px', textAlign: 'center' }}
                        autoFocus={index === 0}
                      />
                    </td>
                    <td>
                      <strong>${subtotal.toFixed(2)}</strong>
                    </td>
                    <td>
                      {(item.foodCostPercent !== undefined && item.foodCostPercent !== null) && (
                        <span className={`food-cost-indicator food-cost-${item.foodCostPercent <= 35 ? 'good' : item.foodCostPercent <= 40 ? 'warning' : 'danger'}`}>
                          {parseFloat(item.foodCostPercent).toFixed(1)}%
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr style={{ borderTop: '2px solid #e0e0e0', fontWeight: '600' }}>
                <td colSpan="3" style={{ textAlign: 'right' }}>Total:</td>
                <td>${calculateDailyTotal().toFixed(2)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <div className="card" style={{ marginTop: '20px', backgroundColor: '#f8f9fa' }}>
        <h4 style={{ marginBottom: '10px' }}>Quick Tips</h4>
        <ul style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
          <li>Click "Add Sales" to quickly add individual sales throughout the day</li>
          <li>Use Tab or Enter to quickly move between fields in the table</li>
          <li>Press Enter on the last item to save automatically</li>
          <li>Leave quantity as 0 for items not sold</li>
          <li>Use "Save All Sales" to update all quantities at once</li>
        </ul>
      </div>

      {/* Add Sales Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Sales</h3>
              <button className="close-button" onClick={() => setShowAddModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddSale}>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={selectedDate}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Menu Item *</label>
                <select
                  className="form-select"
                  value={addSaleForm.menu_item_id}
                  onChange={(e) => setAddSaleForm({ ...addSaleForm, menu_item_id: e.target.value })}
                  required
                >
                  <option value="">Select a menu item</option>
                  {menuItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} - ${(parseFloat(item.selling_price) || 0).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity Sold *</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  className="form-input"
                  value={addSaleForm.quantity_sold}
                  onChange={(e) => setAddSaleForm({ ...addSaleForm, quantity_sold: e.target.value })}
                  placeholder="Enter quantity"
                  required
                  autoFocus
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  This will be added to existing sales for this date
                </small>
              </div>
              {addSaleForm.menu_item_id && addSaleForm.quantity_sold && (
                <div className="form-group" style={{ 
                  backgroundColor: '#f8f9fa', 
                  padding: '10px', 
                  borderRadius: '5px',
                  marginBottom: '15px'
                }}>
                  <strong>Subtotal:</strong> ${(
                    parseFloat(addSaleForm.quantity_sold || 0) * 
                    (menuItems.find(m => m.id === parseInt(addSaleForm.menu_item_id))?.selling_price || 0)
                  ).toFixed(2)}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={adding}
                  style={{ backgroundColor: '#28a745', borderColor: '#28a745' }}
                >
                  {adding ? 'Adding...' : 'Add Sales'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default SalesInput;
