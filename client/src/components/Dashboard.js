import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

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

  const categorizeMenuItem = (item) => {
    // Menu Engineering Matrix
    // X-axis: Profitability (net_profit), Y-axis: Popularity (quantity_sold)
    if (!analytics || !analytics.breakdown || analytics.breakdown.length === 0) {
      return { category: 'N/A', color: '#999', icon: '❓' };
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
      return { category: 'Stars', color: '#28a745', icon: '⭐' };
    } else if (!isHighProfit && isHighPopularity) {
      return { category: 'Plowhorses', color: '#17a2b8', icon: '🐴' };
    } else if (isHighProfit && !isHighPopularity) {
      return { category: 'Puzzles', color: '#ffc107', icon: '🧩' };
    } else {
      return { category: 'Dogs', color: '#dc3545', icon: '🐕' };
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
              <span style={{ color: '#28a745' }}>⭐ Stars</span> - High Profit, High Popularity (Keep!)
            </span>
            <span>
              <span style={{ color: '#ffc107' }}>🧩 Puzzles</span> - High Profit, Low Popularity (Reprice)
            </span>
            <span>
              <span style={{ color: '#17a2b8' }}>🐴 Plowhorses</span> - Low Profit, High Popularity (Lower portion)
            </span>
            <span>
              <span style={{ color: '#dc3545' }}>🐕 Dogs</span> - Low Profit, Low Popularity (Remove)
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
                }}
                title={`${item.menu_item_name || 'Unknown'}: $${(profit || 0).toFixed(2)} net profit, ${item.quantity_sold || 0} sold`}
              >
                <div
                  style={{
                    width: '20px',
                    height: '20px',
                    borderRadius: '50%',
                    background: category.color,
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
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
              <th>Category</th>
              <th>Menu Item</th>
              <th>Quantity Sold</th>
              <th>Revenue</th>
              <th>Food Cost</th>
              <th>Labor Cost</th>
              <th>Prime Cost</th>
              <th>Net Profit</th>
              <th>Food Cost %</th>
              <th>Prime Cost %</th>
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
              analytics.breakdown.map((item) => {
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
                    <td style={{ fontWeight: '600', color: netProfit >= 0 ? '#28a745' : '#dc3545' }}>
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
