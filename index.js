// index.js
const express = require('express');
const crypto = require('crypto');
const mysql = require('mysql2');
const path = require('path');

const app = express();
const port = 3000;

// middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// buat koneksi pool (lebih aman untuk production ringan)
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Elang102',      // isi sesuai konfigurasi MySQL kamu
  database: 'apikey_db',
  port: 3308,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// helper untuk menjalankan query dengan Promise
function queryPromise(sql, params = []) {
  return new Promise((resolve, reject) => {
    pool.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });
}

// Pastikan tabel ada (opsional: akan membuat tabel bila belum ada)
async function ensureTable() {
  const sql = `
    CREATE TABLE IF NOT EXISTS apikeys (
      id INT AUTO_INCREMENT PRIMARY KEY,
      key_value VARCHAR(64) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `;
  await queryPromise(sql);
}

// fungsi savekey yang menerima callback atau Promise
function savekey(key) {
  // kembali Promise agar bisa await
  const sql = 'INSERT INTO apikeys (key_value) VALUES (?)';
  return queryPromise(sql, [key]);
}

// route utama
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// POST /apikey -> generate, simpan, lalu kirim balikan
app.post('/apikey', async (req, res) => {
  try {
    // generate key
    const apiKey = crypto.randomBytes(16).toString('hex');
    console.log('Generated apiKey:', apiKey);

    // simpan ke DB (await agar response hanya dikirim jika sudah tersimpan)
    await savekey(apiKey);

    // respon ke client
    return res.json({
      message: 'API key berhasil dibuat dan disimpan',
      apiKey: apiKey
    });
  } catch (err) {
    console.error('Error di /apikey:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server saat membuat API key' });
  }
});

// GET /check?key=... -> cek validitas
app.get('/check', async (req, res) => {
  try {
    const key = req.query.key;
    if (!key) return res.status(400).json({ error: 'API key tidak ditemukan di request' });

    const sql = 'SELECT * FROM apikeys WHERE key_value = ? LIMIT 1';
    const results = await queryPromise(sql, [key]);

    if (!results || results.length === 0) {
      return res.status(401).json({ valid: false, message: 'API key tidak valid' });
    }

    return res.json({ valid: true, message: 'API key valid dan terdaftar di database' });
  } catch (err) {
    console.error('Error di /check:', err);
    return res.status(500).json({ error: 'Terjadi kesalahan server saat mengecek API key' });
  }
});


// start server: pastikan dulu tabel ada
app.listen(port, () => console.log(`🚀 Server berjalan di http://localhost:${port}`));
