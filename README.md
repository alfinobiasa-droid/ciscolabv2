# NETLAB - Interactive Networking & Linux Learning Lab

Aplikasi belajar jaringan dan Linux berbasis web (Vite + JavaScript biasa, tanpa framework). Semua progres disimpan di localStorage dan aplikasi bisa dipakai offline (PWA).

## Isi (jumlah aktual)
- 11 modul, 57 materi (22 materi berformat detail: modul 1, 2, 3), 209 soal, 15 quest, 5 Incident Lab, 11 badge
- Topology Builder: bangun jaringan multi-perangkat (Router, Switch, PC, Server), routing dinamis, packet simulation, inspector, timeline, My Labs, Network Project, Generate Lab
- Skill Mastery dan rekomendasi belajar adaptif di Dashboard, difficulty Adaptive di Kuis
- Sandbox: Router Simulator, Switch Simulator, Linux Filesystem Simulator (bukan Debian penuh)
- Linux Installation Lab (simulasi instalasi Debian, hasilnya dipakai Linux Filesystem Simulator)
- Troubleshooting (10 kasus) dan Incident Lab (5 lab interaktif) dengan hint bertingkat
- Mode ujian, review jawaban, riwayat kuis, kalkulator subnet, cheat sheet, kamus, pencarian global
- Ekspor/impor progres, tema gelap/terang, PWA

## Menjalankan
```
npm install
npm run dev
npm run build
```

## Struktur
- index.html, src/main.js (router dan event global), src/core.js (state, storage, XP, streak harian)
- src/pages/*: dashboard, home (daftar modul), lesson, quiz, sandbox, install, quest, trouble, lab, subnet, reference (cheat dan kamus), search, settings, netview (topologi live), badges
- src/sim/engine.js (mesin simulator), src/sim/net.js (helper IP)
- src/data/*.json: modul, materi, soal, command, kamus, quest
- public/: manifest, service worker (cache netlab-v3), ikon

## Simulator (apa yang nyata dan apa yang disederhanakan)
Router, Switch, dan Linux memiliki state sendiri-sendiri. Command benar-benar mengubah state itu, dan perintah show membaca state aktual. Topologi di Dashboard dan Sandbox membaca state tersebut.
- simulate SRC DST PROTO PORT menghasilkan PACKET TRACE: interface sumber, ACL masuk, routing lookup, ACL keluar, NAT, forwarding, lalu RESULT ALLOWED atau DENIED beserta alasannya.
- NAT: tabel translasi terisi dari hasil simulate. DHCP: simulate dhcp CLIENT menjalankan DISCOVER, OFFER, REQUEST, ACK dan mengisi show ip dhcp binding.
- RIP, OSPF, dan EIGRP hanya menyimpan konfigurasi dan menampilkannya di show ip protocols. Neighbor dan route dinamis belum disimulasikan.
- Ini bukan emulator jaringan penuh. Perangkat tujuan dianggap ada bila jaringannya terhubung atau punya route.

## Mode Simulation (Packet Tracer style)
Topology Builder punya dua mode: Real time (paket langsung dikirim) dan Simulation (paket dijalankan langkah demi langkah). Di mode Simulation, buat paket (PDU) lalu pakai Play, Pause, Step, Step Back, Reset, dan atur kecepatan. Setiap baris Event List berasal dari mesin simulasi (src/sim/network.js, fungsi fwd dan pingNet):
- ARP hanya muncul jika entri belum ada di cache ARP, sehingga ping kedua tidak mengulang ARP.
- Setiap switch yang dilewati menghasilkan event dengan interface masuk/keluar dan VLAN.
- Setiap router menghasilkan event berisi tahapan: interface masuk, ACL masuk, reverse NAT, TTL, route yang dipilih, ACL keluar, NAT/PAT, dan next hop.
- Paket dibuang dengan alasan nyata (tidak ada route, ARP gagal, ACL, TTL, link DOWN).
- Event Inspector menampilkan IP, MAC, interface, next hop, TTL, tahapan, dan penjelasan, serta menyorot perangkat dan link di kanvas.
Batasan: waktu event adalah waktu virtual (bukan pengukuran). Filter hanya menghasilkan event ARP, ICMP, TCP, dan UDP; DHCP, DNS, IPv6, VLAN dan pesan protokol routing belum dimodelkan sehingga filternya dinonaktifkan. TCP dan UDP tidak memodelkan layanan di port.

## Format proyek topologi (JSON)
Ekspor dan impor dari tab Labs. Struktur:
```
{"schema":"netlab-topology","version":1,"name":"...","exportedAt":"...",
 "devices":[{"id":"d1","type":"router","kind":"router","name":"R1","x":190,"y":120,"config":{...}}],
 "links":[{"a":{"dev":"d1","port":"GigabitEthernet0/0"},"b":{"dev":"d2","port":"FastEthernet0/1"}}]}
```
Impor memvalidasi schema dan versi, jenis perangkat, kecocokan type dan kind, nama, id unik, posisi, keberadaan port, port yang dipakai dua kali, koneksi ke diri sendiri, serta IP, mask, gateway, dan DNS. Konfigurasi hanya digabung ke field yang sudah dikenal, kunci berbahaya seperti __proto__ ditolak, ukuran dibatasi (1 MB, 60 perangkat, 120 koneksi). File tidak pernah dijalankan sebagai kode. Template bawaan: Dua LAN static route, Tiga router OSPF, VLAN sekolah (demo isolasi), dan LAN dengan NAT/PAT.

## Interaksi kanvas
Shift+klik atau Shift+seret untuk memilih beberapa perangkat, seret untuk memindahkan semuanya, Delete, Ctrl+C dan Ctrl+V (menggandakan tanpa konfigurasi supaya IP tidak bentrok), Ctrl+Z dan Ctrl+Y, Ctrl+A, Esc, tanda tanya untuk bantuan, plus zoom, pan, fit, dan mini-map.

## Sistem ikon perangkat
Semua ilustrasi perangkat berasal dari satu modul, src/components/device-icons.js: 13 ikon SVG buatan sendiri (router, switch, firewall, access point, modem, internet/cloud, PC, laptop, smartphone, printer, server, DNS server, DHCP server) tanpa emoji dan tanpa gambar eksternal, sehingga tetap tampil offline. Fungsi yang dipakai ulang: devIcon (ikon mandiri), devGlyph dan devAt (di dalam SVG). Dipakai di Topology Builder, Network Activity (Dashboard dan Sandbox), diagram topologi di modul, dan Incident Lab. Untuk menambah perangkat baru, tambahkan entri di KINDS dan GLYPH.

Jenis perangkat memakai mesin simulator yang ada: router, firewall (router IOS dengan ACL), switch, serta endpoint (PC, laptop, smartphone, printer, server, DNS, DHCP, internet, access point, modem). Access point dan modem hanya endpoint (tidak meneruskan traffic), DNS dan DHCP server belum melayani DNS atau lease. Keterangan ini tampil di katalog dan Device Inspector.

Animasi hanya mengikuti hasil simulasi: link yang dilewati ping mengalirkan cahaya, LED perangkat di jalur berkedip, perangkat tempat packet berhenti berstatus Error. Semua animasi mati bila prefers-reduced-motion aktif.

## Topology Builder (multi-perangkat)
Setiap Router dan Switch memakai mesin CLI simulator yang sama dengan Sandbox (src/sim/engine.js), jadi command benar-benar mengubah state perangkat itu. Mesin jaringan (src/sim/network.js) menghubungkan perangkat:
- Segmen L2: link, status interface, VLAN access, dan trunk (allowed VLAN) menentukan perangkat mana yang satu jaringan.
- Routing: connected, static (hanya bila next hop terjangkau), serta RIP, OSPF, dan EIGRP yang dihitung dari topologi. Neighbor terbentuk bila interface satu segmen dan satu subnet, network statement cocok, area (OSPF) atau AS (EIGRP) sama, dan bukan passive-interface.
- Packet: ping dan packet TCP/UDP dikirim hop demi hop (ARP, routing lookup, ACL masuk/keluar, TTL), lalu reply dicek jalur baliknya. Hasil berhenti dengan alasan nyata (No route, ARP gagal, ACL, link DOWN, reply tidak kembali).
- Inspector, ARP, VLAN, ACL, NAT, dan DHCP dibaca dari state perangkat. ARP terisi dari packet yang benar-benar berhasil menemukan next hop.

Penyederhanaan yang disengaja (bukan emulator penuh): OSPF langsung FULL tanpa DR/BDR atau LSA flooding, cost dihitung per hop; metrik RIP berupa hop count dan metrik EIGRP disederhanakan; NAT dan DHCP di dalam topologi hanya tersimpan sebagai konfigurasi (belum menerjemahkan packet atau memberi lease ke PC); router-on-a-stick/SVI belum didukung sehingga Inter-VLAN routing tidak dinilai di Network Project.

## Linux Installation Lab
Wizard: Boot, Language, Keyboard, Network (DHCP atau static dengan validasi), Hostname, User, Partition, Bootloader, Review, lalu Install, Reboot, Login. Hanya Debian yang tersedia. Hasil instalasi (hostname, user, IP) dipakai whoami, hostname, pwd, ls, dan ip addr. Reset Installation hanya menghapus state lab dan identitas Linux hasil instalasi, bukan progres lain. XP instalasi (+100) hanya diberikan sekali.

## Learning layer (alur belajar)
Materi, praktik, kesalahan, dan hint memakai pola yang sama: Apa itu, Kenapa, Contoh, Coba, Cek, Hint bertingkat, Saya masih bingung, Solusi, Refleksi, Lanjut.
- Materi: hint 3 tingkat dan analogi setelah jawaban salah. "Try in Sandbox" membuka perangkat yang sesuai, memberi daftar command, dan tombol Cek Praktik yang membaca state simulator sungguhan.
- Sandbox: penjelasan command (Apa itu, Bagian-bagiannya, Contoh, Kesalahan umum, tombol Pakai di Input), kartu error edukatif (apa yang kamu masukkan, kenapa, contoh benar, langkah berikutnya), dan Packet Diagnosis visual (SOURCE, INTERFACE, ACL, ROUTING, NAT, DESTINATION) yang dihasilkan dari hasil simulate.
- Incident Lab: kartu persiapan lab, hint 3 tingkat, analogi.
- Linux Installation Lab: kartu troubleshooting yang sama (Secure Boot dan GRUB).
- Dashboard: Kamu sudah memahami dan Berikutnya. Modul: Skill Map Networking dan Linux (tidak mengunci apa pun).

## Motion
Transisi halaman, kartu bertahap, tekan tombol, toast, hint, dan error memakai CSS (transform dan opacity saja). Mendukung prefers-reduced-motion. Tidak ada library animasi.

## Streak harian
Streak dihitung dari hari aktif (tanggal lokal), bukan jumlah soal. Streak jawaban benar dalam kuis diberi label Correct streak.

## Format materi
Setiap langkah materi: [judul, ringkasan, command, tips, pertanyaan, pilihan, indeks jawaban, x]. Elemen x (opsional) berisi what, why, ex, res, err, practice, qwhy, cmds, table. Bila ada, halaman menampilkan Apa itu, Kenapa digunakan, Contoh situasi, Command, Hasil, Kesalahan umum, Tips, dan Praktik di Sandbox.

## Progres modul
Progres dihitung dari langkah yang benar-benar selesai. Data lama dimigrasikan otomatis (kunci lessonsV).

## Deploy
.github/workflows/deploy.yml membangun dan memasang situs ke GitHub Pages setiap push ke main (Settings > Pages > Source: GitHub Actions).

# Autonomous Bug Fixing — React/Vite

## Peran
Bertindak sebagai senior React, JavaScript, dan Vite engineer. Secara proaktif temukan dan perbaiki bug selama sesi Claude Code aktif, tanpa menunggu instruksi untuk setiap masalah.

## Aturan wajib
- Mulai sesi dengan memeriksa struktur project, package.json, Git status, dan instruksi project.
- Kenali arsitektur, komponen, routes, state management, API, serta fitur utama sebelum mengubah kode.
- Cari bug pada runtime, rendering React, state, event handler, routing, API, validasi, responsive UI, dan konfigurasi Vite.
- Prioritaskan bug yang terbukti, dapat direproduksi, dan berpengaruh terhadap fungsi aplikasi.
- Cari akar penyebab; jangan sekadar menyembunyikan error.
- Perbaiki masalah yang jelas dan aman secara langsung.
- Setelah perubahan, jalankan pemeriksaan yang relevan dan perbaiki kegagalan yang disebabkan oleh perubahan tersebut.
- Jika tersedia, jalankan lint, test, build, dan pemeriksaan TypeScript.
- Periksa kembali fitur yang berkaitan agar tidak mengalami regresi.
- Jika tidak ada bug yang terbukti, jangan mengubah kode hanya untuk terlihat produktif.

## Perlindungan project
- Periksa Git status sebelum memulai dan jangan menimpa perubahan pengguna.
- Jangan menghapus fitur, komponen, data, atau file hanya untuk membuat build lolos.
- Jangan mengubah desain atau perilaku fitur yang tidak berkaitan dengan bug.
- Jangan mengubah .env, secret, token, kredensial, atau file konfigurasi sensitif.
- Jangan menjalankan reset Git, force push, deployment, atau penghapusan data.
- Jangan melewati test atau menonaktifkan validasi untuk menyembunyikan kegagalan.
- Jika perubahan berisiko tinggi atau membutuhkan keputusan produk, jelaskan dan minta persetujuan.

## Siklus kerja
INSPECT → DETECT → REPRODUCE → ANALYZE → FIX → TEST → VERIFY.

Setelah setiap perbaikan:
1. Periksa perubahan kode.
2. Jalankan test yang relevan.
3. Jalankan lint dan build jika tersedia.
4. Periksa dampak pada fitur yang terkait.
5. Perbaiki kegagalan yang berasal dari perubahan sendiri.
6. Laporkan masalah yang masih belum terselesaikan secara jujur.

Selama sesi aktif, ketika menemukan bug tambahan yang relevan, tangani bug tersebut tanpa menunggu instruksi baru, selama aman dan sesuai ruang lingkup project.

Jangan mengklaim aplikasi sepenuhnya bebas bug hanya berdasarkan build yang berhasil.