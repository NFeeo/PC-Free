const express = require('express');
const bodyParser = require('body-parser');
const SteamUser = require('steam-user');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

let sessions = {};

// 1. Adım: Kullanıcı Adı ve Şifre ile Giriş
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.json({ success: false, message: 'Kullanıcı adı ve şifre zorunludur!' });
    }

    if (sessions[username] && sessions[username].client) {
        try { sessions[username].client.logOff(); } catch(e){}
    }

    const client = new SteamUser();
    sessions[username] = { client, loggedIn: false, games: [], guardCallback: null };

    let responded = false;

    client.logOn({ accountName: username, password: password });

    client.on('loggedOn', () => {
        sessions[username].loggedIn = true;
    });

    client.on('licenses', () => {
        if (responded) return;
        responded = true;

        const myGames = Object.keys(client.licenses).map(id => parseInt(id)).filter(id => id > 0);
        sessions[username].games = myGames;

        // Varsayılan olarak ilk 32 oyunu otomatik kasılmaya başlat
        const topGames = myGames.slice(0, 32);
        client.gamesPlayed(topGames);

        res.json({ success: true, step: 'dashboard', gamesCount: myGames.length });
    });

    client.on('steamGuard', (domain, callback) => {
        if (responded) return;
        responded = true;
        sessions[username].guardCallback = callback;
        res.json({ success: false, needsGuard: true, message: 'Steam Guard kodu gerekiyor.' });
    });

    client.on('error', (err) => {
        if (responded) return;
        responded = true;
        res.json({ success: false, message: 'Steam Hatası: ' + err.message });
    });

    setTimeout(() => {
        if (!responded) {
            responded = true;
            res.json({ success: false, message: 'Bağlantı zaman aşımına uğradı. Bilgileri kontrol edin.' });
        }
    }, 15000);
});

// 2. Adım: Steam Guard / 2FA Kodunu Doğrulama
app.post('/api/verify-guard', (req, res) => {
    const { username, guardCode } = req.body;
    const session = sessions[username];

    if (!session || !session.guardCallback) {
        return res.json({ success: false, message: 'Aktif bir Guard doğrulama süreci bulunamadı.' });
    }

    let responded = false;
    session.guardCallback(guardCode);

    session.client.on('licenses', () => {
        if (responded) return;
        responded = true;

        const myGames = Object.keys(session.client.licenses).map(id => parseInt(id)).filter(id => id > 0);
        session.games = myGames;

        const topGames = myGames.slice(0, 32);
        session.client.gamesPlayed(topGames);

        res.json({ success: true, step: 'dashboard', gamesCount: myGames.length });
    });

    session.client.on('error', (err) => {
        if (responded) return;
        responded = true;
        res.json({ success: false, message: 'Doğrulama Hatası: ' + err.message });
    });

    setTimeout(() => {
        if (!responded) {
            responded = true;
            res.json({ success: false, message: 'Guard kodunu doğrulama zaman aşımına uğradı.' });
        }
    }, 15000);
});

// Oyun Listesini ve Durumunu Getir
app.get('/api/games/:username', (req, res) => {
    const username = req.params.username;
    const session = sessions[username];
    if (!session || !session.loggedIn) {
        return res.json({ success: false, message: 'Oturum bulunamadı.' });
    }
    res.json({ success: true, games: session.games || [] });
});

// Oyun Kontrolleri (Durdur / Başlat)
app.post('/api/control', (req, res) => {
    const { username, action, gameIds } = req.body;
    const session = sessions[username];
    if (!session || !session.loggedIn) {
        return res.json({ success: false, message: 'Oturum açılmamış.' });
    }

    if (action === 'stopAll') {
        session.client.gamesPlayed([]);
        res.json({ success: true, message: 'Tüm oyunlar durduruldu.' });
    } else if (action === 'startAll') {
        const topGames = session.games.slice(0, 32);
        session.client.gamesPlayed(topGames);
        res.json({ success: true, games: topGames });
    } else if (action === 'setGames') {
        session.client.gamesPlayed(gameIds || []);
        res.json({ success: true });
    } else {
        res.json({ success: false, message: 'Geçersiz komut.' });
    }
});

app.listen(PORT, () => {
    console.log(`Steam Game Idler profesyonel sunucusu ${PORT} portunda çalışıyor.`);
});
