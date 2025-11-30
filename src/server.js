const express = require('express');
const { spawn } = require('child_process');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    service: 'ObserveOne CLI',
    timestamp: new Date().toISOString()
  });
});

// List available commands
app.get('/commands', (req, res) => {
  res.json({
    commands: [
      'login - Authenticate with ObserveOne',
      'list - List all tests',
      'ai-check - Run AI browser check',
      'status - Check service status'
    ]
  });
});

// Execute CLI commands
app.post('/execute', async (req, res) => {
  const { command, args = [] } = req.body;
  
  if (!command) {
    return res.status(400).json({ error: 'Command is required' });
  }

  try {
    const cliPath = path.join(__dirname, '..', 'dist', 'index.js');
    const child = spawn('node', [cliPath, command, ...args], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    child.on('close', (code) => {
      res.json({
        command,
        args,
        exitCode: code,
        stdout,
        stderr,
        success: code === 0
      });
    });

    child.on('error', (error) => {
      res.status(500).json({
        error: 'Failed to execute command',
        details: error.message
      });
    });

  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      details: error.message
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`ObserveOne CLI Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
});







