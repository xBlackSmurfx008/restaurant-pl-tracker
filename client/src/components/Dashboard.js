import React, { useState, useEffect, useCallback } from 'react';
import api from '../services/api';

function Dashboard() {
  const [analytics, setAnalytics] = useState(null);
  const [period, setPeriod] = useState('month');
  const [priceAlerts, setPriceAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dailySummary, setDailySummary] = useState(null);
  const [view, setView] = useState('overview'); // 'overview' | 'menu-analysis'

  const loadDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const today = new Date();
      const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      const [analyticsData, alertsData, dailyData] = await Promise.all([
        api.getAnalytics(period),
        api.getPriceWatchAlerts(30),
        api.getDailySummary(thirtyDaysAgo.toISOString().split('T')[0], today.toISOString().split('T')[0]),
      ]);
      setAnalytics(analyticsData);
      setPriceAlerts(alertsData);
      setDailySummary(dailyData);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  const periods = [
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'Week' },
    { value: 'month', label: 'Month' },
    { value: 'quarter', label: 'Quarter' },
    { value: 'year', label: 'Year' },
  ];

  // Brand colors from theme
  const brandColors = {
    primary: '#9AC636',
    primaryDark: '#7BA328',
    success: '#43A047',
    warning: '#FFB300',
    danger: '#E53935',
    dangerDark: '#C62828',
    charcoal: '#1A1A1A',
    dark: '#2D2D2D',
    gray: '#3D3D3D',
    info: '#1976D2'
  };

  const categorizeMenuItem = (item) => {
    if (!analytics || !analytics.breakdown || analytics.breakdown.length === 0) {
      return { category: 'N/A', color: '#999', description: 'No data' };
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
      return { category: 'Champions', color: brandColors.success, icon: '🏆' };
    } else if (!isHighProfit && isHighPopularity) {
      return { category: 'Volume Drivers', color: brandColors.info, icon: '' };
    } else if (isHighProfit && !isHighPopularity) {
      return { category: 'Hidden Gems', color: brandColors.warning, icon: '' };
    } else {
      return { category: 'Needs Review', color: brandColors.danger, icon: '' };
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount || 0);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num?.toFixed(0) || '0';
  };

  // Calculate trend (mock for now - would compare to previous period)
  // eslint-disable-next-line no-unused-vars
  const getTrend = (value, target) => {
    if (!target || target === 0) return { direction: 'neutral', percent: 0 };
    const diff = ((value - target) / target) * 100;
    return {
      direction: diff >= 0 ? 'up' : 'down',
      percent: Math.abs(diff).toFixed(1)
    };
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '400px',
        background: 'linear-gradient(135deg, rgba(26,26,26,0.02) 0%, rgba(154,198,54,0.05) 100%)',
        borderRadius: '16px'
      }}>
        <div style={{
          width: '60px',
          height: '60px',
          border: '4px solid rgba(154,198,54,0.2)',
          borderTop: '4px solid #9AC636',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '80px 40px',
        background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)',
        borderRadius: '16px'
      }}>
        <div style={{ fontSize: '2rem', marginBottom: '20px', fontWeight: 'bold', color: '#ccc' }}>—</div>
        <h3 style={{ color: '#1a1a1a', marginBottom: '10px' }}>No Data Available</h3>
        <p style={{ color: '#666' }}>Start adding sales to see your dashboard analytics</p>
      </div>
    );
  }

  // Process daily data for chart
  const chartData = dailySummary?.daily?.slice(-14) || [];
  const maxRevenue = Math.max(...chartData.map(d => d.revenue || 0), 1);

  return (
    <div style={{ padding: '0' }}>
      {/* Header Section */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div>
          <h2 style={{
            fontFamily: 'Oswald, sans-serif',
            fontSize: '1.8rem',
            fontWeight: '600',
            color: '#1a1a1a',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            margin: 0
          }}>
            Dashboard
          </h2>
          <p style={{
            color: '#666',
            margin: '4px 0 0 0',
            fontSize: '0.9rem'
          }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {/* View Toggle */}
          <div style={{
            display: 'flex',
            background: '#1a1a1a',
            borderRadius: '8px',
            padding: '4px',
            marginRight: '8px'
          }}>
            <button
              onClick={() => setView('overview')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: view === 'overview' ? '#9AC636' : 'transparent',
                color: view === 'overview' ? '#1a1a1a' : '#fff',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.85rem',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Overview
            </button>
            <button
              onClick={() => setView('menu-analysis')}
              style={{
                padding: '8px 16px',
                border: 'none',
                borderRadius: '6px',
                background: view === 'menu-analysis' ? '#9AC636' : 'transparent',
                color: view === 'menu-analysis' ? '#1a1a1a' : '#fff',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.85rem',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Menu Analysis
            </button>
          </div>

          {/* Period Selector */}
          {periods.map((p) => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              style={{
                padding: '8px 16px',
                border: period === p.value ? '2px solid #9AC636' : '2px solid #e0e0e0',
                borderRadius: '8px',
                background: period === p.value ? 'rgba(154,198,54,0.1)' : '#fff',
                color: period === p.value ? '#9AC636' : '#666',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.85rem',
                letterSpacing: '0.5px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                fontWeight: period === p.value ? '600' : '400'
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Alerts Banner */}
      {priceAlerts.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px'
        }}>
          <span style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#FF9800' }}>!</span>
          <div>
            <h4 style={{ margin: '0 0 8px 0', color: '#92400e', fontFamily: 'Oswald, sans-serif', letterSpacing: '0.5px' }}>
              Price Watch Alerts ({priceAlerts.length})
            </h4>
            <p style={{ margin: 0, color: '#78350f', fontSize: '0.9rem' }}>
              {priceAlerts[0]?.name || 'Ingredient'} price hasn't been updated in {Math.floor(priceAlerts[0]?.days_since_update || 0)} days
              {priceAlerts.length > 1 && ` (and ${priceAlerts.length - 1} more)`}
            </p>
          </div>
        </div>
      )}

      {view === 'overview' ? (
        <>
          {/* Hero Metrics */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '20px',
            marginBottom: '32px'
          }}>
            {/* Revenue Card */}
            <div style={{
              background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
              borderRadius: '16px',
              padding: '28px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(0,0,0,0.15)'
            }}>
              <div style={{
                position: 'absolute',
                top: '-30px',
                right: '-30px',
                width: '120px',
                height: '120px',
                background: 'rgba(154,198,54,0.1)',
                borderRadius: '50%'
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    background: 'rgba(154,198,54,0.2)',
                    padding: '8px',
                    borderRadius: '10px',
                    display: 'inline-flex'
                  }}>
                    $
                  </span>
                  <span style={{
                    color: 'rgba(255,255,255,0.7)',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '0.85rem',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase'
                  }}>
                    Total Revenue
                  </span>
                </div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '2.8rem',
                  fontWeight: '700',
                  color: '#9AC636',
                  lineHeight: 1.1
                }}>
                  {formatCurrency(analytics.totals?.totalRevenue || 0)}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginTop: '12px',
                  color: brandColors.success,
                  fontSize: '0.9rem'
                }}>
                  <span>↑</span>
                  <span>{formatNumber(dailySummary?.totals?.revenue || 0)} this period</span>
                </div>
              </div>
            </div>

            {/* Net Profit Card */}
            <div style={{
              background: `linear-gradient(135deg, ${brandColors.primaryDark} 0%, ${brandColors.primary} 100%)`,
              borderRadius: '16px',
              padding: '28px',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 10px 40px rgba(154,198,54,0.3)'
            }}>
              <div style={{
                position: 'absolute',
                bottom: '-40px',
                right: '-40px',
                width: '150px',
                height: '150px',
                background: 'rgba(255,255,255,0.05)',
                borderRadius: '50%'
              }} />
              <div style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <span style={{
                    background: 'rgba(255,255,255,0.15)',
                    padding: '8px',
                    borderRadius: '10px',
                    display: 'inline-flex'
                  }}>
                    %
                  </span>
                  <span style={{
                    color: 'rgba(255,255,255,0.8)',
                    fontFamily: 'Oswald, sans-serif',
                    fontSize: '0.85rem',
                    letterSpacing: '1.5px',
                    textTransform: 'uppercase'
                  }}>
                    Net Profit
                  </span>
                </div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '2.8rem',
                  fontWeight: '700',
                  color: '#fff',
                  lineHeight: 1.1
                }}>
                  {formatCurrency(analytics.totals?.netProfit || 0)}
                </div>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginTop: '12px'
                }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    padding: '4px 10px',
                    borderRadius: '20px',
                    fontSize: '0.8rem',
                    color: '#fff'
                  }}>
                    After labor costs
                  </div>
                </div>
              </div>
            </div>

            {/* Food Cost Card */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{
                  background: '#fef3c7',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'inline-flex'
                }}>
                  
                </span>
                <span style={{
                  color: '#666',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '0.85rem',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}>
                  Food Cost
                </span>
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '2.8rem',
                fontWeight: '700',
                color: parseFloat(analytics.totals?.globalFoodCostPercent || 0) > 35 ? brandColors.danger : brandColors.success,
                lineHeight: 1.1
              }}>
                {analytics.totals?.globalFoodCostPercent || 0}%
              </div>
              <div style={{
                marginTop: '16px',
                background: '#f3f4f6',
                borderRadius: '8px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(parseFloat(analytics.totals?.globalFoodCostPercent || 0) / 50 * 100, 100)}%`,
                  background: parseFloat(analytics.totals?.globalFoodCostPercent || 0) > 35 
                    ? `linear-gradient(90deg, ${brandColors.warning} 0%, ${brandColors.danger} 100%)`
                    : `linear-gradient(90deg, ${brandColors.success} 0%, ${brandColors.primary} 100%)`,
                  borderRadius: '8px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '0.75rem',
                color: '#999'
              }}>
                <span>Target: 30%</span>
                <span>Max: 35%</span>
              </div>
            </div>

            {/* Prime Cost Card */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '28px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px'
              }}>
                <span style={{
                  background: '#e0e7ff',
                  padding: '8px',
                  borderRadius: '10px',
                  display: 'inline-flex'
                }}>
                  ⚡
                </span>
                <span style={{
                  color: '#666',
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '0.85rem',
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}>
                  Prime Cost
                </span>
              </div>
              <div style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '2.8rem',
                fontWeight: '700',
                color: parseFloat(analytics.totals?.primeCostPercent || 0) > 65 ? brandColors.danger : brandColors.info,
                lineHeight: 1.1
              }}>
                {analytics.totals?.primeCostPercent || 0}%
              </div>
              <div style={{
                marginTop: '16px',
                background: '#f3f4f6',
                borderRadius: '8px',
                height: '8px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(parseFloat(analytics.totals?.primeCostPercent || 0) / 80 * 100, 100)}%`,
                  background: parseFloat(analytics.totals?.primeCostPercent || 0) > 65 
                    ? `linear-gradient(90deg, ${brandColors.warning} 0%, ${brandColors.danger} 100%)`
                    : `linear-gradient(90deg, ${brandColors.info} 0%, ${brandColors.primary} 100%)`,
                  borderRadius: '8px',
                  transition: 'width 0.5s ease'
                }} />
              </div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '8px',
                fontSize: '0.75rem',
                color: '#999'
              }}>
                <span>Food + Labor</span>
                <span>Target: &lt;60%</span>
              </div>
            </div>
          </div>

          {/* Charts Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr',
            gap: '24px',
            marginBottom: '32px'
          }}>
            {/* Revenue Trend Chart */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              border: '1px solid #e5e7eb',
              boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
            }}>
              <h3 style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#1a1a1a',
                letterSpacing: '0.5px',
                marginBottom: '24px',
                textTransform: 'uppercase'
              }}>
                Revenue Trend (Last 14 Days)
              </h3>
              
              <div style={{
                display: 'flex',
                alignItems: 'flex-end',
                gap: '6px',
                height: '200px',
                padding: '0 8px'
              }}>
                {chartData.map((day, idx) => {
                  const height = maxRevenue > 0 ? (day.revenue / maxRevenue * 100) : 0;
                  const isToday = idx === chartData.length - 1;
                  return (
                    <div
                      key={idx}
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '8px'
                      }}
                    >
                      <div
                        style={{
                          width: '100%',
                          height: `${Math.max(height, 4)}%`,
                          background: isToday 
                            ? `linear-gradient(180deg, ${brandColors.primary} 0%, ${brandColors.primaryDark} 100%)`
                            : day.net >= 0 
                              ? `linear-gradient(180deg, ${brandColors.success} 0%, #357a38 100%)`
                              : `linear-gradient(180deg, ${brandColors.danger} 0%, ${brandColors.dangerDark} 100%)`,
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.5s ease',
                          position: 'relative',
                          cursor: 'pointer',
                          minHeight: '8px'
                        }}
                        title={`${day.date}: ${formatCurrency(day.revenue)}`}
                      />
                      <span style={{
                        fontSize: '0.65rem',
                        color: isToday ? '#9AC636' : '#999',
                        fontWeight: isToday ? '600' : '400',
                        transform: 'rotate(-45deg)',
                        whiteSpace: 'nowrap'
                      }}>
                        {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div style={{
                display: 'flex',
                justifyContent: 'center',
                gap: '24px',
                marginTop: '20px',
                paddingTop: '16px',
                borderTop: '1px solid #f3f4f6'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: brandColors.primary, borderRadius: '3px' }} />
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>Today</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: brandColors.success, borderRadius: '3px' }} />
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>Profit Day</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', background: brandColors.danger, borderRadius: '3px' }} />
                  <span style={{ fontSize: '0.8rem', color: '#666' }}>Loss Day</span>
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}>
              {/* Avg Daily Revenue */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e5e7eb',
                flex: 1
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#666',
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}>
                  Avg Daily Revenue
                </div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: '#1a1a1a'
                }}>
                  {formatCurrency(dailySummary?.totals?.avg_daily_revenue || 0)}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: brandColors.success,
                  marginTop: '4px'
                }}>
                  📆 Based on {chartData.length} days
                </div>
              </div>

              {/* Total Expenses */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e5e7eb',
                flex: 1
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#666',
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}>
                  Total COGS
                </div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: brandColors.danger
                }}>
                  {formatCurrency(analytics.totals?.totalCOGS || 0)}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#999',
                  marginTop: '4px'
                }}>
                  🍽️ Food + Labor Combined
                </div>
              </div>

              {/* Labor Cost */}
              <div style={{
                background: '#fff',
                borderRadius: '16px',
                padding: '24px',
                border: '1px solid #e5e7eb',
                flex: 1
              }}>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#666',
                  fontFamily: 'Oswald, sans-serif',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  marginBottom: '8px'
                }}>
                  Labor Cost
                </div>
                <div style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '2rem',
                  fontWeight: '700',
                  color: brandColors.info
                }}>
                  {formatCurrency(analytics.totals?.totalLaborCost || 0)}
                </div>
                <div style={{
                  fontSize: '0.8rem',
                  color: '#999',
                  marginTop: '4px'
                }}>
                  Staff wages
                </div>
              </div>
            </div>
          </div>

          {/* Top Performers Section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
            gap: '24px'
          }}>
            {/* Champions */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              border: `2px solid ${brandColors.success}`,
              boxShadow: `0 4px 20px rgba(67,160,71,0.1)`
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>🏆</span>
                <h3 style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: brandColors.success,
                  letterSpacing: '0.5px',
                  margin: 0,
                  textTransform: 'uppercase'
                }}>
                  Top Champions
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.breakdown
                  ?.filter(item => categorizeMenuItem(item).category === 'Champions')
                  .slice(0, 5)
                  .map((item, idx) => {
                    const profit = item.net_profit ?? item.profit ?? 0;
                    return (
                      <div
                        key={item.menu_item_id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: 'rgba(67,160,71,0.08)',
                          borderRadius: '10px',
                          border: `1px solid rgba(67,160,71,0.3)`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            background: brandColors.success,
                            color: '#fff',
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'Oswald, sans-serif',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                          }}>
                            {idx + 1}
                          </span>
                          <div>
                            <div style={{ fontWeight: '600', color: brandColors.charcoal }}>
                              {item.menu_item_name || 'Unknown'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                              {item.quantity_sold || 0} sold
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontFamily: 'Oswald, sans-serif',
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          color: brandColors.success
                        }}>
                          {formatCurrency(profit)}
                        </div>
                      </div>
                    );
                  })}
                {(!analytics.breakdown || analytics.breakdown.filter(item => categorizeMenuItem(item).category === 'Champions').length === 0) && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No champions yet
                  </div>
                )}
              </div>
            </div>

            {/* Hidden Gems */}
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              padding: '24px',
              border: `2px solid ${brandColors.warning}`,
              boxShadow: `0 4px 20px rgba(255,179,0,0.1)`
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <span style={{ fontSize: '0.9rem', fontWeight: 'bold' }}></span>
                <h3 style={{
                  fontFamily: 'Oswald, sans-serif',
                  fontSize: '1.1rem',
                  fontWeight: '600',
                  color: brandColors.warning,
                  letterSpacing: '0.5px',
                  margin: 0,
                  textTransform: 'uppercase'
                }}>
                  Hidden Gems (Promote These!)
                </h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {analytics.breakdown
                  ?.filter(item => categorizeMenuItem(item).category === 'Hidden Gems')
                  .slice(0, 5)
                  .map((item, idx) => {
                    const profit = item.net_profit ?? item.profit ?? 0;
                    return (
                      <div
                        key={item.menu_item_id || idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '12px',
                          background: 'rgba(255,179,0,0.08)',
                          borderRadius: '10px',
                          border: `1px solid rgba(255,179,0,0.3)`
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{
                            background: brandColors.warning,
                            color: brandColors.charcoal,
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1rem'
                          }}>
                            
                          </span>
                          <div>
                            <div style={{ fontWeight: '600', color: brandColors.charcoal }}>
                              {item.menu_item_name || 'Unknown'}
                            </div>
                            <div style={{ fontSize: '0.8rem', color: '#666' }}>
                              Only {item.quantity_sold || 0} sold - High profit potential!
                            </div>
                          </div>
                        </div>
                        <div style={{
                          fontFamily: 'Oswald, sans-serif',
                          fontSize: '1.1rem',
                          fontWeight: '700',
                          color: brandColors.warning
                        }}>
                          {formatCurrency(profit)}
                        </div>
                      </div>
                    );
                  })}
                {(!analytics.breakdown || analytics.breakdown.filter(item => categorizeMenuItem(item).category === 'Hidden Gems').length === 0) && (
                  <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                    No hidden gems found
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Menu Analysis View */
        <div>
          {/* Menu Engineering Matrix */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            padding: '32px',
            marginBottom: '24px',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <h3 style={{
              fontFamily: 'Oswald, sans-serif',
              fontSize: '1.3rem',
              fontWeight: '600',
              color: '#1a1a1a',
              letterSpacing: '0.5px',
              marginBottom: '8px',
              textTransform: 'uppercase'
            }}>
              Menu Engineering Matrix
            </h3>
            <p style={{ color: '#666', marginBottom: '24px', fontSize: '0.9rem' }}>
              Analyze your menu items by profitability and popularity to optimize your offerings
            </p>

            {/* Legend */}
            <div style={{
              display: 'flex',
              gap: '24px',
              marginBottom: '24px',
              flexWrap: 'wrap'
            }}>
              {[
                { icon: '🏆', label: 'Champions', color: brandColors.success, desc: 'High profit, High sales' },
                { icon: '', label: 'Hidden Gems', color: brandColors.warning, desc: 'High profit, Low sales' },
                { icon: '', label: 'Volume Drivers', color: brandColors.info, desc: 'Low profit, High sales' },
                { icon: '', label: 'Needs Review', color: brandColors.danger, desc: 'Low profit, Low sales' }
              ].map(cat => (
                <div key={cat.label} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 16px',
                  background: `${cat.color}15`,
                  borderRadius: '8px',
                  border: `1px solid ${cat.color}40`
                }}>
                  <span>{cat.icon}</span>
                  <div>
                    <div style={{ fontWeight: '600', color: cat.color, fontSize: '0.85rem' }}>
                      {cat.label}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#666' }}>{cat.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Matrix Scatter Plot */}
            <div style={{
              position: 'relative',
              height: '400px',
              background: '#fafafa',
              borderRadius: '12px',
              border: '2px solid #e5e7eb',
              padding: '40px'
            }}>
              {/* Axis Labels */}
              <div style={{
                position: 'absolute',
                top: '10px',
                left: '50%',
                transform: 'translateX(-50%)',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.8rem',
                color: '#666',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                Popularity (Quantity Sold) →
              </div>
              <div style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%) rotate(-90deg)',
                fontFamily: 'Oswald, sans-serif',
                fontSize: '0.8rem',
                color: '#666',
                letterSpacing: '1px',
                textTransform: 'uppercase'
              }}>
                ← Profitability ($)
              </div>

              {/* Grid Lines */}
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '40px',
                right: '20px',
                height: '2px',
                background: '#1a1a1a'
              }} />
              <div style={{
                position: 'absolute',
                left: '50%',
                top: '40px',
                bottom: '40px',
                width: '2px',
                background: '#1a1a1a'
              }} />

              {/* Quadrant Labels */}
              <div style={{ position: 'absolute', top: '50px', left: '60px', color: brandColors.warning, fontFamily: 'Oswald', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                HIDDEN GEMS
              </div>
              <div style={{ position: 'absolute', top: '50px', right: '40px', color: brandColors.success, fontFamily: 'Oswald', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                🏆 CHAMPIONS
              </div>
              <div style={{ position: 'absolute', bottom: '50px', left: '60px', color: brandColors.danger, fontFamily: 'Oswald', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                NEEDS REVIEW
              </div>
              <div style={{ position: 'absolute', bottom: '50px', right: '40px', color: brandColors.info, fontFamily: 'Oswald', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
                VOLUME DRIVERS
              </div>

              {/* Data Points */}
              {analytics.breakdown && analytics.breakdown.length > 0 && analytics.breakdown.map((item, idx) => {
                const category = categorizeMenuItem(item);
                const profit = item.net_profit ?? item.profit ?? 0;
                const maxProfit = Math.max(...analytics.breakdown.map(i => i.net_profit ?? i.profit ?? 0), 1);
                const maxQuantity = Math.max(...analytics.breakdown.map(i => i.quantity_sold || 0), 1);

                const x = 50 + ((item.quantity_sold || 0) / maxQuantity) * 45; // 50% to 95%
                const y = 50 - (profit / maxProfit) * 40; // 10% to 50%

                return (
                  <div
                    key={item.menu_item_id || idx}
                    style={{
                      position: 'absolute',
                      left: `${x}%`,
                      top: `${y}%`,
                      transform: 'translate(-50%, -50%)',
                      width: '24px',
                      height: '24px',
                      background: category.color,
                      borderRadius: '50%',
                      border: '3px solid white',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                      cursor: 'pointer',
                      transition: 'transform 0.2s ease',
                      zIndex: 10
                    }}
                    title={`${item.menu_item_name}: ${formatCurrency(profit)} profit, ${item.quantity_sold} sold`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1.4)';
                      e.currentTarget.style.zIndex = '20';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translate(-50%, -50%) scale(1)';
                      e.currentTarget.style.zIndex = '10';
                    }}
                  />
                );
              })}
            </div>
          </div>

          {/* Detailed Table */}
          <div style={{
            background: '#fff',
            borderRadius: '16px',
            overflow: 'hidden',
            border: '1px solid #e5e7eb',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '2px solid #9AC636',
              background: '#1a1a1a'
            }}>
              <h3 style={{
                fontFamily: 'Oswald, sans-serif',
                fontSize: '1.1rem',
                fontWeight: '600',
                color: '#fff',
                letterSpacing: '0.5px',
                margin: 0,
                textTransform: 'uppercase'
              }}>
                Detailed Menu Analysis
              </h3>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f8f9fa' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Category</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Menu Item</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Qty Sold</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Revenue</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Food Cost</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Labor</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Net Profit</th>
                    <th style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '0.85rem', color: '#666', letterSpacing: '0.5px', textTransform: 'uppercase' }}>Food Cost %</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.breakdown && analytics.breakdown.length > 0 ? (
                    [...analytics.breakdown]
                      .sort((a, b) => (b.net_profit ?? b.profit ?? 0) - (a.net_profit ?? a.profit ?? 0))
                      .map((item, idx) => {
                        const category = categorizeMenuItem(item);
                        const profit = item.net_profit ?? item.profit ?? 0;
                        return (
                          <tr 
                            key={item.menu_item_id || idx}
                            style={{
                              borderBottom: '1px solid #f3f4f6',
                              transition: 'background 0.2s ease'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(154,198,54,0.05)'}
                            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                          >
                            <td style={{ padding: '14px 16px' }}>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 12px',
                                background: `${category.color}20`,
                                color: category.color,
                                borderRadius: '20px',
                                fontWeight: '600',
                                fontSize: '0.8rem'
                              }}>
                                {category.icon} {category.category}
                              </span>
                            </td>
                            <td style={{ padding: '14px 16px', fontWeight: '500' }}>{item.menu_item_name || 'Unknown'}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '1rem' }}>{item.quantity_sold || 0}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', fontFamily: 'Oswald', fontSize: '1rem' }}>{formatCurrency(item.revenue || 0)}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', color: brandColors.danger, fontFamily: 'Oswald', fontSize: '1rem' }}>{formatCurrency(item.cogs || 0)}</td>
                            <td style={{ padding: '14px 16px', textAlign: 'right', color: brandColors.info, fontFamily: 'Oswald', fontSize: '1rem' }}>{formatCurrency(item.labor_cogs || 0)}</td>
                            <td style={{ 
                              padding: '14px 16px', 
                              textAlign: 'right', 
                              fontWeight: '700',
                              color: profit >= 0 ? brandColors.success : brandColors.danger,
                              fontFamily: 'Oswald',
                              fontSize: '1.1rem'
                            }}>
                              {formatCurrency(profit)}
                            </td>
                            <td style={{ 
                              padding: '14px 16px', 
                              textAlign: 'right',
                              color: (item.food_cost_percent || 0) > 35 ? brandColors.danger : brandColors.success,
                              fontFamily: 'Oswald',
                              fontSize: '1rem'
                            }}>
                              {item.food_cost_percent || 0}%
                            </td>
                          </tr>
                        );
                      })
                  ) : (
                    <tr>
                      <td colSpan={8} style={{ padding: '60px', textAlign: 'center', color: '#999' }}>
                        No menu item data available for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
