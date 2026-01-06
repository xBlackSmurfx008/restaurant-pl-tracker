/**
 * Core calculation engine for restaurant P&L
 */

/**
 * Calculate cost per usage unit for an ingredient
 * @param {number} purchasePrice - Price paid for purchase unit
 * @param {number} conversionFactor - How many usage units in 1 purchase unit
 * @param {number} yieldPercent - Yield percentage (0.0 to 1.0)
 * @returns {number} Cost per usage unit
 */
function calculateCostPerUnit(purchasePrice, conversionFactor, yieldPercent = 1.0) {
  if (conversionFactor <= 0 || yieldPercent <= 0) {
    return 0;
  }
  return purchasePrice / (conversionFactor * yieldPercent);
}

/**
 * Calculate total plate cost from recipe
 * @param {Array} recipeItems - Array of {ingredient_id, quantity_used, cost_per_unit}
 * @param {number} qFactor - Flat fee for misc items
 * @returns {number} Total plate cost
 */
function calculatePlateCost(recipeItems, qFactor = 0) {
  if (!Array.isArray(recipeItems)) {
    return parseFloat(qFactor) || 0;
  }
  
  const ingredientCost = recipeItems.reduce((sum, item) => {
    const costPerUnit = parseFloat(item.cost_per_unit) || 0;
    const quantity = parseFloat(item.quantity_used) || 0;
    return sum + (costPerUnit * quantity);
  }, 0);
  
  const q = parseFloat(qFactor) || 0;
  const total = ingredientCost + q;
  
  // Ensure we return a valid number
  return isNaN(total) ? 0 : total;
}

/**
 * Calculate labor cost per plate
 * @param {number} prepTimeMinutes - Estimated prep time in minutes
 * @param {number} hourlyWage - Hourly wage rate (default from env or 15.00)
 * @returns {number} Labor cost per plate
 */
function calculateLaborCost(prepTimeMinutes = 0, hourlyWage = null) {
  const wage = hourlyWage || parseFloat(process.env.HOURLY_WAGE || '15.00');
  if (prepTimeMinutes <= 0) return 0;
  return (prepTimeMinutes / 60) * wage;
}

/**
 * Calculate profitability metrics
 * @param {number} sellingPrice - Menu item selling price
 * @param {number} plateCost - Total cost to make the plate (food cost)
 * @param {number} laborCost - Labor cost per plate (optional)
 * @returns {Object} Profitability metrics
 */
function calculateProfitability(sellingPrice, plateCost, laborCost = 0) {
  // Ensure all inputs are valid numbers
  const price = parseFloat(sellingPrice) || 0;
  const cost = parseFloat(plateCost) || 0;
  const labor = parseFloat(laborCost) || 0;
  
  const primeCost = cost + labor; // Food cost + Labor cost
  const grossProfit = price - cost; // Profit before labor
  const netProfit = price - primeCost; // Profit after labor
  const foodCostPercent = price > 0 ? (cost / price) * 100 : 0;
  const primeCostPercent = price > 0 ? (primeCost / price) * 100 : 0;
  const profitMargin = price > 0 ? (grossProfit / price) * 100 : 0;
  const netProfitMargin = price > 0 ? (netProfit / price) * 100 : 0;

  // Ensure all values are numbers before calling toFixed
  const safeToFixed = (value) => {
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  return {
    grossProfit: parseFloat(safeToFixed(grossProfit).toFixed(2)),
    netProfit: parseFloat(safeToFixed(netProfit).toFixed(2)),
    foodCostPercent: parseFloat(safeToFixed(foodCostPercent).toFixed(2)),
    primeCostPercent: parseFloat(safeToFixed(primeCostPercent).toFixed(2)),
    profitMargin: parseFloat(safeToFixed(profitMargin).toFixed(2)),
    netProfitMargin: parseFloat(safeToFixed(netProfitMargin).toFixed(2)),
    laborCost: parseFloat(safeToFixed(labor).toFixed(2)),
    primeCost: parseFloat(safeToFixed(primeCost).toFixed(2))
  };
}

/**
 * Calculate time-based P&L aggregates
 * @param {Array} salesData - Array of {quantity_sold, selling_price, plate_cost}
 * @returns {Object} Aggregated P&L metrics
 */
function calculateTimeBasedPL(salesData) {
  let totalRevenue = 0;
  let totalCOGS = 0;
  let totalQuantity = 0;

  salesData.forEach(sale => {
    const revenue = sale.quantity_sold * sale.selling_price;
    const cogs = sale.quantity_sold * sale.plate_cost;
    
    totalRevenue += revenue;
    totalCOGS += cogs;
    totalQuantity += sale.quantity_sold;
  });

  const netProfit = totalRevenue - totalCOGS;
  const globalFoodCostPercent = totalRevenue > 0 
    ? (totalCOGS / totalRevenue) * 100 
    : 0;

  return {
    totalRevenue: parseFloat(totalRevenue.toFixed(2)),
    totalCOGS: parseFloat(totalCOGS.toFixed(2)),
    netProfit: parseFloat(netProfit.toFixed(2)),
    totalQuantity,
    globalFoodCostPercent: parseFloat(globalFoodCostPercent.toFixed(2))
  };
}

/**
 * Common unit conversion factors (pre-filled library)
 * This helps suggest conversions to users
 */
const UNIT_CONVERSIONS = {
  // Weight conversions (to grams as base)
  'lb': { 'oz': 16, 'g': 453.592, 'kg': 0.453592 },
  'oz': { 'lb': 0.0625, 'g': 28.3495, 'kg': 0.0283495 },
  'g': { 'oz': 0.035274, 'lb': 0.00220462, 'kg': 0.001 },
  'kg': { 'g': 1000, 'oz': 35.274, 'lb': 2.20462 },
  
  // Volume conversions (to fluid ounces as base)
  'gal': { 'fl oz': 128, 'cup': 16, 'tbsp': 256, 'tsp': 768, 'ml': 3785.41, 'l': 3.78541 },
  'fl oz': { 'gal': 0.0078125, 'cup': 0.125, 'tbsp': 2, 'tsp': 6, 'ml': 29.5735, 'l': 0.0295735 },
  'cup': { 'fl oz': 8, 'gal': 0.0625, 'tbsp': 16, 'tsp': 48, 'ml': 236.588, 'l': 0.236588 },
  'tbsp': { 'fl oz': 0.5, 'cup': 0.0625, 'tsp': 3, 'ml': 14.7868, 'l': 0.0147868 },
  'tsp': { 'fl oz': 0.166667, 'cup': 0.0208333, 'tbsp': 0.333333, 'ml': 4.92892, 'l': 0.00492892 },
  'ml': { 'fl oz': 0.033814, 'cup': 0.00422675, 'tbsp': 0.067628, 'tsp': 0.202884, 'l': 0.001 },
  'l': { 'ml': 1000, 'fl oz': 33.814, 'cup': 4.22675, 'tbsp': 67.628, 'tsp': 202.884 },
  
  // Count-based (no conversion needed, just 1:1)
  'each': { 'each': 1 },
  'piece': { 'piece': 1 },
  'unit': { 'unit': 1 }
};

/**
 * Suggest conversion factor between two units
 * @param {string} fromUnit - Purchase unit
 * @param {string} toUnit - Usage unit
 * @returns {number|null} Conversion factor or null if not found
 */
function suggestConversion(fromUnit, toUnit) {
  const fromLower = fromUnit.toLowerCase().trim();
  const toLower = toUnit.toLowerCase().trim();

  // Direct match
  if (UNIT_CONVERSIONS[fromLower] && UNIT_CONVERSIONS[fromLower][toLower]) {
    return UNIT_CONVERSIONS[fromLower][toLower];
  }

  // Try to find common base unit (e.g., both convert to grams)
  // This is a simplified version - could be expanded
  return null;
}

module.exports = {
  calculateCostPerUnit,
  calculatePlateCost,
  calculateProfitability,
  calculateLaborCost,
  calculateTimeBasedPL,
  suggestConversion,
  UNIT_CONVERSIONS
};

