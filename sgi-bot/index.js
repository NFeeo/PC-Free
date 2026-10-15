const SteamUser = require('steam-user');
const readline = require('readline-sync');
const client = new SteamUser();

// SGI / Steam Ayarları
const username = readline.question('Steam Kullanici Adi: ');
const password = readline.question('Steam Sifresi: ', { hideEchoBack: true });

// Kasılacak Oyunların AppID'leri (Örn: CS2=730, TF2=440, Dota2=570)
// İstediğin kadar oyun ID'si ekleyebilirsin [730, 440, 570]
const gamesToIdle = [730, 440, 570]; 

client.logOn({
    accountName: username,
    password: password
});

client.on('loggedOn', () => {
    console.log('\n[SUCCESS] Steam hesabina basariyla giris yapildi!');
    client.setPersona(SteamUser.EPersonaState.Online);
    client.gamesPlayed(gamesToIdle);
    console.log(`[IDLE ACTIVE] Su oyunlarda 7/24 saat ve kart kasiliyor: ${gamesToIdle.join(', ')}`);
});

client.on('steamGuard', (domain, callback) => {
    const authCode = readline.question('Steam Guard / 2FA Kodunu Girin: ');
    callback(authCode);
});

client.on('error', (err) => {
    console.error('[HATA]', err.message);
});
