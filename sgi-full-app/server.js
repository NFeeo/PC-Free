const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const SteamUser = require('steam-user');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const PORT = process.env.PORT || 3000;
app.use(express.static('public'));

io.on('connection', (socket) => {
    let client = null;
    let username = '';

    socket.on('login', (data) => {
        username = data.username;
        const password = data.password;

        if (!username || !password) {
            return socket.emit('login_error', 'Kullanıcı adı ve şifre gereklidir.');
        }

        if (client) { try { client.logOff(); } catch(e){} }

        client = new SteamUser();
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
        if (client) {
            client.gamesPlayed([]);
            socket.emit('idling_stopped');
        }
    });

    socket.on('start_idling_custom', (gameIds) => {
        if (client && Array.isArray(gameIds)) {
            client.gamesPlayed(gameIds);
            socket.emit('idling_updated', gameIds);
        }
    });
});

server.listen(PORT, () => {
    console.log(`Steam Game Idler Pro ${PORT} portunda çalışıyor.`);
});
