import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function PayrollManager() {
  const [activeTab, setActiveTab] = useState('employees');
  const [loading, setLoading] = useState(true);
  
  // Data
  const [employees, setEmployees] = useState([]);
  const [payrollRecords, setPayrollRecords] = useState([]);
  const [laborAnalysis, setLaborAnalysis] = useState(null);
  
  // Forms
  const [showEmployeeForm, setShowEmployeeForm] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [employeeForm, setEmployeeForm] = useState({
    first_name: '',
    last_name: '',
    position: '',
    department: 'kitchen',
    hire_date: new Date().toISOString().split('T')[0],
    pay_type: 'hourly',
    pay_rate: '',
    hours_per_week: '40',
    phone: '',
    email: '',
  });

  // Run Payroll
  // eslint-disable-next-line no-unused-vars
  const [showRunPayroll, setShowRunPayroll] = useState(false);
  const [payrollPeriod, setPayrollPeriod] = useState({
    start: '',
    end: '',
    payment_date: ''
  });
  const [employeeHours, setEmployeeHours] = useState([]);

  // Filters
  const [filters, setFilters] = useState({
    start_date: new Date(new Date().setDate(1)).toISOString().split('T')[0],
    end_date: new Date().toISOString().split('T')[0],
  });

  const tabs = [
    { id: 'employees', label: 'Employees' },
    { id: 'records', label: 'Payroll Records' },
    { id: 'run', label: 'Run Payroll' },
    { id: 'analysis', label: 'Labor Analysis' },
  ];

  const departments = ['kitchen', 'front_of_house', 'management', 'maintenance'];
  const positions = ['chef', 'line_cook', 'prep_cook', 'server', 'host', 'bartender', 'manager', 'busser', 'dishwasher'];

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [emps, records] = await Promise.all([
        api.getEmployees(true),
        api.getPayrollRecords(filters)
      ]);
      setEmployees(emps);
      setPayrollRecords(records);

      // Initialize employee hours for payroll
      setEmployeeHours(emps.map(e => ({
        employee_id: e.id,
        name: `${e.first_name} ${e.last_name}`,
        pay_rate: e.pay_rate,
        regular_hours: e.hours_per_week || 40,
        overtime_hours: 0,
        tips: 0
      })));

      // Load labor analysis if on that tab
      if (activeTab === 'analysis' && filters.start_date && filters.end_date) {
        const analysis = await api.getLaborAnalysis(filters.start_date, filters.end_date);
        setLaborAnalysis(analysis);
      }
    } catch (error) {
      console.error('Load error:', error);
      alert('Error loading data: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [filters, activeTab]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount || 0);
  };

  // Employee CRUD
  const handleEmployeeSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingEmployee) {
        await api.updateEmployee(editingEmployee.id, employeeForm);
      } else {
        await api.createEmployee(employeeForm);
      }
      setShowEmployeeForm(false);
      setEditingEmployee(null);
      resetEmployeeForm();
      loadData();
    } catch (error) {
      alert('Error saving employee: ' + error.message);
    }
  };

  const resetEmployeeForm = () => {
    setEmployeeForm({
      first_name: '',
      last_name: '',
      position: '',
      department: 'kitchen',
      hire_date: new Date().toISOString().split('T')[0],
      pay_type: 'hourly',
      pay_rate: '',
      hours_per_week: '40',
      phone: '',
      email: '',
    });
  };

  const handleEditEmployee = (emp) => {
    setEditingEmployee(emp);
    setEmployeeForm({
      first_name: emp.first_name,
      last_name: emp.last_name,
      position: emp.position,
      department: emp.department || 'kitchen',
      hire_date: emp.hire_date,
      pay_type: emp.pay_type,
      pay_rate: emp.pay_rate,
      hours_per_week: emp.hours_per_week || '40',
      phone: emp.phone || '',
      email: emp.email || '',
    });
    setShowEmployeeForm(true);
  };

  // Run Payroll
  const handleRunPayroll = async () => {
    if (!payrollPeriod.start || !payrollPeriod.end) {
      alert('Please set pay period dates');
      return;
    }

    try {
      const result = await api.runPayroll(
        payrollPeriod.start,
        payrollPeriod.end,
        employeeHours.filter(h => h.regular_hours > 0 || h.overtime_hours > 0),
        payrollPeriod.payment_date || null
      );

      alert(`Payroll processed!\n\n${result.employees_processed} employees\nTotal Gross: ${formatCurrency(result.total_gross)}\nTotal Net: ${formatCurrency(result.total_net)}\nEmployer Cost: ${formatCurrency(result.total_employer_cost)}`);
      
      setShowRunPayroll(false);
      setActiveTab('records');
      loadData();
    } catch (error) {
      alert('Error running payroll: ' + error.message);
    }
  };

  const updateEmployeeHours = (idx, field, value) => {
    const updated = [...employeeHours];
    updated[idx][field] = parseFloat(value) || 0;
    setEmployeeHours(updated);
  };

  // Render Employees
  const renderEmployees = () => (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Employees ({employees.length})</h3>
        <button className="btn btn-primary" onClick={() => { resetEmployeeForm(); setShowEmployeeForm(true); }}>
          + Add Employee
        </button>
      </div>

      {employees.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No employees yet. Add your first employee to get started.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Position</th>
              <th>Department</th>
              <th>Pay Type</th>
              <th style={{ textAlign: 'right' }}>Rate</th>
              <th>Hire Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map(emp => (
              <tr key={emp.id}>
                <td style={{ fontWeight: '500' }}>{emp.first_name} {emp.last_name}</td>
                <td>
                  <span style={{ 
                    background: '#e3f2fd', 
                    padding: '2px 8px', 
                    borderRadius: '4px',
                    fontSize: '0.85rem'
                  }}>
                    {emp.position}
                  </span>
                </td>
                <td style={{ textTransform: 'capitalize' }}>{emp.department?.replace('_', ' ')}</td>
                <td style={{ textTransform: 'capitalize' }}>{emp.pay_type}</td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>
                  {formatCurrency(emp.pay_rate)}{emp.pay_type === 'hourly' ? '/hr' : '/yr'}
                </td>
                <td>{emp.hire_date}</td>
                <td>
                  <button 
                    className="btn btn-secondary" 
                    style={{ padding: '4px 10px' }}
                    onClick={() => handleEditEmployee(emp)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );

  // Render Payroll Records
  const renderRecords = () => (
    <div className="card">
      <h3 style={{ marginBottom: '20px' }}>Payroll Records</h3>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">From</label>
          <input
            type="date"
            className="form-input"
            value={filters.start_date}
            onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">To</label>
          <input
            type="date"
            className="form-input"
            value={filters.end_date}
            onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
          />
        </div>
      </div>

      {payrollRecords.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          No payroll records for this period.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Pay Period</th>
              <th style={{ textAlign: 'right' }}>Hours</th>
              <th style={{ textAlign: 'right' }}>Gross Pay</th>
              <th style={{ textAlign: 'right' }}>Taxes</th>
              <th style={{ textAlign: 'right' }}>Net Pay</th>
              <th style={{ textAlign: 'right' }}>Employer Cost</th>
            </tr>
          </thead>
          <tbody>
            {payrollRecords.map(rec => (
              <tr key={rec.id}>
                <td style={{ fontWeight: '500' }}>{rec.first_name} {rec.last_name}</td>
                <td>{rec.pay_period_start} — {rec.pay_period_end}</td>
                <td style={{ textAlign: 'right' }}>
                  {parseFloat(rec.regular_hours || 0).toFixed(1)}
                  {rec.overtime_hours > 0 && (
                    <span style={{ color: '#f57c00' }}> +{parseFloat(rec.overtime_hours).toFixed(1)} OT</span>
                  )}
                </td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(rec.gross_pay)}</td>
                <td style={{ textAlign: 'right', color: '#dc3545' }}>
                  {formatCurrency(
                    parseFloat(rec.federal_tax_withheld || 0) +
                    parseFloat(rec.state_tax_withheld || 0) +
                    parseFloat(rec.social_security_withheld || 0) +
                    parseFloat(rec.medicare_withheld || 0)
                  )}
                </td>
                <td style={{ textAlign: 'right', fontWeight: '600', color: '#28a745' }}>
                  {formatCurrency(rec.net_pay)}
                </td>
                <td style={{ textAlign: 'right', fontWeight: '500' }}>
                  {formatCurrency(rec.total_employer_cost)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: '#f8f9fa', fontWeight: '600' }}>
              <td colSpan="3">Totals</td>
              <td style={{ textAlign: 'right' }}>
                {formatCurrency(payrollRecords.reduce((s, r) => s + parseFloat(r.gross_pay || 0), 0))}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatCurrency(payrollRecords.reduce((s, r) => s + 
                  parseFloat(r.federal_tax_withheld || 0) +
                  parseFloat(r.state_tax_withheld || 0) +
                  parseFloat(r.social_security_withheld || 0) +
                  parseFloat(r.medicare_withheld || 0), 0))}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatCurrency(payrollRecords.reduce((s, r) => s + parseFloat(r.net_pay || 0), 0))}
              </td>
              <td style={{ textAlign: 'right' }}>
                {formatCurrency(payrollRecords.reduce((s, r) => s + parseFloat(r.total_employer_cost || 0), 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      )}
    </div>
  );

  // Render Run Payroll
  const renderRunPayroll = () => (
    <div className="card">
      <h3 style={{ marginBottom: '20px' }}>Run Payroll</h3>

      {/* Pay Period */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '25px', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Pay Period Start *</label>
          <input
            type="date"
            className="form-input"
            value={payrollPeriod.start}
            onChange={(e) => setPayrollPeriod({ ...payrollPeriod, start: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Pay Period End *</label>
          <input
            type="date"
            className="form-input"
            value={payrollPeriod.end}
            onChange={(e) => setPayrollPeriod({ ...payrollPeriod, end: e.target.value })}
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label className="form-label">Payment Date</label>
          <input
            type="date"
            className="form-input"
            value={payrollPeriod.payment_date}
            onChange={(e) => setPayrollPeriod({ ...payrollPeriod, payment_date: e.target.value })}
          />
        </div>
      </div>

      {/* Employee Hours */}
      <h4 style={{ marginBottom: '15px' }}>Enter Hours</h4>
      <table className="table" style={{ marginBottom: '20px' }}>
        <thead>
          <tr>
            <th>Employee</th>
            <th style={{ textAlign: 'right' }}>Rate</th>
            <th style={{ width: '100px' }}>Regular Hrs</th>
            <th style={{ width: '100px' }}>OT Hrs</th>
            <th style={{ width: '100px' }}>Tips</th>
            <th style={{ textAlign: 'right' }}>Est. Gross</th>
          </tr>
        </thead>
        <tbody>
          {employeeHours.map((eh, idx) => {
            const regular = (eh.regular_hours || 0) * parseFloat(eh.pay_rate || 0);
            const overtime = (eh.overtime_hours || 0) * parseFloat(eh.pay_rate || 0) * 1.5;
            const gross = regular + overtime + (eh.tips || 0);
            return (
              <tr key={eh.employee_id}>
                <td style={{ fontWeight: '500' }}>{eh.name}</td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(eh.pay_rate)}/hr</td>
                <td>
                  <input
                    type="number"
                    className="form-input"
                    value={eh.regular_hours}
                    onChange={(e) => updateEmployeeHours(idx, 'regular_hours', e.target.value)}
                    style={{ width: '80px' }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="form-input"
                    value={eh.overtime_hours}
                    onChange={(e) => updateEmployeeHours(idx, 'overtime_hours', e.target.value)}
                    style={{ width: '80px' }}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    className="form-input"
                    value={eh.tips}
                    onChange={(e) => updateEmployeeHours(idx, 'tips', e.target.value)}
                    style={{ width: '80px' }}
                  />
                </td>
                <td style={{ textAlign: 'right', fontWeight: '600' }}>{formatCurrency(gross)}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f8f9fa', fontWeight: '600' }}>
            <td colSpan="5">Total Estimated Gross</td>
            <td style={{ textAlign: 'right' }}>
              {formatCurrency(employeeHours.reduce((s, eh) => {
                const regular = (eh.regular_hours || 0) * parseFloat(eh.pay_rate || 0);
                const overtime = (eh.overtime_hours || 0) * parseFloat(eh.pay_rate || 0) * 1.5;
                return s + regular + overtime + (eh.tips || 0);
              }, 0))}
            </td>
          </tr>
        </tfoot>
      </table>

      <button className="btn btn-success" onClick={handleRunPayroll} style={{ padding: '12px 30px' }}>
        Process Payroll
      </button>

      <div style={{ marginTop: '20px', padding: '15px', background: '#e3f2fd', borderRadius: '8px', fontSize: '0.9rem' }}>
        Taxes are calculated automatically:<br/>
        • Federal: ~12% • State: ~5% • SS: 6.2% • Medicare: 1.45%<br/>
        • Employer also pays: 6.2% SS + 1.45% Medicare + ~0.6% FUTA + ~2.7% SUTA
      </div>
    </div>
  );

  // Render Labor Analysis
  const renderAnalysis = () => (
    <div className="card">
      <h3 style={{ marginBottom: '20px' }}>Labor Cost Analysis</h3>

      {laborAnalysis ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '15px', marginBottom: '25px' }}>
            <div className="metric-card">
              <div className="metric-label">Total Labor Cost</div>
              <div className="metric-value">{formatCurrency(laborAnalysis.labor?.total_cost)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Hours</div>
              <div className="metric-value">{parseFloat(laborAnalysis.labor?.total_hours || 0).toFixed(1)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Revenue</div>
              <div className="metric-value">{formatCurrency(laborAnalysis.revenue)}</div>
            </div>
            <div className="metric-card" style={{ 
              background: parseFloat(laborAnalysis.labor_cost_percent) > 35 ? '#ffebee' : '#e8f5e9'
            }}>
              <div className="metric-label">Labor Cost %</div>
              <div className="metric-value" style={{ 
                color: parseFloat(laborAnalysis.labor_cost_percent) > 35 ? '#dc3545' : '#28a745'
              }}>
                {laborAnalysis.labor_cost_percent}%
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
            <div className="metric-card">
              <div className="metric-label">Avg Cost per Hour</div>
              <div className="metric-value">{formatCurrency(laborAnalysis.labor?.avg_cost_per_hour)}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Revenue per Labor Hour</div>
              <div className="metric-value">{formatCurrency(laborAnalysis.revenue_per_labor_hour)}</div>
            </div>
          </div>

          <div style={{ marginTop: '25px', padding: '15px', background: '#fff3cd', borderRadius: '8px' }}>
            <strong>Target:</strong> Labor cost should be 25-35% of revenue for most restaurants.
            {parseFloat(laborAnalysis.labor_cost_percent) > 35 && (
              <div style={{ color: '#dc3545', marginTop: '10px' }}>
                Your labor cost is above target. Consider reviewing schedules or increasing revenue.
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          Select a date range to view labor analysis.
        </div>
      )}
    </div>
  );

  if (loading && employees.length === 0) {
    return <div className="spinner"></div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Payroll Manager</h2>
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
      {activeTab === 'employees' && renderEmployees()}
      {activeTab === 'records' && renderRecords()}
      {activeTab === 'run' && renderRunPayroll()}
      {activeTab === 'analysis' && renderAnalysis()}

      {/* Employee Form Modal */}
      {showEmployeeForm && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div className="card" style={{ width: '500px', maxHeight: '90vh', overflow: 'auto' }}>
            <h3 style={{ marginBottom: '20px' }}>
              {editingEmployee ? 'Edit Employee' : 'Add Employee'}
            </h3>
            <form onSubmit={handleEmployeeSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={employeeForm.first_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={employeeForm.last_name}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, last_name: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Position *</label>
                  <select
                    className="form-input"
                    value={employeeForm.position}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, position: e.target.value })}
                    required
                  >
                    <option value="">Select...</option>
                    {positions.map(p => (
                      <option key={p} value={p}>{p.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-input"
                    value={employeeForm.department}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, department: e.target.value })}
                  >
                    {departments.map(d => (
                      <option key={d} value={d}>{d.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Pay Type *</label>
                  <select
                    className="form-input"
                    value={employeeForm.pay_type}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, pay_type: e.target.value })}
                  >
                    <option value="hourly">Hourly</option>
                    <option value="salary">Salary</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Pay Rate *</label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-input"
                    value={employeeForm.pay_rate}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, pay_rate: e.target.value })}
                    placeholder={employeeForm.pay_type === 'hourly' ? '$/hr' : '$/year'}
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Hours/Week</label>
                  <input
                    type="number"
                    className="form-input"
                    value={employeeForm.hours_per_week}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, hours_per_week: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Hire Date *</label>
                <input
                  type="date"
                  className="form-input"
                  value={employeeForm.hire_date}
                  onChange={(e) => setEmployeeForm({ ...employeeForm, hire_date: e.target.value })}
                  required
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={employeeForm.phone}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, phone: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-input"
                    value={employeeForm.email}
                    onChange={(e) => setEmployeeForm({ ...employeeForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary"
                  onClick={() => { setShowEmployeeForm(false); setEditingEmployee(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingEmployee ? 'Save Changes' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default PayrollManager;
