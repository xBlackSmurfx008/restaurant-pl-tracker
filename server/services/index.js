/**
 * Service layer exports
 * Services contain business logic and orchestrate repositories
 */
const VendorService = require('./VendorService');
const IngredientService = require('./IngredientService');
const MenuItemService = require('./MenuItemService');
const SalesService = require('./SalesService');

/**
 * Create all services with dependencies
 * @param {Object} repositories - Repository instances
 */
const createServices = (repositories) => ({
  vendors: new VendorService(repositories.vendors),
  ingredients: new IngredientService(repositories.ingredients),
  menuItems: new MenuItemService(repositories.menuItems, repositories.ingredients),
  sales: new SalesService(repositories.sales, repositories.menuItems),
});

module.exports = {
  VendorService,
  IngredientService,
  MenuItemService,
  SalesService,
  createServices,
};

