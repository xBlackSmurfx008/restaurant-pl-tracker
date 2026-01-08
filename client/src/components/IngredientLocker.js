import React, { useState, useEffect } from 'react';
import api from '../services/api';

function IngredientLocker() {
  const [ingredients, setIngredients] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState(null);
  const [formData, setFormData] = useState({
    vendor_id: '',
    name: '',
    purchase_price: '',
    purchase_unit: '',
    usage_unit: '',
    unit_conversion_factor: '',
    yield_percent: '1.0',
  });
  const [suggestedConversion, setSuggestedConversion] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [ingredientsData, vendorsData] = await Promise.all([
        api.getIngredients(),
        api.getVendors()
      ]);
      setIngredients(ingredientsData);
      setVendors(vendorsData);
    } catch (error) {
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnitChange = async (purchaseUnit, usageUnit) => {
    if (purchaseUnit && usageUnit && purchaseUnit !== usageUnit) {
      try {
        const suggestion = await api.suggestConversion(purchaseUnit, usageUnit);
        if (suggestion && suggestion.suggested && suggestion.conversion_factor) {
          setSuggestedConversion(suggestion.conversion_factor);
          setFormData({ ...formData, unit_conversion_factor: suggestion.conversion_factor });
        } else {
          setSuggestedConversion(null);
        }
      } catch (error) {
        // Silently fail - user can enter manually
        setSuggestedConversion(null);
      }
    } else {
      setSuggestedConversion(null);
      if (purchaseUnit === usageUnit) {
        setFormData({ ...formData, unit_conversion_factor: '1' });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        purchase_price: parseFloat(formData.purchase_price),
        unit_conversion_factor: parseFloat(formData.unit_conversion_factor),
        yield_percent: parseFloat(formData.yield_percent),
        vendor_id: formData.vendor_id || null,
      };

      if (editingIngredient) {
        await api.updateIngredient(editingIngredient.id, submitData);
      } else {
        await api.createIngredient(submitData);
      }
      setShowModal(false);
      setEditingIngredient(null);
      setFormData({
        vendor_id: '',
        name: '',
        purchase_price: '',
        purchase_unit: '',
        usage_unit: '',
        unit_conversion_factor: '',
        yield_percent: '1.0',
      });
      setSuggestedConversion(null);
      loadData();
    } catch (error) {
      alert('Error saving ingredient: ' + error.message);
    }
  };

  const handleEdit = (ingredient) => {
    setEditingIngredient(ingredient);
    setFormData({
      vendor_id: ingredient.vendor_id || '',
      name: ingredient.name,
      purchase_price: ingredient.purchase_price,
      purchase_unit: ingredient.purchase_unit,
      usage_unit: ingredient.usage_unit,
      unit_conversion_factor: ingredient.unit_conversion_factor,
      yield_percent: ingredient.yield_percent || '1.0',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this ingredient?')) {
      return;
    }
    try {
      await api.deleteIngredient(id);
      loadData();
    } catch (error) {
      alert('Error deleting ingredient: ' + error.message);
    }
  };

  const openNewModal = () => {
    setEditingIngredient(null);
    setFormData({
      vendor_id: '',
      name: '',
      purchase_price: '',
      purchase_unit: '',
      usage_unit: '',
      unit_conversion_factor: '',
      yield_percent: '1.0',
    });
    setSuggestedConversion(null);
    setShowModal(true);
  };

  const calculateCostPerUnit = (ingredient) => {
    if (!ingredient.unit_conversion_factor || !ingredient.yield_percent) return 0;
    const costPerUnit = ingredient.purchase_price / (ingredient.unit_conversion_factor * ingredient.yield_percent);
    return costPerUnit.toFixed(4);
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Ingredient Locker</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          + Add Ingredient
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Vendor</th>
            <th>Purchase Price</th>
            <th>Purchase Unit</th>
            <th>Usage Unit</th>
            <th>Cost/Usage Unit</th>
            <th>Yield %</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {ingredients.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', padding: '40px' }}>
                No ingredients yet. Click "Add Ingredient" to get started.
              </td>
            </tr>
          ) : (
            ingredients.map((ingredient) => (
              <tr key={ingredient.id}>
                <td><strong>{ingredient.name}</strong></td>
                <td>{ingredient.vendor_name || '-'}</td>
                <td>${parseFloat(ingredient.purchase_price).toFixed(2)}</td>
                <td>{ingredient.purchase_unit}</td>
                <td>{ingredient.usage_unit}</td>
                <td>${calculateCostPerUnit(ingredient)}</td>
                <td>{(ingredient.yield_percent * 100).toFixed(1)}%</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEdit(ingredient)}
                    style={{ marginRight: '10px' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(ingredient.id)}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">
                {editingIngredient ? 'Edit Ingredient' : 'Add New Ingredient'}
              </h3>
              <button className="close-button" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Ingredient Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Vendor</label>
                <select
                  className="form-select"
                  value={formData.vendor_id}
                  onChange={(e) => setFormData({ ...formData, vendor_id: e.target.value })}
                >
                  <option value="">Select Vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Price *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Purchase Unit *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.purchase_unit}
                  onChange={(e) => {
                    setFormData({ ...formData, purchase_unit: e.target.value });
                    handleUnitChange(e.target.value, formData.usage_unit);
                  }}
                  placeholder="e.g., lb, oz, gal, each"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Usage Unit *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.usage_unit}
                  onChange={(e) => {
                    setFormData({ ...formData, usage_unit: e.target.value });
                    handleUnitChange(formData.purchase_unit, e.target.value);
                  }}
                  placeholder="e.g., oz, g, fl oz, each"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Unit Conversion Factor *</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  value={formData.unit_conversion_factor}
                  onChange={(e) => setFormData({ ...formData, unit_conversion_factor: e.target.value })}
                  required
                />
                {suggestedConversion && (
                  <small className="helper-text-success">
                    Suggested: {suggestedConversion.toFixed(4)}
                  </small>
                )}
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  How many usage units are in 1 purchase unit? (e.g., 1 lb = 16 oz)
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Yield Percentage</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  className="form-input"
                  value={formData.yield_percent}
                  onChange={(e) => setFormData({ ...formData, yield_percent: e.target.value })}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Percentage of usable product (0.0 to 1.0). Default: 1.0 (100%)
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingIngredient ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default IngredientLocker;
