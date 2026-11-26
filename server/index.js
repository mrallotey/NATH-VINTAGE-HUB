import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';

const { Pool } = pg;
const app = express();
// Render terminates TLS and forwards requests through its trusted proxy.
app.set('trust proxy', 1);
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const PORT = process.env.PORT || 10000;
const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').toLowerCase().trim();
const SETUP_TOKEN = process.env.OWNER_SETUP_TOKEN || '';
const JWT_SECRET = process.env.JWT_SECRET || '';
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'https://nath-vintage-hub.onrender.com';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!process.env.DATABASE_URL || !OWNER_EMAIL || !SETUP_TOKEN || !JWT_SECRET) {
  console.error('Missing required DATABASE_URL, OWNER_EMAIL, OWNER_SETUP_TOKEN or JWT_SECRET environment variable.');
  process.exit(1);
}

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: FRONTEND_ORIGIN.split(',').map(v => v.trim()), credentials: true }));
app.use(express.json({ limit: '7mb' }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false }));

async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'owner' CHECK (role IN ('owner','admin')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_login_at TIMESTAMPTZ
  )`);
  await pool.query(`CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL, category TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '', price NUMERIC(12,2),
    image_url TEXT NOT NULL DEFAULT '', image_urls JSONB NOT NULL DEFAULT '[]'::jsonb, is_published BOOLEAN NOT NULL DEFAULT TRUE,
    is_available BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`);
  await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS image_urls JSONB NOT NULL DEFAULT '[]'::jsonb");
  await pool.query('CREATE INDEX IF NOT EXISTS products_public_listing_idx ON products (is_published, is_available, category, created_at DESC)');
  // One-time temporary admin provisioning. Remove these Render env vars after the account is created.
  const tempAdminEmail = (process.env.TEMP_ADMIN_EMAIL || '').toLowerCase().trim();
  const tempAdminPassword = process.env.TEMP_ADMIN_PASSWORD || '';
  if (tempAdminEmail && tempAdminPassword) {
    const { rows: existingTempAdmin } = await pool.query('SELECT id FROM admin_users WHERE email=$1', [tempAdminEmail]);
    if (!existingTempAdmin.length) {
      const tempHash = await bcrypt.hash(tempAdminPassword, 12);
      await pool.query("INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,'admin')", [tempAdminEmail, tempHash]);
      console.log('Temporary admin account provisioned.');
    }
  }

}

function auth(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  try {
    if (!token) throw new Error('Missing token');
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Please sign in again.' });
  }
}
const clean = v => typeof v === 'string' ? v.trim() : '';
function productInput(body) {
  const name = clean(body.name), category = clean(body.category);
  if (!name || !category) return { error: 'Product name and category are required.' };
  const price = body.price === '' || body.price == null ? null : Number(body.price);
  if (price !== null && (!Number.isFinite(price) || price < 0)) return { error: 'Enter a valid price.' };
  const imageUrl = clean(body.image_url);
  const imageUrls = Array.isArray(body.image_urls) ? [...new Set(body.image_urls.map(clean).filter(Boolean))] : (imageUrl ? [imageUrl] : []);
  if (imageUrl && !/^https:\/\//i.test(imageUrl)) return { error: 'Product image must use a secure https:// URL.' };
  if (imageUrls.some(url => !/^https:\/\//i.test(url))) return { error: 'All product images must use secure https:// URLs.' };
  if (imageUrls.length > 12) return { error: 'A product can have up to 12 photos.' };
  return { values: [name, category, clean(body.description), price, imageUrls[0] || imageUrl, JSON.stringify(imageUrls), body.is_published !== false, body.is_available !== false] };
}

app.get('/api/health', async (_req, res) => {
  try { await pool.query('SELECT 1'); res.json({ ok: true, service: 'nath-vintage-api', database: 'connected' }); }
  catch { res.status(503).json({ ok: false, database: 'unavailable' }); }
});
app.get('/api/products', async (_req, res) => {
  res.set('Cache-Control', 'no-store, max-age=0');
  try {
    const { rows } = await pool.query(`SELECT id, name, category, description, price, image_url, image_urls, is_available
      FROM products
      WHERE is_published = TRUE AND is_available = TRUE
      ORDER BY created_at DESC`);
    res.json({ products: rows, count: rows.length });
  } catch (err) {
    console.error('Public product catalogue query failed:', err.message);
    res.status(500).json({ error: 'Could not load products.' });
  }
});
app.get('/api/auth/setup-status', async (_req, res) => {
  const { rows } = await pool.query('SELECT EXISTS(SELECT 1 FROM admin_users) AS claimed');
  res.json({ claimed: rows[0].claimed, ownerEmail: OWNER_EMAIL });
});
app.post('/api/auth/setup', async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const setupToken = typeof req.body.setupToken === 'string' ? req.body.setupToken : '';
    if (email !== OWNER_EMAIL || setupToken.length !== SETUP_TOKEN.length || setupToken !== SETUP_TOKEN) return res.status(403).json({ error: 'Setup details are not valid.' });
    if (password.length < 12) return res.status(400).json({ error: 'Use a password with at least 12 characters.' });
    const { rows: existing } = await pool.query('SELECT id FROM admin_users LIMIT 1');
    if (existing.length) return res.status(409).json({ error: 'Owner setup has already been completed.' });
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await pool.query('INSERT INTO admin_users(email,password_hash,role) VALUES($1,$2,\'owner\') RETURNING id,email,role', [email, hash]);
    res.status(201).json({ message: 'Owner account created. You can now sign in.', user: rows[0] });
  } catch (err) { console.error('setup error', err.message); res.status(500).json({ error: 'Could not complete owner setup.' }); }
});
app.post('/api/auth/login', async (req, res) => {
  try {
    const email = clean(req.body.email).toLowerCase(), password = typeof req.body.password === 'string' ? req.body.password : '';
    const { rows } = await pool.query('SELECT id,email,password_hash,role FROM admin_users WHERE email=$1', [email]);
    if (!rows.length || !(await bcrypt.compare(password, rows[0].password_hash))) return res.status(401).json({ error: 'Email or password is incorrect.' });
    await pool.query('UPDATE admin_users SET last_login_at=NOW() WHERE id=$1', [rows[0].id]);
    const user = { id: rows[0].id, email: rows[0].email, role: rows[0].role };
    const token = jwt.sign(user, JWT_SECRET, { expiresIn: '8h', issuer: 'nath-vintage-hub' });
    res.json({ token, user });
  } catch { res.status(500).json({ error: 'Sign-in is temporarily unavailable.' }); }
});
app.get('/api/admin/me', auth, (req, res) => res.json({ user: req.user }));

app.post('/api/admin/upload', auth, async (req, res) => {
  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) return res.status(503).json({ error: 'Image storage is not configured yet.' });
    const { fileName, contentType, fileBase64 } = req.body || {};
    const allowed = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    if (!allowed.has(contentType)) return res.status(400).json({ error: 'Upload a JPG, PNG, WEBP or GIF image.' });
    if (typeof fileBase64 !== 'string' || !fileBase64) return res.status(400).json({ error: 'Choose an image to upload.' });
    const buffer = Buffer.from(fileBase64, 'base64');
    if (!buffer.length || buffer.length > 5 * 1024 * 1024) return res.status(400).json({ error: 'Image must be smaller than 5 MB.' });
    const ext = ({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' })[contentType];
    const safeName = (typeof fileName === 'string' ? fileName.replace(/[^a-zA-Z0-9._-]/g, '-').slice(-80) : 'product');
    const objectPath = `products/${Date.now()}-${randomUUID()}-${safeName.replace(/\\.[^.]+$/, '')}.${ext}`;
    const upload = await fetch(`${SUPABASE_URL}/storage/v1/object/product-images/${objectPath}`, {
      method: 'POST',
      headers: {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Content-Type': contentType,
        'x-upsert': 'false'
      },
      body: buffer
    });
    if (!upload.ok) {
      const detail = await upload.text();
      console.error('Supabase image upload failed:', upload.status, detail.slice(0, 300));
      return res.status(502).json({ error: 'Supabase could not store this image. Check the storage bucket and server key.' });
    }
    res.status(201).json({ image_url: `${SUPABASE_URL}/storage/v1/object/public/product-images/${objectPath}` });
  } catch (err) {
    console.error('Image upload error:', err.message);
    res.status(500).json({ error: 'Could not upload the image.' });
  }
});

app.get('/api/admin/products', auth, async (_req, res) => {
  const { rows } = await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json({ products: rows });
});
app.post('/api/admin/products', auth, async (req, res) => {
  const parsed = productInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { rows } = await pool.query(`INSERT INTO products(name,category,description,price,image_url,image_urls,is_published,is_available)
      VALUES($1,$2,$3,$4,$5,$6::jsonb,$7,$8) RETURNING *`, parsed.values);
    res.status(201).json({ product: rows[0] });
  } catch { res.status(500).json({ error: 'Could not save product.' }); }
});
app.put('/api/admin/products/:id', auth, async (req, res) => {
  const parsed = productInput(req.body);
  if (parsed.error) return res.status(400).json({ error: parsed.error });
  try {
    const { rows } = await pool.query(`UPDATE products SET name=$1,category=$2,description=$3,price=$4,image_url=$5,image_urls=$6::jsonb,
      is_published=$7,is_available=$8,updated_at=NOW() WHERE id=$9 RETURNING *`, [...parsed.values, req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Product not found.' });
    res.json({ product: rows[0] });
  } catch { res.status(500).json({ error: 'Could not update product.' }); }
});
app.delete('/api/admin/products/:id', auth, async (req, res) => {
  const { rowCount } = await pool.query('DELETE FROM products WHERE id=$1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'Product not found.' });
  res.json({ deleted: true });
});

app.listen(PORT, async () => {
  try { await init(); console.log(`Nath Vintage Hub API listening on ${PORT}; database ready.`); }
  catch (err) { console.error('Database initialization failed:', err.message); process.exit(1); }
});
