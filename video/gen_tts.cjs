// Generate narasi per scene via ElevenLabs (with-timestamps) -> audio/sN.mp3 + narration.js
// Key disuntik proxy; header dummy. Pakai: node gen_tts.cjs [voiceId]
const fs = require('fs'), path = require('path'), { spawnSync } = require('child_process');
const VOICE = process.argv[2] || 'nPczCjzI2devNBz1zQrb'; // Brian: dalam, tenang
const MODEL = 'eleven_multilingual_v2';
// [ucapan, teks subtitle] per potongan
const S = {
  s1: [['Apakah kesempatan untuk hidup di Indonesia','Apakah kesempatan untuk hidup di Indonesia'],['bergantung pada tebalnya dompet?','bergantung pada tebalnya dompet?']],
  s2: [['L A, tujuh belas tahun.','LA, 17 tahun.'],['Luka bakar sekitar delapan puluh persen.','Luka bakar sekitar 80 persen.'],['Ia dirawat intensif, lalu meninggal dunia.','Ia dirawat intensif, lalu meninggal dunia.'],['Kasusnya kini diproses hukum.','Kasusnya kini diproses hukum.'],['Tapi ada pertanyaan yang tertinggal:','Tapi ada pertanyaan yang tertinggal:'],['apakah semua kesempatan sudah tersedia?','apakah semua kesempatan sudah tersedia?']],
  s3: [['Bagaimana jika sejak awal ia ditangani di burn center kelas dunia?','Bagaimana jika sejak awal ia ditangani di burn center kelas dunia?'],['Fasilitas, pengalaman tim, dan teknologi','Fasilitas, pengalaman tim, dan teknologi'],['memang bisa memengaruhi hasil.','memang bisa memengaruhi hasil.'],['Tapi tidak ada yang bisa memastikan','Tapi tidak ada yang bisa memastikan'],['hasilnya akan berbeda.','hasilnya akan berbeda.']],
  s4: [['Indonesia punya dokter dan rumah sakit berkompetensi tinggi.','Indonesia punya dokter dan rumah sakit berkompetensi tinggi.'],['Pertanyaannya: apakah unit luka bakar, spesialis, dan ai si yu','Pertanyaannya: apakah unit luka bakar, spesialis, dan ICU'],['bisa diakses secara merata?','bisa diakses secara merata?']],
  s5: [['Pilihan fasilitas pasien je ka en, asuransi swasta, dan pasien umum','Pilihan fasilitas pasien JKN, asuransi swasta, dan pasien umum'],['bisa berbeda.','bisa berbeda.'],['Tapi itu tidak otomatis berarti','Tapi itu tidak otomatis berarti'],['kualitas keputusan medisnya berbeda.','kualitas keputusan medisnya berbeda.']],
  s6: [['Kasus ekstrem bisa butuh ai si yu panjang, operasi berulang,','Kasus ekstrem bisa butuh ICU panjang, operasi berulang,'],['sampai dukungan organ.','sampai dukungan organ.'],['Apakah skema pembiayaan kita cukup adaptif?','Apakah skema pembiayaan kita cukup adaptif?'],['Belum ada bukti tarif menyebabkan kematian siapa pun.','Belum ada bukti tarif menyebabkan kematian siapa pun.'],['Tapi pertanyaannya sah.','Tapi pertanyaannya sah.']],
  s7: [['Tiga kesenjangan: finansial, geografis, dan teknologi.','Tiga kesenjangan: finansial, geografis, dan teknologi.']],
  s8: [['Yang perlu dibenahi: pusat rujukan khusus, sebaran spesialis,','Yang perlu dibenahi: pusat rujukan khusus, sebaran spesialis,'],['pembiayaan kasus kompleks,','pembiayaan kasus kompleks,'],['dan sistem rujukan cepat berbasis kompetensi.','dan sistem rujukan cepat berbasis kompetensi.']],
  s9: [['Ketika seorang anak berusia tujuh belas tahun menghadapi kondisi yang mengancam nyawanya, apakah kesempatan terbaik untuk bertahan hidup sudah tersedia baginya, tanpa memandang status ekonominya?','']],
  s10: [['Kesehatan adalah hak, bukan privilege.','Kesehatan adalah hak, bukan privilege.'],['Menurut kamu, sistem kesehatan kita sudah cukup adil?','Menurut kamu, sistem kesehatan kita sudah cukup adil?'],['Save, share, dan diskusikan.','Save, share, dan diskusikan.']]
};
const SETTINGS = { default: { stability: .6, similarity_boost: .75, style: 0, speed: .9 }, s9: { stability: .7, similarity_boost: .75, style: 0, speed: .8 } };
(async () => {
  fs.mkdirSync('audio', { recursive: true });
  const out = { clip: {}, subs: {} };
  for (const [id, chunks] of Object.entries(S)) {
    const text = chunks.map(c => c[0]).join(' ');
    const body = JSON.stringify({ text, model_id: MODEL, language_code: 'id', voice_settings: SETTINGS[id] || SETTINGS.default });
    // curl (bukan fetch) agar lewat proxy yang menyuntikkan API key
    const r = spawnSync('curl', ['-sS', '-f', '-X', 'POST', `https://api.elevenlabs.io/v1/text-to-speech/${VOICE}/with-timestamps?output_format=mp3_44100_128`,
      '-H', 'xi-api-key: proxy-injected', '-H', 'content-type: application/json', '-d', body], { maxBuffer: 1 << 28 });
    if (r.status !== 0) { console.error(id, 'gagal:', r.stderr.toString()); process.exit(1); }
    const j = JSON.parse(r.stdout.toString());
    fs.writeFileSync(`audio/${id}.mp3`, Buffer.from(j.audio_base64, 'base64'));
    const a = j.alignment, st = a.character_start_times_seconds, en = a.character_end_times_seconds;
    const clip = +(spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', `audio/${id}.mp3`]).stdout.toString()) || en[en.length - 1];
    out.clip[id] = +clip.toFixed(3);
    let pos = 0; const subs = [];
    chunks.forEach(([sp, sub], k) => {
      const i0 = pos, i1 = pos + sp.length - 1; pos += sp.length + 1;
      const t0 = st[Math.min(i0, st.length - 1)], t1 = en[Math.min(i1, en.length - 1)];
      if (sub) subs.push({ t0: +t0.toFixed(3), t1: +(t1 + 0.15).toFixed(3), text: sub });
    });
    out.subs[id] = subs; out[id + '_words'] = id === 's9' ? st.filter((_, i) => i === 0 || text[i - 1] === ' ').map(x => +x.toFixed(3)) : undefined;
    console.log(id, out.clip[id].toFixed(2) + 's');
  }
  fs.writeFileSync('narration.js', 'window.NARRATION=' + JSON.stringify(out) + ';\n');
})();
