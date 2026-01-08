/**
 * Repository exports
 * Each repository encapsulates database operations for a domain
 */
const BaseRepository = require('./BaseRepository');
const VendorRepository = require('./VendorRepository');
const IngredientRepository = require('./IngredientRepository');
const MenuItemRepository = require('./MenuItemRepository');
const SalesRepository = require('./SalesRepository');
const ExpenseRepository = require('./ExpenseRepository');

// Factory function to create repositories with pool
const createRepositories = (pool) => ({
  vendors: new VendorRepository(pool),
  ingredients: new IngredientRepository(pool),
  menuItems: new MenuItemRepository(pool),
  sales: new SalesRepository(pool),
  expenses: new ExpenseRepository(pool),
});

module.exports = {
  BaseRepository,
  VendorRepository,
  IngredientRepository,
  MenuItemRepository,
  SalesRepository,
  ExpenseRepository,
  createRepositories,
};

