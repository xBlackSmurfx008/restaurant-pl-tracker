import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortColumn, setSortColumn] = useState('net_profit');
  const [sortDirection, setSortDirection] = useState('desc'); // 'asc' or 'desc'

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const [analyticsData, alertsData] = await Promise.all([
        api.getAnalytics(period),
        api.getPriceWatchAlerts(30),
      ]);
      setAnalytics(analyticsData);
      setPriceAlerts(alertsData);
    } catch (error) {
      alert('Error loading dashboard: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const periods = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
    { value: 'quarter', label: 'This Quarter' },
    { value: 'year', label: 'This Year' },
    { value: 'ytd', label: 'YTD' },
  ];

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if clicking same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // New column, default to descending
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Sort the breakdown data
  const getSortedBreakdown = () => {
    if (!analytics || !analytics.breakdown || analytics.breakdown.length === 0) {
      return [];
    }

    return [...analytics.breakdown].sort((a, b) => {
      let aValue, bValue;

      switch (sortColumn) {
        case 'category':
          const categoryA = categorizeMenuItem(a);
          const categoryB = categorizeMenuItem(b);
          aValue = categoryA.category;
          bValue = categoryB.category;
          break;
        case 'menu_item_name':
          aValue = (a.menu_item_name || '').toLowerCase();
          bValue = (b.menu_item_name || '').toLowerCase();
          break;
        case 'quantity_sold':
          aValue = a.quantity_sold || 0;
          bValue = b.quantity_sold || 0;
          break;
        case 'revenue':
          aValue = a.revenue || 0;
          bValue = b.revenue || 0;
          break;
        case 'cogs':
          aValue = a.cogs || 0;
          bValue = b.cogs || 0;
          break;
        case 'labor_cogs':
          aValue = a.labor_cogs || 0;
          bValue = b.labor_cogs || 0;
          break;
        case 'total_cogs':
          aValue = a.total_cogs || a.cogs || 0;
          bValue = b.total_cogs || b.cogs || 0;
          break;
        case 'net_profit':
          aValue = (a.net_profit !== undefined && a.net_profit !== null)
            ? a.net_profit
            : ((a.profit !== undefined && a.profit !== null) ? a.profit : 0);
          bValue = (b.net_profit !== undefined && b.net_profit !== null)
            ? b.net_profit
            : ((b.profit !== undefined && b.profit !== null) ? b.profit : 0);
          break;
        case 'food_cost_percent':
          aValue = a.food_cost_percent || 0;
          bValue = b.food_cost_percent || 0;
          break;
        case 'prime_cost_percent':
          aValue = a.prime_cost_percent || a.food_cost_percent || 0;
          bValue = b.prime_cost_percent || b.food_cost_percent || 0;
          break;
        default:
          return 0;
      }

      // Handle string comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (sortDirection === 'asc') {
          return aValue.localeCompare(bValue);
        } else {
          return bValue.localeCompare(aValue);
        }
      }

      // Handle number comparison
      if (sortDirection === 'asc') {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  };

  // Get sort indicator for column header
  const getSortIndicator = (column) => {
    if (sortColumn !== column) {
      return <span style={{ opacity: 0.3, fontSize: '0.8em' }}> ↕</span>; // Neutral indicator
    }
    return sortDirection === 'asc' ? (
      <span style={{ color: '#9AC636', fontWeight: 'bold' }}> ↑</span>
    ) : (
      <span style={{ color: '#9AC636', fontWeight: 'bold' }}> ↓</span>
    );
  };

  const categorizeMenuItem = (item) => {
    // Menu Engineering Matrix with Marketing-Focused Categories
    // X-axis: Profitability (net_profit), Y-axis: Popularity (quantity_sold)
    if (!analytics || !analytics.breakdown || analytics.breakdown.length === 0) {
      return { category: 'N/A', color: '#999', icon: '❓', description: 'No data available' };
    }
    const avgProfit = analytics.breakdown.reduce((sum, i) => {
      const p = (i.net_profit !== undefined && i.net_profit !== null) 
        ? i.net_profit 
        : ((i.profit !== undefined && i.profit !== null) ? i.profit : 0);
      return sum + p;
    }, 0) / analytics.breakdown.length;
    const avgQuantity = analytics.breakdown.reduce((sum, i) => sum + (i.quantity_sold || 0), 0) / analytics.breakdown.length;

    const profit = (item.net_profit !== undefined && item.net_profit !== null)
      ? item.net_profit
      : ((item.profit !== undefined && item.profit !== null) ? item.profit : 0);
    const isHighProfit = profit >= avgProfit;
    const isHighPopularity = (item.quantity_sold || 0) >= avgQuantity;

    if (isHighProfit && isHighPopularity) {
      return { 
        category: 'Champions', 
        color: '#28a745', 
        icon: '🏆',
        description: 'High profit, high popularity - Your best performers! Keep promoting these.'
      };
    } else if (!isHighProfit && isHighPopularity) {
      return { 
        category: 'Volume Drivers', 
        color: '#17a2b8', 
        icon: '📊',
        description: 'High popularity, lower profit - Great for traffic. Consider optimizing costs or portion sizes.'
      };
    } else if (isHighProfit && !isHighPopularity) {
      return { 
        category: 'Hidden Gems', 
        color: '#ffc107', 
        icon: '💎',
        description: 'High profit, low popularity - Untapped potential! Market these more or adjust pricing.'
      };
    } else {
      return { 
        category: 'Needs Review', 
        color: '#dc3545', 
        icon: '🔍',
        description: 'Low profit, low popularity - Review pricing, costs, or consider removing from menu.'
      };
    }
  };

  if (loading) {
    return <div className="spinner"></div>;
  }

  if (!analytics) {
    return <div>No data available</div>;
  }

  return (
    <div>
      <div className="card-header">
        <h2 className="card-title">Dashboard</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {periods.map((p) => (
            <button
              key={p.value}
              className={`tab-button ${period === p.value ? 'active' : ''}`}
              onClick={() => setPeriod(p.value)}
              style={{ padding: '8px 16px', fontSize: '0.9rem' }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Watch Alerts */}
      {priceAlerts.length > 0 && (
        <div
          style={{
            background: '#fff3cd',
            border: '2px solid #ffc107',
            borderRadius: '8px',
            padding: '15px',
            marginBottom: '20px',
          }}
        >
          <h4 style={{ marginBottom: '10px' }}>⚠️ Price Watch Alerts</h4>
          {priceAlerts.slice(0, 3).map((alert) => (
            <div key={alert.id} style={{ marginBottom: '8px' }}>
              You haven't updated the price of <strong>{alert.name || 'Unknown'}</strong> in{' '}
              {Math.floor(alert.days_since_update || 0)} days. Is it still{' '}
              <strong>${(parseFloat(alert.purchase_price) || 0).toFixed(2)}</strong> per{' '}
              {alert.purchase_unit || 'unit'}?
            </div>
          ))}
        </div>
      )}

      {/* Top Metrics */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-label">Total Revenue</div>
          <div className="metric-value">${(analytics.totals?.totalRevenue || 0).toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Net Profit (After Labor)</div>
          <div className="metric-value">${(analytics.totals?.netProfit || 0).toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Food Cost</div>
          <div className="metric-value">${((analytics.totals?.totalFoodCost || analytics.totals?.totalCOGS) || 0).toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Labor Cost</div>
          <div className="metric-value">${(analytics.totals?.totalLaborCost || 0).toLocaleString()}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Total Prime Cost</div>
          <div className="metric-value">${(analytics.totals?.totalCOGS || 0).toLocaleString()}</div>
          <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '5px' }}>
            (Food + Labor)
          </div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Global Food Cost %</div>
          <div className="metric-value">{analytics.totals?.globalFoodCostPercent || 0}%</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">Prime Cost %</div>
          <div className="metric-value">{analytics.totals?.primeCostPercent || 0}%</div>
        </div>
      </div>

      {/* Menu Engineering Matrix */}
      <div className="card" style={{ marginTop: '30px' }}>
        <h3 style={{ marginBottom: '20px' }}>Menu Engineering Matrix</h3>
        <div style={{ marginBottom: '20px', fontSize: '0.9rem', color: '#666' }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <span>
              <span style={{ color: '#28a745', fontWeight: '600' }}>🏆 Champions</span> - High Profit, High Popularity
            </span>
            <span>
              <span style={{ color: '#ffc107', fontWeight: '600' }}>💎 Hidden Gems</span> - High Profit, Low Popularity
            </span>
            <span>
              <span style={{ color: '#17a2b8', fontWeight: '600' }}>📊 Volume Drivers</span> - Low Profit, High Popularity
            </span>
            <span>
              <span style={{ color: '#dc3545', fontWeight: '600' }}>🔍 Needs Review</span> - Low Profit, Low Popularity
            </span>
          </div>
        </div>

        {/* Scatter Plot Visualization */}
        <div
          style={{
            height: '400px',
            border: '2px solid #e0e0e0',
            borderRadius: '8px',
            padding: '20px',
            position: 'relative',
            background: '#f8f9fa',
            marginBottom: '20px',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: 0,
              right: 0,
              height: '2px',
              background: '#333',
              transform: 'translateY(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 0,
              bottom: 0,
              width: '2px',
              background: '#333',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '10px',
              left: '50%',
              transform: 'translateX(-50%)',
              fontWeight: '600',
            }}
          >
            Popularity (Quantity Sold)
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: '10px',
              left: '10px',
              transform: 'rotate(-90deg)',
              transformOrigin: 'left center',
              fontWeight: '600',
            }}
          >
            Profitability ($)
          </div>

          {analytics.breakdown && analytics.breakdown.length > 0 && analytics.breakdown.map((item) => {
            const category = categorizeMenuItem(item);
            const profit = (item.net_profit !== undefined && item.net_profit !== null) 
              ? item.net_profit 
              : ((item.profit !== undefined && item.profit !== null) ? item.profit : 0);
            const maxProfit = Math.max(...analytics.breakdown.map((i) => {
              const p = (i.net_profit !== undefined && i.net_profit !== null) 
                ? i.net_profit 
                : ((i.profit !== undefined && i.profit !== null) ? i.profit : 0);
              return p;
            }));
            const maxQuantity = Math.max(...analytics.breakdown.map((i) => (i.quantity_sold || 0)));

            const x = maxProfit > 0 ? ((profit / maxProfit) * 100) : 0;
            const y = maxQuantity > 0 ? (100 - ((item.quantity_sold || 0) / maxQuantity) * 100) : 0;

            return (
              <div
                key={item.menu_item_id || `item-${Math.random()}`}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: 'pointer',
                  zIndex: 10,
                }}
                onClick={() => {
                  alert(`${item.menu_item_name || 'Unknown'}\n\n${category.category} ${category.icon}\n\n${category.description}\n\nNet Profit: $${(profit || 0).toFixed(2)}\nQuantity Sold: ${item.quantity_sold || 0}\nRevenue: $${(item.revenue || 0).toFixed(2)}`);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.3)';
                  e.currentTarget.style.zIndex = 20;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                  e.currentTarget.style.zIndex = 10;
                }}
                title={`${item.menu_item_name || 'Unknown'}: $${(profit || 0).toFixed(2)} net profit, ${item.quantity_sold || 0} sold\nClick for details`}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: category.color,
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                    transition: 'all 0.2s ease',
                  }}
                />
              </div>
            );
          })}
        </div>

        {/* Breakdown Table */}
        <table className="table">
          <thead>
            <tr>
              <th 
                onClick={() => handleSort('category')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'category' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'category') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'category') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by category"
              >
                Category{getSortIndicator('category')}
              </th>
              <th 
                onClick={() => handleSort('menu_item_name')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'menu_item_name' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'menu_item_name') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'menu_item_name') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by menu item name"
              >
                Menu Item{getSortIndicator('menu_item_name')}
              </th>
              <th 
                onClick={() => handleSort('quantity_sold')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'quantity_sold' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'quantity_sold') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'quantity_sold') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by quantity sold"
              >
                Quantity Sold{getSortIndicator('quantity_sold')}
              </th>
              <th 
                onClick={() => handleSort('revenue')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'revenue' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'revenue') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'revenue') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by revenue"
              >
                Revenue{getSortIndicator('revenue')}
              </th>
              <th 
                onClick={() => handleSort('cogs')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'cogs' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'cogs') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'cogs') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by food cost"
              >
                Food Cost{getSortIndicator('cogs')}
              </th>
              <th 
                onClick={() => handleSort('labor_cogs')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'labor_cogs' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'labor_cogs') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'labor_cogs') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by labor cost"
              >
                Labor Cost{getSortIndicator('labor_cogs')}
              </th>
              <th 
                onClick={() => handleSort('total_cogs')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'total_cogs' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'total_cogs') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'total_cogs') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by prime cost"
              >
                Prime Cost{getSortIndicator('total_cogs')}
              </th>
              <th 
                onClick={() => handleSort('net_profit')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'net_profit' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'net_profit') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'net_profit') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by net profit"
              >
                Net Profit{getSortIndicator('net_profit')}
              </th>
              <th 
                onClick={() => handleSort('food_cost_percent')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'food_cost_percent' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'food_cost_percent') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'food_cost_percent') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by food cost percentage"
              >
                Food Cost %{getSortIndicator('food_cost_percent')}
              </th>
              <th 
                onClick={() => handleSort('prime_cost_percent')}
                style={{ 
                  cursor: 'pointer', 
                  userSelect: 'none', 
                  padding: '12px',
                  transition: 'all 0.2s ease',
                  background: sortColumn === 'prime_cost_percent' ? 'rgba(154, 198, 54, 0.15)' : '#f8f9fa'
                }}
                onMouseEnter={(e) => {
                  if (sortColumn !== 'prime_cost_percent') {
                    e.currentTarget.style.background = '#e9ecef';
                  }
                }}
                onMouseLeave={(e) => {
                  if (sortColumn !== 'prime_cost_percent') {
                    e.currentTarget.style.background = '#f8f9fa';
                  } else {
                    e.currentTarget.style.background = 'rgba(154, 198, 54, 0.15)';
                  }
                }}
                title="Click to sort by prime cost percentage"
              >
                Prime Cost %{getSortIndicator('prime_cost_percent')}
              </th>
            </tr>
          </thead>
          <tbody>
            {!analytics.breakdown || analytics.breakdown.length === 0 ? (
              <tr>
                <td colSpan="10" style={{ textAlign: 'center', padding: '40px' }}>
                  No sales data for this period.
                </td>
              </tr>
            ) : (
              getSortedBreakdown().map((item) => {
                const category = categorizeMenuItem(item);
                const netProfit = (item.net_profit !== undefined && item.net_profit !== null)
                  ? item.net_profit
                  : ((item.profit !== undefined && item.profit !== null) ? item.profit : 0);
                const revenue = (item.revenue !== undefined && item.revenue !== null) ? item.revenue : 0;
                const cogs = (item.cogs !== undefined && item.cogs !== null) ? item.cogs : 0;
                const laborCogs = (item.labor_cogs !== undefined && item.labor_cogs !== null) ? item.labor_cogs : 0;
                const totalCogs = (item.total_cogs !== undefined && item.total_cogs !== null) 
                  ? item.total_cogs 
                  : cogs;
                
                return (
                  <tr key={item.menu_item_id || `item-${Math.random()}`}>
                    <td>
                      <span style={{ color: category.color, fontWeight: '600' }}>
                        {category.icon} {category.category}
                      </span>
                    </td>
                    <td>{item.menu_item_name || 'Unknown'}</td>
                    <td>{item.quantity_sold || 0}</td>
                    <td>${revenue.toFixed(2)}</td>
                    <td>${cogs.toFixed(2)}</td>
                    <td>${laborCogs.toFixed(2)}</td>
                    <td>${totalCogs.toFixed(2)}</td>
                    <td style={{ fontWeight: '600' }} className={netProfit >= 0 ? 'value-positive' : 'value-negative'}>
                      ${netProfit.toFixed(2)}
                    </td>
                    <td>{(item.food_cost_percent !== undefined && item.food_cost_percent !== null) ? item.food_cost_percent : 0}%</td>
                    <td>{(item.prime_cost_percent !== undefined && item.prime_cost_percent !== null) 
                      ? item.prime_cost_percent 
                      : ((item.food_cost_percent !== undefined && item.food_cost_percent !== null) ? item.food_cost_percent : 0)}%</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default Dashboard;
