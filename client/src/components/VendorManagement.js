import React, { useState, useEffect } from 'react';
import api from '../services/api';

function VendorManagement() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    account_number: '',
    contact_person: '',
    phone: '',
    email: '',
    delivery_days: '',
  });

  useEffect(() => {
    loadVendors();
  }, []);

  const loadVendors = async () => {
    try {
      setLoading(true);
      const data = await api.getVendors();
      setVendors(data);
    } catch (error) {
      alert('Error loading vendors: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingVendor) {
        await api.updateVendor(editingVendor.id, formData);
      } else {
        await api.createVendor(formData);
      }
      setShowModal(false);
      setEditingVendor(null);
      setFormData({ name: '', account_number: '', contact_person: '', phone: '', email: '', delivery_days: '' });
      loadVendors();
    } catch (error) {
      alert('Error saving vendor: ' + error.message);
    }
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setFormData({
      name: vendor.name,
      account_number: vendor.account_number || '',
      contact_person: vendor.contact_person || '',
      phone: vendor.phone || '',
      email: vendor.email || '',
      delivery_days: vendor.delivery_days || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this vendor?')) {
      return;
    }
    try {
      await api.deleteVendor(id);
      loadVendors();
    } catch (error) {
      alert('Error deleting vendor: ' + error.message);
    }
  };

  const openNewModal = () => {
    setEditingVendor(null);
    setFormData({ name: '', account_number: '', contact_person: '', phone: '', email: '', delivery_days: '' });
    setShowModal(true);
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Vendor Management</h2>
        <button className="btn btn-primary" onClick={openNewModal}>
          + Add Vendor
        </button>
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Account Number</th>
            <th>Contact Person</th>
            <th>Phone</th>
            <th>Email</th>
            <th>Delivery Days</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {vendors.length === 0 ? (
            <tr>
              <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                No vendors yet. Click "Add Vendor" to get started.
              </td>
            </tr>
          ) : (
            vendors.map((vendor) => (
              <tr key={vendor.id}>
                <td>{vendor.name}</td>
                <td>{vendor.account_number || '-'}</td>
                <td>{vendor.contact_person || '-'}</td>
                <td>{vendor.phone || '-'}</td>
                <td>{vendor.email || '-'}</td>
                <td>{vendor.delivery_days || '-'}</td>
                <td>
                  <button
                    className="btn btn-secondary"
                    onClick={() => handleEdit(vendor)}
                    style={{ marginRight: '10px' }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => handleDelete(vendor.id)}
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
                {editingVendor ? 'Edit Vendor' : 'Add New Vendor'}
              </h3>
              <button className="close-button" onClick={() => setShowModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Vendor Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Account Number</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.account_number}
                  onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
                  placeholder="e.g., ACC-12345"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Contact Person (Sales Rep)</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.contact_person}
                  onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Phone</label>
                <input
                  type="tel"
                  className="form-input"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Email</label>
                <input
                  type="email"
                  className="form-input"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Days</label>
                <input
                  type="text"
                  className="form-input"
                  value={formData.delivery_days}
                  onChange={(e) => setFormData({ ...formData, delivery_days: e.target.value })}
                  placeholder="e.g., Monday, Wednesday, Friday"
                />
                <small style={{ color: '#666', display: 'block', marginTop: '5px' }}>
                  Days when this vendor delivers (comma-separated)
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
                  {editingVendor ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default VendorManagement;

