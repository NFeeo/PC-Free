const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const SteamUser = require('steam-user');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, 'public')));

// Global oturum havuzu (Sayfa yenilense bile botlar arkaplanda 7/24 çalışmaya devam eder)
const sessions = {};

io.on('connection', (socket) => {

    // Daha önce giriş yapmış bir kullanıcı varsa otomatik bağla
    socket.on('restore_session', (username) => {
        if (sessions[username] && sessions[username].loggedIn) {
            socket.username = username;
            socket.emit('login_success', {
                username: username,
                gamesCount: sessions[username].games.length,
                idlingGames: sessions[username].idlingGames
            });
        }
    });

    socket.on('login', (data) => {
        const username = data.username;
        const password = data.password;
        socket.username = username;

        if (!username || !password) {
            return socket.emit('login_error', 'Kullanıcı adı ve şifre gereklidir.');
        }

        // Eğer bu kullanıcı zaten aktifse mevcut istemciyi kullan
        if (sessions[username] && sessions[username].client) {
            sessions[username].loggedIn = true;
            socket.emit('login_success', {
                username: username,
                gamesCount: sessions[username].games.length,
                idlingGames: sessions[username].idlingGames
            });
            return;
        }

        const client = new SteamUser();
        sessions[username] = { client, loggedIn: false, games: [], idlingGames: [] };

        client.logOn({ accountName: username, password: password });

        client.on('loggedOn', () => {
            socket.emit('login_status', 'Steam hesabına bağlanıldı. Kütüphane taranıyor...');
            client.setPersona(SteamUser.EPersonaState.Online);
        });

        client.on('licenses', () => {
            try {
                let myGames = [];
                if (client.licenses) {
                    myGames = Object.keys(client.licenses).map(id => parseInt(id)).filter(id => id > 0);
                }
                const gamesToIdle = myGames.slice(0, 32);
                if (gamesToIdle.length > 0) client.gamesPlayed(gamesToIdle);

                sessions[username].loggedIn = true;
                sessions[username].games = myGames;
                sessions[username].idlingGames = gamesToIdle;

                socket.emit('login_success', {
                    username: username,
                    gamesCount: myGames.length,
                    idlingGames: gamesToIdle
                });
            } catch (err) {
                socket.emit('login_error', 'Kütüphane hatası: ' + err.message);
            }
        });

        client.on('steamGuard', (domain, callback) => {
            socket.clientGuardCallback = callback;
            socket.emit('needs_guard', 'Steam Guard / 2FA kodu girilmelidir.');
        });

        client.on('error', (err) => {
            socket.emit('login_error', 'Steam Hatası: ' + err.message);
        });
    });

    socket.on('submit_guard', (code) => {
        if (socket.clientGuardCallback) {
            socket.clientGuardCallback(code);
        } else {
            socket.emit('login_error', 'Guard oturumu zaman aşımına uğradı.');
        }
    });

    socket.on('stop_idling', () => {
        if (socket.username && sessions[socket.username]) {
            sessions[socket.username].client.gamesPlayed([]);
            sessions[socket.username].idlingGames = [];
            socket.emit('idling_stopped');
        }
    });

    socket.on('start_idling_custom', (gameIds) => {
        if (socket.username && sessions[socket.username] && Array.isArray(gameIds)) {
            sessions[socket.username].client.gamesPlayed(gameIds);
            sessions[socket.username].idlingGames = gameIds;
            socket.emit('idling_updated', gameIds);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Steam Game Idler PRO ${PORT} portunda çalışıyor.`);
});
