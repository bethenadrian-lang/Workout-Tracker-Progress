import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Database file setup
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

interface UserRecord {
  id: string;
  email: string;
  name: string;
  salt: string;
  hash: string;
  createdAt: string;
}

interface DatabaseSchema {
  users: UserRecord[];
  sessions: Record<string, { userId: string; expiresAt: number }>;
  workouts: Record<string, any[]>;
}

function loadDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      const initial: DatabaseSchema = { users: [], sessions: {}, workouts: {} };
      fs.writeFileSync(DB_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading db.json:', err);
    return { users: [], sessions: {}, workouts: {} };
  }
}

function saveDb(db: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing db.json:', err);
  }
}

// Password hashing with Node.js crypto (scrypt)
function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function verifyPassword(password: string, salt: string, storedHash: string): boolean {
  try {
    const computed = hashPassword(password, salt);
    const bufA = Buffer.from(computed, 'hex');
    const bufB = Buffer.from(storedHash, 'hex');
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// Auth Middleware
function authenticateUser(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado. Se requiere token.' });
  }

  const token = authHeader.split(' ')[1];
  const db = loadDb();
  const session = db.sessions[token];

  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      delete db.sessions[token];
      saveDb(db);
    }
    return res.status(401).json({ error: 'Sesión expirada o inválida. Inicia sesión de nuevo.' });
  }

  const user = db.users.find((u) => u.id === session.userId);
  if (!user) {
    return res.status(401).json({ error: 'Usuario no encontrado.' });
  }

  (req as any).user = user;
  (req as any).token = token;
  next();
}

// ================= API ROUTES =================

// Register
app.post('/api/auth/register', (req, res) => {
  const { email, password, name } = req.body;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ error: 'Introduce un correo electrónico válido.' });
  }

  if (!password || typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = loadDb();

  const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (existing) {
    return res.status(400).json({
      error: 'Este correo electrónico ya está registrado. Por favor, pulsa en "Iniciar sesión".',
    });
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashPassword(password, salt);
  const userId = 'usr_' + crypto.randomUUID();
  const displayName = (name && typeof name === 'string' && name.trim()) || normalizedEmail.split('@')[0];

  const newUser: UserRecord = {
    id: userId,
    email: normalizedEmail,
    name: displayName,
    salt,
    hash,
    createdAt: new Date().toISOString(),
  };

  db.users.push(newUser);

  // Create session (valid for 60 days)
  const token = 'tok_' + crypto.randomBytes(32).toString('hex');
  db.sessions[token] = {
    userId,
    expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
  };

  saveDb(db);

  return res.json({
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
    },
    token,
  });
});

// Login
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Introduce tu correo electrónico.' });
  }

  if (!password || typeof password !== 'string') {
    return res.status(400).json({ error: 'Introduce tu contraseña.' });
  }

  const normalizedEmail = email.trim().toLowerCase();
  const db = loadDb();

  const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    return res.status(401).json({
      error: 'No se encontró ninguna cuenta con este correo. Pulsa en "Crear cuenta nueva" para registrarte.',
    });
  }

  if (!verifyPassword(password, user.salt, user.hash)) {
    return res.status(401).json({
      error: 'Contraseña incorrecta. Por favor verifícala e intenta de nuevo.',
    });
  }

  const token = 'tok_' + crypto.randomBytes(32).toString('hex');
  db.sessions[token] = {
    userId: user.id,
    expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
  };

  saveDb(db);

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
  });
});

// Current User Profile / Verify Session
app.get('/api/auth/me', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  return res.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
  });
});

// Logout
app.post('/api/auth/logout', (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const db = loadDb();
    if (db.sessions[token]) {
      delete db.sessions[token];
      saveDb(db);
    }
  }
  return res.json({ success: true });
});

// Workouts: Get for user
app.get('/api/workouts', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  const db = loadDb();
  const userWorkouts = db.workouts[user.id] || [];
  return res.json({ workouts: userWorkouts });
});

// Workouts: Save for user
app.post('/api/workouts', authenticateUser, (req, res) => {
  const user = (req as any).user as UserRecord;
  const { workouts } = req.body;

  if (!Array.isArray(workouts)) {
    return res.status(400).json({ error: 'La carga útil debe ser una lista de entrenamientos.' });
  }

  const db = loadDb();
  db.workouts[user.id] = workouts;
  saveDb(db);

  return res.json({ success: true, count: workouts.length });
});

// Demo Account quick login/create helper
app.post('/api/auth/demo', (req, res) => {
  const demoEmail = 'adrian@workout.com';
  const demoPass = 'workout123';
  const db = loadDb();

  let user = db.users.find((u) => u.email.toLowerCase() === demoEmail);
  if (!user) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(demoPass, salt);
    user = {
      id: 'usr_demo_adrian',
      email: demoEmail,
      name: 'Adrián (Demo)',
      salt,
      hash,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
  }

  const token = 'tok_' + crypto.randomBytes(32).toString('hex');
  db.sessions[token] = {
    userId: user.id,
    expiresAt: Date.now() + 60 * 24 * 60 * 60 * 1000,
  };
  saveDb(db);

  return res.json({
    success: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    token,
  });
});

// ================= VITE DEV / STATIC SERVING =================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({
      server: { middlewareMode: true, hmr: process.env.DISABLE_HMR !== 'true' },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
