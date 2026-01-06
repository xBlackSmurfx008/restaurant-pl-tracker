import React, { useState, useEffect } from 'react';
import api from '../services/api';

function RecipeBuilder() {
  const [menuItems, setMenuItems] = useState([]);
  const [ingredients, setIngredients] = useState([]);
  const [selectedMenuItem, setSelectedMenuItem] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenuItemModal, setShowMenuItemModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [editingMenuItem, setEditingMenuItem] = useState(null);
  const [menuItemForm, setMenuItemForm] = useState({
    name: '',
    selling_price: '',
    q_factor: '0',
    target_cost_percent: '35.0',
    estimated_prep_time_minutes: '0',
  });
  const [recipeForm, setRecipeForm] = useState({
    ingredient_id: '',
    quantity_used: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [menuItemsData, ingredientsData] = await Promise.all([
        api.getMenuItems(),
        api.getIngredients()
      ]);
      setMenuItems(menuItemsData);
      setIngredients(ingredientsData);
    } catch (error) {
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectMenuItem = async (id) => {
    try {
      const menuItem = await api.getMenuItem(id);
      setSelectedMenuItem(menuItem);
    } catch (error) {
      alert('Error loading menu item: ' + error.message);
    }
  };

  const handleCreateMenuItem = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...menuItemForm,
        selling_price: parseFloat(menuItemForm.selling_price),
        q_factor: parseFloat(menuItemForm.q_factor),
        target_cost_percent: parseFloat(menuItemForm.target_cost_percent),
        estimated_prep_time_minutes: parseFloat(menuItemForm.estimated_prep_time_minutes),
      };
      
      if (editingMenuItem) {
        await api.updateMenuItem(editingMenuItem.id, data);
      } else {
        await api.createMenuItem(data);
      }
      
      setShowMenuItemModal(false);
      setEditingMenuItem(null);
      setMenuItemForm({
        name: '',
        selling_price: '',
        q_factor: '0',
        target_cost_percent: '35.0',
        estimated_prep_time_minutes: '0',
      });
      loadData();
      if (selectedMenuItem && editingMenuItem && selectedMenuItem.id === editingMenuItem.id) {
        handleSelectMenuItem(editingMenuItem.id);
      }
    } catch (error) {
      alert('Error saving menu item: ' + error.message);
    }
  };

  const handleEditMenuItem = (menuItem) => {
    setEditingMenuItem(menuItem);
    setMenuItemForm({
      name: menuItem.name,
      selling_price: menuItem.selling_price.toString(),
      q_factor: (menuItem.q_factor || 0).toString(),
      target_cost_percent: (menuItem.target_cost_percent || 35.0).toString(),
      estimated_prep_time_minutes: (menuItem.estimated_prep_time_minutes || 0).toString(),
    });
    setShowMenuItemModal(true);
  };

  const handleAddIngredient = async (e) => {
    e.preventDefault();
    if (!selectedMenuItem) return;
    try {
      await api.addIngredientToRecipe(
        selectedMenuItem.id,
        recipeForm.ingredient_id,
        parseFloat(recipeForm.quantity_used)
      );
      setShowRecipeModal(false);
      setRecipeForm({ ingredient_id: '', quantity_used: '' });
      handleSelectMenuItem(selectedMenuItem.id);
    } catch (error) {
      alert('Error adding ingredient: ' + error.message);
    }
  };

  const handleRemoveIngredient = async (recipeId) => {
    if (!selectedMenuItem) return;
    if (!window.confirm('Remove this ingredient from the recipe?')) {
      return;
    }
    try {
      await api.removeIngredientFromRecipe(selectedMenuItem.id, recipeId);
      handleSelectMenuItem(selectedMenuItem.id);
    } catch (error) {
      alert('Error removing ingredient: ' + error.message);
    }
  };

  const handleDeleteMenuItem = async (id) => {
    if (!window.confirm('Are you sure you want to delete this menu item?')) {
      return;
    }
    try {
      await api.deleteMenuItem(id);
      if (selectedMenuItem && selectedMenuItem.id === id) {
        setSelectedMenuItem(null);
      }
      loadData();
    } catch (error) {
      alert('Error deleting menu item: ' + error.message);
    }
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Recipe Builder</h2>
        <button className="btn btn-primary" onClick={() => setShowMenuItemModal(true)}>
          + Add Menu Item
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '20px', marginTop: '20px' }}>
        {/* Menu Items List */}
        <div className="card">
          <h3 style={{ marginBottom: '15px' }}>Menu Items</h3>
          {menuItems.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
              No menu items yet. Create one to start building recipes.
            </p>
          ) : (
            <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
              {menuItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleSelectMenuItem(item.id)}
                  style={{
                    padding: '15px',
                    marginBottom: '10px',
                    border: selectedMenuItem?.id === item.id ? '2px solid #667eea' : '1px solid #e0e0e0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    backgroundColor: selectedMenuItem?.id === item.id ? '#f0f4ff' : 'white',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                    <div style={{ flex: 1 }}>
                      <strong>{item.name}</strong>
                      <div style={{ fontSize: '0.9rem', color: '#666', marginTop: '5px' }}>
                        ${(item.selling_price !== undefined && item.selling_price !== null) ? parseFloat(item.selling_price).toFixed(2) : '0.00'} | {item.ingredient_count || 0} ingredients
                      </div>
                      {(item.plate_cost !== undefined && item.plate_cost !== null) && (
                        <div style={{ fontSize: '0.85rem', marginTop: '5px' }}>
                          <span className={`food-cost-indicator food-cost-${(item.foodCostPercent || 0) <= 35 ? 'good' : (item.foodCostPercent || 0) <= 40 ? 'warning' : 'danger'}`}>
                            Cost: ${parseFloat(item.plate_cost).toFixed(2)} ({(item.foodCostPercent !== undefined && item.foodCostPercent !== null) ? parseFloat(item.foodCostPercent).toFixed(1) : '0.0'}%)
                          </span>
                        </div>
                      )}
                    </div>
                     <div style={{ display: 'flex', gap: '5px' }}>
                       <button
                         className="btn btn-secondary"
                         style={{ padding: '5px 10px', fontSize: '0.85rem' }}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleEditMenuItem(item);
                         }}
                       >
                         Edit
                       </button>
                       <button
                         className="btn btn-danger"
                         style={{ padding: '5px 10px', fontSize: '0.85rem' }}
                         onClick={(e) => {
                           e.stopPropagation();
                           handleDeleteMenuItem(item.id);
                         }}
                       >
                         Delete
                       </button>
                     </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recipe Details */}
        <div className="card">
          {!selectedMenuItem ? (
            <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
              <p>Select a menu item from the list to view and edit its recipe.</p>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '2px solid #f0f0f0' }}>
                <h3>{selectedMenuItem.name}</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px', marginTop: '15px' }}>
                  <div>
                    <strong>Selling Price:</strong> ${(selectedMenuItem.selling_price !== undefined && selectedMenuItem.selling_price !== null) ? parseFloat(selectedMenuItem.selling_price).toFixed(2) : '0.00'}
                  </div>
                  <div>
                    <strong>Plate Cost (Food):</strong> ${(selectedMenuItem.plate_cost !== undefined && selectedMenuItem.plate_cost !== null) ? parseFloat(selectedMenuItem.plate_cost).toFixed(2) : '0.00'}
                  </div>
                  <div>
                    <strong>Labor Cost:</strong> ${(selectedMenuItem.laborCost !== undefined && selectedMenuItem.laborCost !== null) ? parseFloat(selectedMenuItem.laborCost).toFixed(2) : '0.00'}
                    {selectedMenuItem.estimated_prep_time_minutes > 0 && (
                      <small style={{ color: '#666', display: 'block' }}>
                        ({selectedMenuItem.estimated_prep_time_minutes} min prep)
                      </small>
                    )}
                  </div>
                  <div>
                    <strong>Prime Cost (Food + Labor):</strong> ${(selectedMenuItem.primeCost !== undefined && selectedMenuItem.primeCost !== null) ? parseFloat(selectedMenuItem.primeCost).toFixed(2) : '0.00'}
                  </div>
                  <div>
                    <strong>Gross Profit (Before Labor):</strong> ${(selectedMenuItem.grossProfit !== undefined && selectedMenuItem.grossProfit !== null) ? parseFloat(selectedMenuItem.grossProfit).toFixed(2) : '0.00'}
                  </div>
                  <div>
                    <strong>Net Profit (After Labor):</strong> ${(selectedMenuItem.netProfit !== undefined && selectedMenuItem.netProfit !== null) ? parseFloat(selectedMenuItem.netProfit).toFixed(2) : '0.00'}
                  </div>
                  <div>
                    <strong>Food Cost %:</strong>
                    {(selectedMenuItem.foodCostPercent !== undefined && selectedMenuItem.foodCostPercent !== null) && (
                      <span className={`food-cost-indicator food-cost-${selectedMenuItem.foodCostPercent <= 35 ? 'good' : selectedMenuItem.foodCostPercent <= 40 ? 'warning' : 'danger'}`} style={{ marginLeft: '10px' }}>
                        {parseFloat(selectedMenuItem.foodCostPercent).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div>
                    <strong>Prime Cost %:</strong>
                    {(selectedMenuItem.primeCostPercent !== undefined && selectedMenuItem.primeCostPercent !== null) && (
                      <span className={`food-cost-indicator food-cost-${selectedMenuItem.primeCostPercent <= 60 ? 'good' : selectedMenuItem.primeCostPercent <= 70 ? 'warning' : 'danger'}`} style={{ marginLeft: '10px' }}>
                        {parseFloat(selectedMenuItem.primeCostPercent).toFixed(1)}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <button
                  className="btn btn-primary"
                  onClick={() => setShowRecipeModal(true)}
                >
                  + Add Ingredient to Recipe
                </button>
              </div>

              {selectedMenuItem.recipe && selectedMenuItem.recipe.length > 0 ? (
                <table className="table">
                  <thead>
                    <tr>
                      <th>Ingredient</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Cost/Unit</th>
                      <th>Line Cost</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedMenuItem.recipe.map((recipeItem) => (
                      <tr key={recipeItem.id}>
                        <td>{recipeItem.ingredient_name}</td>
                        <td>{recipeItem.quantity_used}</td>
                        <td>{recipeItem.usage_unit}</td>
                        <td>${(recipeItem.cost_per_unit !== undefined && recipeItem.cost_per_unit !== null) ? parseFloat(recipeItem.cost_per_unit).toFixed(4) : '0.0000'}</td>
                        <td>${(recipeItem.line_cost !== undefined && recipeItem.line_cost !== null) ? parseFloat(recipeItem.line_cost).toFixed(2) : '0.00'}</td>
                        <td>
                          <button
                            className="btn btn-danger"
                            onClick={() => handleRemoveIngredient(recipeItem.id)}
                            style={{ padding: '5px 10px', fontSize: '0.85rem' }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                  No ingredients in recipe yet. Click "Add Ingredient to Recipe" to get started.
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Menu Item Modal */}
      {showMenuItemModal && (
        <div className="modal-overlay" onClick={() => setShowMenuItemModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">{editingMenuItem ? 'Edit Menu Item' : 'Add New Menu Item'}</h3>
              <button className="close-button" onClick={() => {
                setShowMenuItemModal(false);
                setEditingMenuItem(null);
                setMenuItemForm({
                  name: '',
                  selling_price: '',
                  q_factor: '0',
                  target_cost_percent: '35.0',
                  estimated_prep_time_minutes: '0',
                });
              }}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateMenuItem}>
              <div className="form-group">
                <label className="form-label">Menu Item Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={menuItemForm.name}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={menuItemForm.selling_price}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, selling_price: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Q Factor (Flat Fee)</label>
                <input
                  type="number"
                  step="0.01"
                  className="form-input"
                  value={menuItemForm.q_factor}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, q_factor: e.target.value })}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Flat fee for miscellaneous items (e.g., packaging, condiments)
                </small>
              </div>
              <div className="form-group">
                <label className="form-label">Target Food Cost %</label>
                <input
                  type="number"
                  step="0.1"
                  className="form-input"
                  value={menuItemForm.target_cost_percent}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, target_cost_percent: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Estimated Prep Time (Minutes)</label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  className="form-input"
                  value={menuItemForm.estimated_prep_time_minutes}
                  onChange={(e) => setMenuItemForm({ ...menuItemForm, estimated_prep_time_minutes: e.target.value })}
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Estimated time to prepare this item (used for labor cost calculation)
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowMenuItemModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Ingredient Modal */}
      {showRecipeModal && selectedMenuItem && (
        <div className="modal-overlay" onClick={() => setShowRecipeModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">Add Ingredient to {selectedMenuItem.name}</h3>
              <button className="close-button" onClick={() => setShowRecipeModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleAddIngredient}>
              <div className="form-group">
                <label className="form-label">Ingredient *</label>
                <select
                  className="form-select"
                  value={recipeForm.ingredient_id}
                  onChange={(e) => setRecipeForm({ ...recipeForm, ingredient_id: e.target.value })}
                  required
                >
                  <option value="">Select Ingredient</option>
                  {ingredients.map((ingredient) => (
                    <option key={ingredient.id} value={ingredient.id}>
                      {ingredient.name} ({ingredient.usage_unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Quantity Used *</label>
                <input
                  type="number"
                  step="0.0001"
                  className="form-input"
                  value={recipeForm.quantity_used}
                  onChange={(e) => setRecipeForm({ ...recipeForm, quantity_used: e.target.value })}
                  required
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Amount of this ingredient used per plate (in usage unit)
                </small>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowRecipeModal(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Add to Recipe
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default RecipeBuilder;
