const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

const DATA = './data/pengaduan.json';
if (!fs.existsSync('./data')) fs.mkdirSync('./data', {recursive:true});
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, '[]');

const OPENING = `*🇮🇩 SELAMAT DATANG DI PORTAL PENGADUAN DAN ASPIRASI MASYARAKAT
YONIF TP 953/HARIMAU RAWA 🇮🇩*

Portal ini merupakan sarana komunikasi masyarakat untuk menyampaikan laporan pengaduan informasi serta aspirasi. Kami akan menerima dan menindaklanjutinya sesuai ketentuan yang berlaku

*Apakah ada yang bisa kami bantu?*

Silakan pilih layanan yang Anda perlukan:`;

const MENU = `╭━━━━━━━━━━━━━━━━━━━━╮
        🇮🇩 *MENU LAYANAN* 🇮🇩
╰━━━━━━━━━━━━━━━━━━━━╯

📋 *1. PENGADUAN*
💬 *2. ASPIRASI*
📢 *3. INFORMASI*
🔎 *4. CEK PENGADUAN*
ℹ️ *5. INFORMASI PELAYANAN*
👮 *6. HUBUNGI PETUGAS*

_Ketik angka 1–6 sesuai layanan yang Anda perlukan._

_Ketik *0* untuk kembali ke MENU._`;

const sessions = new Map();

function loadData(){ return JSON.parse(fs.readFileSync(DATA,'utf8')); }
function saveData(d){ fs.writeFileSync(DATA, JSON.stringify(d,null,2)); }
function nextId(){
  const d=loadData();
  const n=d.length+1;
  return `ADU-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`;
}

async function sendMenu(sock,jid){ await sock.sendMessage(jid,{text:OPENING}); await sock.sendMessage(jid,{text:MENU}); }
async function sendOnlyMenu(sock,jid){ await sock.sendMessage(jid,{text:MENU}); }

async function handle(sock,msg){
  if (!msg.message || msg.key.fromMe) return;
  const jid=msg.key.remoteJid;
  if (!jid || jid.endsWith('@g.us')) return;
  const text=(msg.message.conversation || msg.message.extendedTextMessage?.text || '').trim();
  if (!text) {
    return sock.sendMessage(jid,{text:`👋 Pesan Anda sudah diterima.\n\nBot dapat merespons pesan layanan. Silakan ketik *MENU* untuk menampilkan pilihan layanan.`}).then(() => sendOnlyMenu(sock,jid));
  }
  const low=text.toLowerCase();

  if(['menu','halo','hai','hi','start','mulai'].includes(low) || text==='0'){
    sessions.delete(jid); return sendMenu(sock,jid);
  }

  const state=sessions.get(jid);

  if(!state){
    if(text==='1'){
      sessions.set(jid,{mode:'complaint',step:0});
      return sock.sendMessage(jid,{text:`📝 *LAYANAN PENGADUAN*\n\nSilakan kirim pengaduan dengan format:\n\nNama:\nNo. WhatsApp:\nLokasi:\nWaktu Kejadian:\nIsi Pengaduan:\nBukti Pendukung: (jika ada)\n\nKirim dalam satu pesan.\n\nKetik *0* untuk kembali ke MENU.`});
    }
    if(text==='2'){ sessions.set(jid,{mode:'aspirasi'}); return sock.sendMessage(jid,{text:`💬 *LAYANAN ASPIRASI*\n\nSilakan tuliskan saran, masukan, atau aspirasi Anda.\n\nKetik *0* untuk kembali ke MENU.`}); }
    if(text==='3'){ sessions.set(jid,{mode:'informasi'}); return sock.sendMessage(jid,{text:`📢 *LAYANAN INFORMASI*\n\nSilakan sampaikan informasi yang ingin dilaporkan. Sertakan waktu, lokasi, kronologi, serta foto/video jika tersedia.\n\nKetik *0* untuk kembali ke MENU.`}); }
    if(text==='4'){ sessions.set(jid,{mode:'cek'}); return sock.sendMessage(jid,{text:`🔎 *CEK STATUS PENGADUAN*\n\nMasukkan Nomor Pengaduan, contoh:\n*ADU-2026-0001*\n\nKetik *0* untuk kembali ke MENU.`}); }
    if(text==='5'){ return sock.sendMessage(jid,{text:`ℹ️ *INFORMASI PELAYANAN*\n\nLayanan ini digunakan untuk menerima pengaduan, aspirasi, dan informasi masyarakat. Setiap laporan akan diterima dan ditindaklanjuti sesuai ketentuan yang berlaku.\n\nKetik *0* untuk kembali ke MENU.`}); }
    if(text==='6'){ sessions.set(jid,{mode:'petugas'}); return sock.sendMessage(jid,{text:`👮 *BANTUAN / HUBUNGI PETUGAS*\n\nSilakan tuliskan pertanyaan atau kebutuhan Anda. Pesan akan diterima oleh sistem pelayanan.\n\nKetik *0* untuk kembali ke MENU.`}); }
    // Semua chat yang bukan pilihan 1-6 tetap direspons tanpa mengubah MENU.
    return sock.sendMessage(jid,{text:`👋 Terima kasih, pesan Anda sudah kami terima.\n\nUntuk mendapatkan layanan secara otomatis, silakan pilih menu yang tersedia di bawah ini.\n\nKetik *MENU* kapan saja untuk menampilkan kembali menu layanan.`}).then(() => sendOnlyMenu(sock,jid));
  }

  if(state.mode==='complaint'){
    const id=nextId();
    const d=loadData();
    d.push({id,phone:jid.replace('@s.whatsapp.net',''),text,status:'Diterima',createdAt:new Date().toISOString()});
    saveData(d); sessions.delete(jid);
    return sock.sendMessage(jid,{text:`✅ *PENGADUAN BERHASIL DITERIMA*\n\nNomor Pengaduan:\n*${id}*\n\nPengaduan Anda telah diterima dan akan diproses sesuai ketentuan yang berlaku.\n\n📌 Simpan nomor pengaduan untuk pengecekan status.\n\nKetik *0* untuk kembali ke MENU.`});
  }

  if(state.mode==='aspirasi'){
    sessions.delete(jid); return sock.sendMessage(jid,{text:`✅ *ASPIRASI TELAH DITERIMA*\n\nTerima kasih atas aspirasi, saran, dan masukan yang Anda sampaikan.\n\nKetik *0* untuk kembali ke MENU.`});
  }

  if(state.mode==='informasi'){
    sessions.delete(jid); return sock.sendMessage(jid,{text:`✅ *INFORMASI TELAH DITERIMA*\n\nTerima kasih. Informasi Anda telah diterima oleh sistem pelayanan.\n\nKetik *0* untuk kembali ke MENU.`});
  }

  if(state.mode==='cek'){
    const d=loadData(); const found=d.find(x=>x.id.toLowerCase()===low);
    sessions.delete(jid);
    if(!found) return sock.sendMessage(jid,{text:`❌ Nomor pengaduan *${text}* tidak ditemukan.\n\nPastikan nomor yang dimasukkan benar.\n\nKetik *0* untuk kembali ke MENU.`});
    return sock.sendMessage(jid,{text:`🔎 *STATUS PENGADUAN*\n\nNomor: *${found.id}*\nStatus: *${found.status}*\nTanggal: ${new Date(found.createdAt).toLocaleString('id-ID')}\n\nKetik *0* untuk kembali ke MENU.`});
  }

  sessions.delete(jid);
  return sock.sendMessage(jid,{text:`✅ Pesan Anda telah diterima.\n\nPesan apa pun yang Anda kirim tetap akan direspons oleh bot.\n\nKetik *MENU* atau *0* untuk kembali ke MENU.`}).then(() => sendOnlyMenu(sock,jid));
}

async function start(){
  const {state,saveCreds}=await useMultiFileAuthState('./auth_info');
  const {version}=await fetchLatestBaileysVersion();
  const sock=makeWASocket({auth:state,version,logger:P({level:'silent'}),printQRInTerminal:false});
  sock.ev.on('creds.update',saveCreds);
  sock.ev.on('connection.update',({connection,lastDisconnect,qr})=>{
    if(qr){ console.log('\nSCAN QR INI DENGAN WHATSAPP > PERANGKAT TERTAUT:\n'); qrcode.generate(qr,{small:true}); }
    if(connection==='open') console.log('\nBOT WHATSAPP AKTIF ✅');
    if(connection==='close'){
      const code=lastDisconnect?.error?.output?.statusCode;
      if(code!==DisconnectReason.loggedOut) start(); else console.log('Sesi logout. Hapus folder auth_info lalu jalankan ulang.');
    }
  });
  sock.ev.on('messages.upsert',async({messages})=>{
    for(const msg of messages){ try{await handle(sock,msg);}catch(e){console.error(e);} }
  });
}
start();
