import React, { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, CircularProgress } from '@mui/material';
import { Restaurant as RestaurantIcon, Lock as LockIcon } from '@mui/icons-material';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

// Flavor 91 Brand Colors (from BRANDING_GUIDE.md)
const brand = {
  green: '#9AC636',
  greenDark: '#7BA328',
  greenLight: '#B8D95A',
  charcoal: '#1A1A1A',
  dark: '#2D2D2D',
  gray: '#3D3D3D',
  lightGray: '#F5F5F5',
  white: '#FFFFFF',
  text: '#333333',
  textLight: '#666666',
  danger: '#E53935',
  warning: '#FFB300',
  success: '#43A047',
};

function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: username,
          password: password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user info
      localStorage.setItem('authToken', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));

      // Call onLogin callback
      if (onLogin) {
        onLogin(data.user, data.token);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: brand.charcoal,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background Pattern - Subtle grid */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: `
            linear-gradient(${brand.dark} 1px, transparent 1px),
            linear-gradient(90deg, ${brand.dark} 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          opacity: 0.3,
          pointerEvents: 'none',
        }}
      />

      {/* Accent glow */}
      <Box
        sx={{
          position: 'absolute',
          top: '20%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '400px',
          height: '400px',
          background: `radial-gradient(circle, ${brand.green}20 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <Paper
        elevation={24}
        sx={{
          width: '100%',
          maxWidth: 420,
          p: 5,
          mx: 2,
          borderRadius: 2,
          background: brand.white,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Top accent bar - Flavor Green */}
        <Box
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: brand.green,
          }}
        />

        {/* Logo/Icon */}
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Box
            sx={{
              width: 80,
              height: 80,
              borderRadius: 2,
              background: brand.charcoal,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 2,
              border: `3px solid ${brand.green}`,
            }}
          >
            <RestaurantIcon sx={{ fontSize: 40, color: brand.green }} />
          </Box>
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              color: brand.charcoal,
              fontFamily: "'Oswald', sans-serif",
              letterSpacing: '3px',
              textTransform: 'uppercase',
            }}
          >
            FLAVOR <span style={{ 
              background: brand.green, 
              color: brand.charcoal,
              padding: '2px 8px',
              borderRadius: '4px',
              marginLeft: '4px'
            }}>91</span>
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: brand.textLight, 
              mt: 1,
              fontFamily: "'Lato', sans-serif",
              letterSpacing: '1px',
            }}
          >
            Restaurant Management System
          </Typography>
        </Box>

        {/* Error Alert */}
        {error && (
          <Alert 
            severity="error" 
            sx={{ 
              mb: 3, 
              borderRadius: 1,
              backgroundColor: `${brand.danger}15`,
              color: brand.danger,
              '& .MuiAlert-icon': {
                color: brand.danger,
              }
            }}
          >
            {error}
          </Alert>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Username"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            sx={{
              mb: 2.5,
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Lato', sans-serif",
                borderRadius: 1,
                '&:hover fieldset': {
                  borderColor: brand.green,
                },
                '&.Mui-focused fieldset': {
                  borderColor: brand.green,
                },
              },
              '& .MuiInputLabel-root': {
                fontFamily: "'Lato', sans-serif",
                '&.Mui-focused': {
                  color: brand.green,
                }
              },
            }}
            inputProps={{
              autoComplete: 'username',
            }}
          />

          <TextField
            fullWidth
            label="Password"
            type="password"
            variant="outlined"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            sx={{
              mb: 3,
              '& .MuiOutlinedInput-root': {
                fontFamily: "'Lato', sans-serif",
                borderRadius: 1,
                '&:hover fieldset': {
                  borderColor: brand.green,
                },
                '&.Mui-focused fieldset': {
                  borderColor: brand.green,
                },
              },
              '& .MuiInputLabel-root': {
                fontFamily: "'Lato', sans-serif",
                '&.Mui-focused': {
                  color: brand.green,
                }
              },
            }}
            inputProps={{
              autoComplete: 'current-password',
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} sx={{ color: brand.charcoal }} /> : <LockIcon />}
            sx={{
              py: 1.5,
              borderRadius: 1,
              fontWeight: 600,
              fontSize: '1rem',
              fontFamily: "'Oswald', sans-serif",
              letterSpacing: '2px',
              textTransform: 'uppercase',
              backgroundColor: brand.green,
              color: brand.charcoal,
              boxShadow: `0 4px 15px ${brand.green}40`,
              '&:hover': {
                backgroundColor: brand.greenDark,
                boxShadow: `0 6px 20px ${brand.green}50`,
              },
              '&:disabled': {
                backgroundColor: brand.gray,
                color: brand.textLight,
              },
            }}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        {/* Demo Credentials Hint */}
        <Box
          sx={{
            mt: 4,
            pt: 3,
            borderTop: `1px solid ${brand.lightGray}`,
            textAlign: 'center',
          }}
        >
          <Typography 
            variant="caption" 
            sx={{ 
              color: brand.textLight,
              fontFamily: "'Lato', sans-serif",
              fontSize: '0.75rem',
            }}
          >
            Demo Credentials
          </Typography>
          <Typography 
            variant="body2" 
            sx={{ 
              color: brand.text, 
              fontFamily: "'Oswald', monospace",
              mt: 0.5,
              letterSpacing: '2px',
              fontWeight: 500,
            }}
          >
            admin / 1234
          </Typography>
        </Box>

        {/* Bottom accent */}
        <Box
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: brand.charcoal,
          }}
        />
      </Paper>
    </Box>
  );
}

export default Login;
