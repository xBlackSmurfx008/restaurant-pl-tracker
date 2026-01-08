/**
 * Centralized configuration with validation
 */
const { z } = require('zod');
require('dotenv').config();

// Environment schema
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5001),
  
  // Database - require DATABASE_URL or individual vars
  DATABASE_URL: z.string().optional(),
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.coerce.number().default(5432),
  DB_NAME: z.string().default('restaurant_pl'),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  
  // Supabase (optional - for file uploads)
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().default('receipts'),
  
  // App settings
  HOURLY_WAGE: z.coerce.number().default(15.00),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

// Parse and validate environment
const parseEnv = () => {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('❌ Environment validation failed:');
    console.error(result.error.flatten().fieldErrors);
    // Don't exit in development - allow app to start with defaults
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
    // Return defaults for development
    return envSchema.parse({});
  }
  
  return result.data;
};

const env = parseEnv();

// Database configuration
const getDatabaseConfig = () => {
  if (env.DATABASE_URL) {
    return {
      connectionString: env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    };
  }
  
  return {
    host: env.DB_HOST,
    port: env.DB_PORT,
    database: env.DB_NAME,
    user: env.DB_USER || process.env.USER || 'postgres',
    password: env.DB_PASSWORD || '',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  };
};

module.exports = {
  env,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  
  server: {
    port: env.PORT,
  },
  
  database: getDatabaseConfig(),
  
  supabase: {
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: env.SUPABASE_BUCKET,
    isConfigured: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
  },
  
  app: {
    hourlyWage: env.HOURLY_WAGE,
    logLevel: env.LOG_LEVEL,
  },
};

