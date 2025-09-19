// Archivo: server.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcrypt');
const session = require('express-session');
const sqlite3 = require('sqlite3').verbose();
const { sendWaterHaToken } = require('./sendToken');

const app = express();
const PORT = 3000;

// Configuración de la base de datos
const dbPath = path.resolve(__dirname, 'users.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Conectado a la base de datos de usuarios.');
});

db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      walletAddress TEXT UNIQUE,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
    console.log('Tabla de usuarios creada o ya existe.');
});

// Middlewares
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
    secret: 'tu_clave_secreta_aqui',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }
}));

// Cargar códigos
let validCodes = {};
const codesPath = path.join(__dirname, 'codes.json');
try {
    if (fs.existsSync(codesPath)) {
        const codesData = fs.readFileSync(codesPath, 'utf8');
        validCodes = JSON.parse(codesData);
    } else {
        const codesFromFile = fs.readFileSync(path.join(__dirname, 'codes.txt'), 'utf8').split('\n');
        codesFromFile.forEach(code => {
            const trimmedCode = code.trim();
            if (trimmedCode) {
                validCodes[trimmedCode] = { used: false };
            }
        });
        fs.writeFileSync(codesPath, JSON.stringify(validCodes, null, 2));
    }
} catch (error) {
    console.error("Error al cargar o crear el archivo de códigos:", error);
}

// Endpoints
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('Nombre de usuario y contraseña son requeridos.');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    db.run('INSERT INTO users (username, password) VALUES (?, ?)', [username, hashedPassword], function(err) {
        if (err) {
            return res.status(400).send('Error al registrar el usuario: ' + err.message);
        }
        res.status(200).send('Usuario registrado con éxito.');
    });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get('SELECT * FROM users WHERE username = ?', [username], async (err, user) => {
        if (err || !user) {
            return res.status(400).send('Nombre de usuario o contraseña incorrectos.');
        }
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(400).send('Nombre de usuario o contraseña incorrectos.');
        }
        req.session.userId = user.id;
        res.status(200).send('Inicio de sesión exitoso.');
    });
});

app.post('/api/wallet', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send('No autorizado.');
    }
    const { walletAddress } = req.body;
    db.run('UPDATE users SET walletAddress = ? WHERE id = ?', [walletAddress, req.session.userId], function(err) {
        if (err) {
            return res.status(500).send('Error al guardar la dirección de la billetera: ' + err.message);
        }
        res.status(200).send('Dirección de billetera guardada.');
    });
});

app.get('/api/user', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).send(null);
    }
    db.get('SELECT username, walletAddress FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err || !user) {
            return res.status(500).send('Error al obtener el perfil del usuario.');
        }
        res.status(200).json(user);
    });
});

app.post('/redeem', async (req, res) => {
    const { code, walletAddress } = req.body;
    if (!validCodes[code] || validCodes[code].used) {
        return res.status(400).send({ message: 'Código inválido o ya canjeado.' });
    }

    const success = await sendWaterHaToken(walletAddress);

    if (success) {
        validCodes[code].used = true;
        fs.writeFileSync(codesPath, JSON.stringify(validCodes, null, 2));
        res.status(200).send({ message: 'Código canjeado con éxito. ¡Revisa tu billetera!' });
    } else {
        res.status(500).send({ message: 'Error al canjear el código.' });
    }
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).send('No se pudo cerrar la sesión.');
        }
        res.status(200).send('Sesión cerrada con éxito.');
    });
});

app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
});