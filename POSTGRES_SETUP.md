# PostgreSQL Setup Guide

This project uses PostgreSQL for the database. Follow these steps to set up PostgreSQL locally.

## Prerequisites

- PostgreSQL installed on your system
- Node.js and npm installed

## Installation

### macOS (using Homebrew)
```bash
brew install postgresql@15
brew services start postgresql@15
```

### Linux (Ubuntu/Debian)
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### Windows
Download and install from: https://www.postgresql.org/download/windows/

## Database Setup

1. **Create the database:**
```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE restaurant_pl;

# Exit psql
\q
```

2. **Set environment variables:**
Create a `.env` file in the root directory:
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=restaurant_pl
DB_USER=postgres
DB_PASSWORD=your_password_here
PORT=5000
```

3. **Update default password (if needed):**
```bash
# Connect to PostgreSQL
psql -U postgres

# Change password
ALTER USER postgres WITH PASSWORD 'your_password_here';
```

## Running the Application

1. **Install dependencies:**
```bash
npm run install-all
```

2. **Start the server:**
```bash
npm run dev
```

The database tables will be automatically created on first run.

## Troubleshooting

### Connection Issues

If you get connection errors:
1. Check PostgreSQL is running:
   ```bash
   # macOS/Linux
   brew services list  # or systemctl status postgresql
   ```

2. Verify credentials in `.env` file match your PostgreSQL setup

3. Check PostgreSQL is listening on the correct port:
   ```bash
   # Default is 5432
   lsof -i :5432
   ```

### Permission Issues

If you get permission errors:
```bash
# Grant permissions (run as postgres user)
psql -U postgres
GRANT ALL PRIVILEGES ON DATABASE restaurant_pl TO postgres;
```

## Database Schema

The following tables are automatically created:
- `vendors` - Vendor information
- `ingredients` - Ingredient inventory with conversions
- `menu_items` - Menu items with pricing
- `recipe_map` - Links ingredients to menu items
- `sales_log` - Daily sales records

## Migration from SQLite

If you were previously using SQLite, you'll need to:
1. Export data from SQLite (if any)
2. Set up PostgreSQL as above
3. Re-enter data through the application UI

The schema is identical, so data structure is compatible.

