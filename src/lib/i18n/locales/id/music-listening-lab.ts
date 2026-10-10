const musicListeningLab: Record<string, string> = {
  "music.lab.profiles": "Profil dengar",
  "music.lab.profilesHelp":
    "Simpan koreksi untuk setiap headphone atau speaker. Memuat hanya mengubah draf; jalur keluaran dan batas volume tetap. Terapkan untuk mendengar.",
  "music.lab.profileName": "Nama profil",
  "music.lab.saveProfile": "Simpan draf sebagai profil",
  "music.lab.selectProfile": "Pilih profil",
  "music.lab.loadProfile": "Muat ke draf",
  "music.lab.delete": "Hapus",
  "music.lab.response": "Respons equalizer terhitung",
  "music.lab.curveHelp":
    "Respons EQ pada {rate} kHz, sebelum preamp. Garis penuh: draf. Putus-putus: pengaturan diterapkan. Ini perhitungan, bukan pengukuran perangkat.",
  "music.lab.strength": "Kekuatan koreksi",
  "music.lab.strengthHelp":
    "Menskalakan gain peak dan shelf. Filter pass dan notch mempertahankan bentuknya; 0% melewati semua filter parametrik.",
  "music.lab.filter": "Filter",
  "music.lab.enabled": "Aktif",
  "music.lab.peak": "Peak",
  "music.lab.lowShelf": "Low shelf",
  "music.lab.highShelf": "High shelf",
  "music.lab.lowPass": "Low pass",
  "music.lab.highPass": "High pass",
  "music.lab.notch": "Notch",
  "music.lab.addFilter": "Tambah filter",
  "music.lab.headroomHelp":
    "Headroom otomatis: {db} dB. Memperkirakan puncak gabungan dengan cadangan 0,5 dB. Preamp manual positif dapat menghabiskan cadangan ini.",
  "music.lab.importExport": "Impor / ekspor koreksi",
  "music.lab.importHelp":
    "Tempel teks filter Equalizer APO / AutoEQ. Mendukung PK, LSC, HSC, LP, HP dan NO dengan Q. Impor memakai preamp berkas dan menonaktifkan headroom otomatis. Ekspor menyertakan kekuatan dan headroom dalam teks di bawah.",
  "music.lab.correctionText": "Teks koreksi",
  "music.lab.import": "Impor ke draf",
  "music.lab.export": "Buat teks ekspor",
  "music.lab.importError":
    "Koreksi tidak valid atau tidak didukung. Gunakan 1–24 filter, 20–20.000 Hz, ±18 dB dan Q 0,1–12. Perintah pemrosesan lain tidak didukung.",
  "music.lab.preamp": "Preamp · dB",
  "music.lab.crossfeed": "Crossfeed headphone",
  "music.lab.crossfeedHelp":
    "Mencampur bagian terfilter dari setiap kanal stereo ke kanal lain untuk mengurangi pemisahan pada headphone. 0% menonaktifkan.",
  "music.lab.bypass": "Lewati DSP Harbor",
  "music.lab.bypassHelp":
    "Setelah diterapkan, melewati EQ, preamp, crossfeed, keseimbangan dan ReplayGain. Keluaran dan volume pemutaran tetap aktif. Ini tidak memverifikasi pemutaran bit-perfect.",
  "music.lab.exclusive": "Minta keluaran eksklusif",
  "music.lab.exclusiveHelp":
    "Keluaran yang didukung dapat melewati mixer sistem dan memblokir aplikasi lain. Dukungan driver bervariasi; sakelar ini meminta akses, bukan mengonfirmasinya.",
  "music.lab.sampleRate": "Laju sampel keluaran",
  "music.lab.sourceRate": "Ikuti sumber",
  "music.lab.rateHelp":
    "Tidak meminta laju tetap. Perangkat dapat menegosiasikan laju lain. Laju tetap melakukan resampling saat perlu; tidak memulihkan detail yang hilang akibat kompresi.",
  "music.lab.equalizer": "Equalizer",
  "music.lab.mode": "Mode equalizer",
  "music.lab.parametric": "Parametrik · hingga 24 filter",
};
export default musicListeningLab;
