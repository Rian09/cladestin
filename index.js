const makeWASocket = require('@whiskeysockets/baileys').default;
const { useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const P = require('pino');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const path = require('path');

const DATA = path.join(__dirname, 'data', 'pengaduan.json');
if (!fs.existsSync(path.dirname(DATA))) fs.mkdirSync(path.dirname(DATA), { recursive: true });
if (!fs.existsSync(DATA)) fs.writeFileSync(DATA, '[]');
const db = () => JSON.parse(fs.readFileSync(DATA, 'utf8'));
const save = x => fs.writeFileSync(DATA, JSON.stringify(x, null, 2));
const sessions = new Map();

const opening = `*🇮🇩 SELAMAT DATANG DI PORTAL PENGADUAN DAN ASPIRASI MASYARAKAT\nYONIF TP 953/HARIMAU RAWA 🇮🇩*\n\nPortal ini merupakan sarana komunikasi masyarakat untuk menyampaikan laporan, pengaduan, informasi, serta aspirasi. Kami akan menerima dan menindaklanjutinya sesuai ketentuan yang berlaku\n\n*Apakah ada yang bisa kami bantu?*\n\nSilakan pilih layanan yang Anda perlukan: *MENU*`;
const menu = `🇮🇩 *PORTAL PELAYANAN MASYARAKAT* 🇮🇩\n*YONIF TP 953/HARIMAU RAWA*\n\n━━━━━━━━━━━━━━━━━━━━━━\n        *LAYANAN DIGITAL*\n━━━━━━━━━━━━━━━━━━━━━━\n\n*01 | PENGADUAN*\nMenyampaikan laporan atau pengaduan.\n\n*02 | SINERGI & ASPIRASI*\nSaran, masukan, aspirasi, dan sinergi masyarakat.\n\n*03 | INFORMASI*\nInformasi mengenai layanan yang tersedia.\n\n*04 | CEK STATUS*\nMemeriksa perkembangan pengaduan.\n\n*05 | HUBUNGI PETUGAS*\nBantuan atau informasi lebih lanjut.\n\n*06 | TENTANG PORTAL*\nInformasi mengenai portal.\n\n*07 | KEADAAN DARURAT*\nInformasi situasi darurat yang membutuhkan perhatian segera.\n\n*08 | PENGAWASAN ANGGOTA*\nMenyampaikan informasi atau laporan terkait anggota sesuai ketentuan.\n\n━━━━━━━━━━━━━━━━━━━━━━\n*Ketik 01–08 sesuai layanan.*`;

function ticket(){ const n=db().length+1; return `PGA-${new Date().getFullYear()}-${String(n).padStart(4,'0')}`; }
async function start(){
 const {state,saveCreds}=await useMultiFileAuthState(path.join(__dirname,'auth_info'));
 const sock=makeWASocket({auth:state,logger:P({level:'silent'}),printQRInTerminal:false});
 sock.ev.on('creds.update',saveCreds);
 sock.ev.on('connection.update',({connection,lastDisconnect,qr})=>{
  if(qr) qrcode.generate(qr,{small:true});
  if(connection==='open') console.log('BOT TERHUBUNG');
  if(connection==='close' && lastDisconnect?.error?.output?.statusCode!==DisconnectReason.loggedOut) start();
 });
 sock.ev.on('messages.upsert',async({messages})=>{
  const m=messages[0]; if(!m?.message||m.key.fromMe||m.key.remoteJid.endsWith('@g.us')) return;
  const jid=m.key.remoteJid;
  const text=(m.message.conversation||m.message.extendedTextMessage?.text||'').trim();
  const cmd=text.toLowerCase();
  if(cmd==='menu') { sessions.delete(jid); return sock.sendMessage(jid,{text:menu}); }
  if(!sessions.has(jid)) { await sock.sendMessage(jid,{text:opening}); return; }
  const s=sessions.get(jid);
  if(s.type==='pengawasan') await handlePengawasan(sock,jid,text,s);
  else if(s.type==='status') {
    const found=db().find(x=>x.ticket.toLowerCase()===cmd);
    await sock.sendMessage(jid,{text:found?`🔎 *STATUS PENGADUAN*\n\n🎫 Tiket: *${found.ticket}*\n📌 Status: *${found.status}*\n🕐 Diterima: ${found.createdAt}`:`❌ Nomor tiket *${text}* tidak ditemukan.`}); sessions.delete(jid);
  }
  else if(['01','1'].includes(cmd)) await sock.sendMessage(jid,{text:'📝 *LAYANAN PENGADUAN*\n\nSilakan ketik uraian pengaduan Anda.\n\nKetik *MENU* untuk kembali.'});
  else if(['02','2'].includes(cmd)) await sock.sendMessage(jid,{text:'🤝 *SINERGI & ASPIRASI*\n\nSilakan sampaikan saran, masukan, aspirasi, atau usulan sinergi Anda.'});
  else if(['03','3'].includes(cmd)) await sock.sendMessage(jid,{text:'ℹ️ *INFORMASI LAYANAN*\n\nSilakan ketik pertanyaan atau informasi yang Anda perlukan.'});
  else if(['04','4'].includes(cmd)) {sessions.set(jid,{type:'status'}); await sock.sendMessage(jid,{text:'🔎 *CEK STATUS*\n\nSilakan masukkan nomor tiket pengaduan Anda.'});}
  else if(['05','5'].includes(cmd)) await sock.sendMessage(jid,{text:'👮 *HUBUNGI PETUGAS*\n\nSilakan tuliskan keperluan atau pesan Anda.'});
  else if(['06','6'].includes(cmd)) await sock.sendMessage(jid,{text:'🇮🇩 *TENTANG PORTAL*\n\nPortal ini merupakan sarana komunikasi masyarakat untuk menyampaikan laporan, pengaduan, informasi, serta aspirasi untuk ditindaklanjuti sesuai ketentuan yang berlaku.'});
  else if(['07','7'].includes(cmd)) await sock.sendMessage(jid,{text:'🚨 *KEADAAN DARURAT*\n\n⚠️ WhatsApp ini *bukan pengganti layanan darurat resmi*. Jika keselamatan Anda atau orang lain terancam dan membutuhkan pertolongan segera, hubungi layanan darurat/instansi terkait di wilayah Anda secara langsung.\n\nJika memungkinkan, sampaikan lokasi, waktu, jenis keadaan darurat, kondisi, dan nomor yang dapat dihubungi.'});
  else if(['08','8'].includes(cmd)) { sessions.set(jid,{type:'pengawasan',step:1,data:{}}); await sock.sendMessage(jid,{text:'🇮🇩 *LAYANAN PENGAWASAN ANGGOTA*\n\n🔐 Sampaikan informasi secara jelas, objektif, dan bertanggung jawab.\n\n*1/6 — NAMA PELAPOR*\nSilakan ketik nama pelapor.'}); }
 });
}
async function handlePengawasan(sock,jid,text,s){
 if(s.step===1){s.data.namaPelapor=text;s.step=2;return sock.sendMessage(jid,{text:'*2/6 — WAKTU & LOKASI KEJADIAN*\nSilakan tuliskan waktu dan lokasi kejadian.'});}
 if(s.step===2){s.data.waktuLokasi=text;s.step=3;return sock.sendMessage(jid,{text:'*3/6 — IDENTITAS ANGGOTA*\nNama atau identitas anggota, apabila diketahui. Jika tidak diketahui, ketik *TIDAK DIKETAHUI*.'});}
 if(s.step===3){s.data.identitasAnggota=text;s.step=4;return sock.sendMessage(jid,{text:'*4/6 — URAIAN KEJADIAN*\nSilakan jelaskan kejadian secara lengkap dan kronologis.'});}
 if(s.step===4){s.data.uraian=text;s.step=5;return sock.sendMessage(jid,{text:'*5/6 — BUKTI PENDUKUNG*\nJika ada, kirim foto/dokumen yang relevan. Jika tidak ada, ketik *TIDAK ADA*.'});}
 if(s.step===5){s.data.bukti=text;s.step=6;return sock.sendMessage(jid,{text:'*6/6 — NOMOR YANG DAPAT DIHUBUNGI*\nSilakan masukkan nomor yang dapat dihubungi petugas.'});}
 if(s.step===6){s.data.nomor=text; s.ticket=ticket(); s.status='Diterima'; s.createdAt=new Date().toLocaleString('id-ID'); const arr=db(); arr.push(s); save(arr); sessions.delete(jid); return sock.sendMessage(jid,{text:`✅ *LAPORAN BERHASIL DITERIMA*\n\nTerima kasih. Informasi Anda telah berhasil diterima dan tercatat dalam sistem.\n\n🎫 *Nomor Tiket:* *${s.ticket}*\n\nSimpan nomor tiket tersebut untuk mengecek perkembangan laporan melalui menu *04 — CEK STATUS*.\n\n🇮🇩 *YONIF TP 953/HARIMAU RAWA*`});}
}
start().catch(console.error);
