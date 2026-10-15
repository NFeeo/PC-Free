const SteamUser = require('steam-user');
const client = new SteamUser();

const accountName = process.env.STEAM_USER || 'KULLANICI_ADI';
const password = process.env.STEAM_PASS || 'SIFRE';
const games = [730, 440, 570]; // Saat kasılacak Oyun ID'leri (Örn: CS2=730, TF2=440, Dota 2=570)

client.logOn({
    accountName: accountName,
    password: password
});

client.on('loggedOn', () => {
    console.log('Steam hesabına başarıyla giriş yapıldı!');
    client.setPersona(SteamUser.EPersonaState.Online);
    client.gamesPlayed(games);
    console.log(`Şu oyunlarda 7/24 saat kasılıyor: ${games.join(', ')}`);
});

client.on('steamGuard', (domain, callback) => {
    console.log('Steam Guard Kodu Gerekiyor!');
    const readline = require('readline').createInterface({ input: process.stdin, output: process.stdout });
    readline.question('Steam Guard Kodunu Girin: ', (code) => {
        callback(code);
        readline.close();
    });
});

client.on('error', (err) => {
    console.log('Hata:', err);
});
