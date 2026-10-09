# Review MODEL_FISIKA — Codex

Tanggal: 9 Oktober 2026 (WIB). Objek: `docs/MODEL_FISIKA.md` versi draf v1. Reviewer hanya membuat berkas laporan ini; dokumen model, workbook, kode, dan `docs/LOG_SESI.md` tidak diubah, mengikuti aturan khusus mode reviewer dalam `AGENTS.md`.

Kesimpulan: **perlu revisi sebelum menjadi acuan implementasi domain**. Aritmetika mayoritas contoh cocok, tetapi terdapat kontradiksi MPPT, pengisian baterai, penyelesaian jaringan, dan proteksi. Parameter yang belum bersumber tidak otomatis salah; klaim validasinya harus dibatasi.

## 1. Metode, cakupan, dan sumber

Semua tujuh workbook dibaca dengan `openpyxl` secara baca-saja, termasuk nilai, formula, dan nilai cache yang tersedia. Semua contoh angka di §1–§11, validasi di §1.4/§4.3, perbandingan kabel, serta nilai acuan duplikat §13/§15 dihitung ulang dengan Python di luar proyek. Sel kosong/“Tidak tercantum” tidak diganti angka dugaan. Input PV diambil langsung dari sel workbook; persentase koefisien sudah berbentuk pecahan `1/°C`.

Definisi penilaian: **benar** berarti aljabar, satuan, dan penggunaan pada kondisi yang disebut benar; **kurang tepat** berarti pendekatan/asumsi atau syarat penting belum lengkap; **salah** berarti kontradiksi matematis/fisik atau salah mengartikan sumber. Benar secara aljabar bukan bukti model telah tervalidasi di perangkat nyata. Semua nilai U/A tanpa dukungan tetap **[PERLU VERIFIKASI]**.

| Kode | Workbook / sheet yang diperiksa | Bukti utama |
|---|---|---|
| PV | `Datasheet_Panel_Surya_Update.xlsx` / `Datasheet PV`, `Contoh REC` | STC, NOCT/NMOT, koefisien suhu, toleransi, fuse/bypass; 23 kelas daya |
| PWM | `Datasheet_SCC_PWM.xlsx` / `Datasheet RBL`, `Referensi BL915` | Nilai RBL dipisahkan dari BL915 |
| MPPT | `Datasheet_SCC_MPPT_ID.xlsx` / `Spesifikasi`, `Pengisian` | Tujuh konfigurasi; cakupan Quick Guide 300/600 W |
| BAT | `Datasheet_Battery.xlsx` / `Ringkasan`, sheet per model | 101 entri; Aokly discharge, FirstPower, TNE, MBL48, BatterySpace, seluruh Victron |
| KBL | `Datasheet_Kabel_Tembaga.xlsx` / `Datasheet`, `Perhitungan` | KHA, R maksimum, formula dan cache contoh |
| MCB | `Datasheet_MCB_AC_DC.xlsx` / `MCB AC`, `MCB DC` | Kutub/tegangan/standar/Icu/derating/batas magnetik per seri |
| KWH | `Datasheet_kWh_Meter_EXIM.xlsx` / semua empat sheet | Rasio CT, akurasi, rentang, konstanta pulsa |

Tidak ada datasheet inverter, fuse, SPD, OCV/SoC, cuaca lokal, atau kurva waktu-arus lengkap. Nilai kategori itu belum bisa dikonfirmasi dengan tujuh workbook. Pemeriksaan rumusnya memakai konsistensi aljabar, dimensi, dan sumber primer tambahan yang disebut pada temuan terkait.

Skrip dan hasil sementara (di luar `D:/MyAPP/SimPLTS`):

- [Ekstraksi workbook](C:/Users/muhab/.codex/visualizations/2026/10/09/01a11fed-c06a-7883-baa3-ac8dfba56664/extract_datasheets.py)
- [Hitung ulang](C:/Users/muhab/.codex/visualizations/2026/10/09/01a11fed-c06a-7883-baa3-ac8dfba56664/recalculate_model.py)
- [Hasil numerik lengkap](C:/Users/muhab/.codex/visualizations/2026/10/09/01a11fed-c06a-7883-baa3-ac8dfba56664/recalculation.json)

Metode numerik: maksimum kurva PV dengan golden-section 110 iterasi; bayangan dihitung per cabang sebelum/sesudah bypass agar dua puncak tidak terlewat; akar tegangan/SoC dengan bisection 90 iterasi; integral absorption dengan 100.000 interval; integral matahari dengan titik tengah tiap menit selama 24 jam, dan terbit/terbenam geometrik dihitung untuk 365 hari. Tahun nonkabisat dipakai sesuai `n=80` pada 21 Maret. Presisi internal tidak dibulatkan; tabel dibulatkan di akhir. Skrip menguji identitas I-V, jumlah 23 kelas PV, dan integral energi sederhana. Hitung ulang ini memverifikasi rumus dokumen, bukan pengukuran independen.

## 2. Penilaian setiap rumus dan aturan matematis

Baris merinci semua keluarga rumus dalam dokumen, termasuk bentuk inline, persamaan contoh yang tidak hadir sebagai blok, ambang proteksi, dan langkah solver. Beberapa persamaan yang merupakan satu identitas ditulis bersama dengan penilaian masing-masing dinyatakan eksplisit.

| No. | Temuan / penilaian rumus | Lokasi | Dampak / alasan | Usulan | Prioritas |
| --- | --- | --- | --- | --- | --- |
| 1 | Tc=Ta+(NOCT−20)G/800+fmount — kurang tepat | §1.2, baris 77–81 | Pendekatan NOCT dengan angin/pemasangan tetap. `fmount` konstan menyebabkan sel tetap 15 K di atas lingkungan saat malam; NMOT berbeban disamakan dengan NOCT. | Pakai kenaikan pemasangan yang bergantung G, bedakan NOCT/NMOT dan batas kalibrasi; [PERLU VERIFIKASI]. | sedang |
| 2 | r=G/1000; dT=Tc−25 — benar | §1.3 | Normalisasi G ke STC dan selisih suhu konsisten satuan. | Pertahankan, nyatakan G iradiasi bidang panel. | rendah |
| 3 | Vt′=(Voc_stc/L)(Tc+273.15)/298.15 — kurang tepat | §1.3 | Dimensi V benar, tetapi L=25 empiris; bukan tegangan termal fisik yang otomatis berlaku semua modul. | Kalibrasi per model/teknologi; jangan menafsirkan jumlah sel fisik sebagai sel seri efektif. | sedang |
| 4 | Isc=Isc_stc r(1+αdT) — benar | §1.3 | Pendekatan linear konsisten α Isc pada PV baris 27; valid untuk rentang G/suhu yang dibatasi. | Uji nol, rendah, dan batas suhu. | rendah |
| 5 | Imp=Imp_stc r(1+αdT) — kurang tepat | §1.3 | α berasal dari Isc, bukan koefisien Imp. Menyamakan keduanya adalah asumsi. | Nyatakan asumsi; silang-cek Imp pada NOCT/NMOT, bukan Isc saja. | sedang |
| 6 | Voc=Voc_stc(1+βdT)+Vt′ln r — kurang tepat | §1.3 | β benar dari workbook; ln r pendekatan empiris dan tak terdefinisi pada G=0; 0<G<50 belum ditentukan. | Definisikan cabang G rendah/gelap, clamp tegangan, validasi per modul. | sedang |
| 7 | Vmp=Vmp_stc[1+(γ−α)dT]+Vt′ln r — kurang tepat | §1.3 | γ−α hanya koefisien orde pertama. Hasil kali Imp×Vmp menyisakan suku α(γ−α)dT², sehingga tidak tepat mengikuti γ. Kurva maksimum dapat bergeser lagi. | Jika harus tepat mengikuti γ pada G=1000, gunakan rasio (1+γdT)/(1+αdT); validasi MPP yang benar-benar dipanen. | sedang |
| 8 | P≈P_stc r(1+γdT) — benar sebagai pendekatan | §1.7A; §1.4 suhu 65 °C | Cek linear Pmax sesuai koefisien datasheet; bukan identitas terhadap MPP kurva C1/C2. | Pisahkan hasil linear ini dari maksimum kurva dan gunakan Pmax vs Vmp × Imp yang konsisten. | sedang |
| 9 | C2=(Vmp/Voc−1)/ln(1−Imp/Isc) — benar | §1.4 | Aljabar model dua koefisien benar untuk 0<Imp<Isc dan 0<Vmp<Voc. | Tangani input degenerat/nol sebelum pembagian/log. | rendah |
| 10 | C1=(1−Imp/Isc)exp[−Vmp/(C2Voc)] — benar | §1.4 | Aljabar benar; kecil tetapi tidak nol, berpengaruh pada klaim titik kurva. | Jangan dibulatkan, gunakan expm1/log1p pada evaluator. | rendah |
| 11 | I(V)=Isc[1−C1(exp(V/(C2Voc))−1)] — kurang tepat | §1.4 | I(0)=Isc benar; I(Vmp)=Imp+IscC1, bukan Imp persis; I(Voc)=IscC1, bukan nol persis. | Ubah kata “persis”; jika titik harus tepat, fit persamaan eksponensial dengan syarat kedua endpoint. | sedang |
| 12 | V(I)=C2Voc ln[1+(1−I/Isc)/C1] — benar untuk cabang tak di-clamp | §1.4 | Benar sebagai invers aljabar; I=0 memberi tegangan sedikit melebihi Voc. Bukan invers unik setelah clamp atau pada bypass. | Pisahkan cabang normal/bypass dan tentukan batas domain/endpoint. | sedang |
| 13 | Voc,Vmp seri=Ns kali; Isc,Imp paralel=Np kali; I_array=Np I_mod(V/Ns) — benar | §1.5 | Hanya untuk modul identik, kondisi sama, tanpa rugi kabel. | Pertahankan batasan eksplisit; modul mismatch memakai solver string. | rendah |
| 14 | ΣVi(Is)=V; I_array=ΣIs — kurang tepat | §1.5 | KCL/KVL benar, tetapi model bypass diskontinu dapat memberi interval V tanpa akar; cabang invers belum mencakup arus balik. | Solver per cabang, pemeriksaan residual dan status infeasible; model arus balik tersendiri. | tinggi |
| 15 | Terminal terbuka V=Voc; amperemeter seri tanpa beban I=Isc — salah pada klaim kedua | §1.5, baris 122 | Rangkaian seri tanpa beban/terbuka membawa I=0. Isc terjadi saat meter menutup hubungan antara + dan − dengan resistansi kecil. | Ganti contoh menjadi meter sebagai shunt + ke −; hitung burden meter/fuse. | tinggi |
| 16 | Irev=(Np−1)Isc — kurang tepat; Np≤2 selalu tanpa fuse — salah | §1.5 | Batas perkiraan arus balik dari string identik, mengabaikan titik kerja/rugi/sumber baterai/grid. Tidak menjamin proteksi dua string untuk semua rating/instalasi. | Bandingkan arus balik prospektif dengan withstand panel, kabel, sumber lain dan kurva fuse; jangan menjadikan jumlah string jaminan umum. | tinggi |
| 17 | Ns Voc(Tmin)≤Vsys_max dan batas SCC/inverter — benar | §1.5 | Batas terendah dari seluruh perangkat harus dipenuhi; datasheet menyatakan rating tegangan. | Gunakan Tmin sel dan toleransi Voc; terminal/kabel/MCB juga dibatasi. | sedang |
| 18 | Geff=G[1−fsh(1−d)] — benar untuk iradiasi rata-rata; kurang tepat untuk listrik bayangan | §1.6 | Rata-rata luas benar, tetapi arus string ditentukan distribusi bayangan/sub-string, bukan luas saja. | Label model bayangan agregat; kalibrasi pola bayangan. | sedang |
| 19 | Istring>Isc → Vmod=−Vf — kurang tepat | §1.6 | Satu drop untuk seluruh modul tidak mewakili 3 dioda; bypass seluruh 3 sub-string dapat memberi −3Vf. Tidak selalu konservatif. | Model sub-string atau label keterbatasan dan jangan janjikan arah galat konservatif. | sedang |
| 20 | Vpv=Vbat_terminal+Vsw — kurang tepat | §2.2 | Benar untuk fase ON ideal tanpa kabel; kabel PV/baterai menambah drop. Saat PWM membatasi rata-rata arus, tegangan PV berosilasi. | Definisikan tegangan/arus ON vs rata-rata dan titik pengukuran. | sedang |
| 21 | Ichg=min(I_array,Ichg_max,Iaccept) — kurang tepat | §2.2 | Batas umum benar, tetapi rumus bulk berikutnya menghapus Iaccept, serta batas daya rating, suhu, dan regulator CV belum terhubung. | Satu rumus batas yang konsisten; tambah batas tegangan/arus baterai dan perilaku kelebihan rating yang bersumber. | tinggi |
| 22 | Pharvest=Vbat Ichg — benar | §2.2 | Daya di terminal baterai benar jika Vbat dan Ichg pada terminal yang sama. | Pisahkan daya PV, rugi sakelar/kabel, konsumsi internal dan daya masuk baterai. | rendah |
| 23 | Pmismatch=Pmpp−Vpv Ichg — kurang tepat | §2.2 | Dapat menjadi metrik daya tak dipanen ideal; bukan seluruh rugi PWM. Dengan switching, satu titik I-V tidak menjelaskan arus rata-rata. | Definisikan metrik; rugi VswIchg dan IselfVbat dicatat tersendiri. | sedang |
| 24 | Bulk→abs Vbat≥Vabs; abs→float tabs; float→bulk Vbat<Vrecharge; IselfVbat — kurang tepat / benar untuk hasil kali daya | §2.2–§2.3 | Transisi ideal belum sesuai 4 tahap RBL; sumber hanya memberi equalization. Proteksi LVD/LVR benar sesuai B21:B22. Iself<10 mA berarti P<0.13 W pada 13 V, bukan rating tetap. | Pisahkan equalization dan absorption, serta model waktu; pakai nilai konsumsi sebagai batas. | sedang |
| 25 | Voc tinggi ×1.2; beban 1.25×/60s,1.5×/5s; deteksi PV>16V sebagai24V — kurang tepat | §2.3 | Semua mekanisme/waktu kerusakan asumsi, tidak ada di RBL. Proteksi polaritas ada; tidak membuktikan mekanisme deteksi salah ini. | Pertahankan hanya sebagai skenario A [PERLU VERIFIKASI], jangan klaim perilaku perangkat RBL pasti. | sedang |
| 26 | Mulai MPPT jika Voc≥Vbat+ΔVstart dan Voc≥Vmin — kurang tepat | §3.2 | Mengetes Voc tanpa memastikan domain pencarian tidak kosong/ada daya; headroom saat berbeban belum dijamin. | Periksa interval, P tersedia, dan headroom operasi/restart menurut manual. | sedang |
| 27 | Pmpp=max VI dalam jendela dengan I≤Iin_max — benar sebagai optimisasi terbatas | §3.2 | Menentukan daya yang dapat diambil sambil memenuhi batas. Domain bisa kosong. | Tetapkan keluaran 0/status bila tak ada titik feasible; uji puncak bayangan dan batas arus. | sedang |
| 28 | Pin=ηtrk min(Pmpp,Ppv_max) — kurang tepat | §3.2 | Definisi rugi pelacakan dapat diterima sebagai A, tetapi titik V/I saat power clipping belum dicari; contoh §3.4 tidak mengalikan ηtrk. | Cari titik feasible yang konsisten Pin/V/I, dokumentasikan rating PV boleh oversized atau tidak. | tinggi |
| 29 | Pout=ηmax Pin−Pfix — kurang tepat | §3.2 | ηmax adalah maksimum, bukan efisiensi konstan seluruh beban; standby 2 W bukan bukti rugi tetap saat RUN. Daya bisa negatif pada cahaya rendah. | Gunakan kurva rugi/RUN/standby terpisah dan clamp/state daya nol. | sedang |
| 30 | Iout=Pout/Vbat; saat limit Pin=(Ichg_max Vbat+Pfix)/ηmax — benar secara aljabar, kurang lengkap operasinya | §3.2 | Aljabar limit benar, tetapi Pout lama belum diperbarui dan Iaccept/CV/suhu/BMS belum membatasi Iout. | Rehitung Pout=VbatIout, titik PV, dan semua batas baterai sesudah clipping. | tinggi |
| 31 | Voc_cold=Ns Voc_stc[1+β(Tmin−25)] — benar untuk G=1000 | §3.3 | β pecahan benar. Tegangan dingin 75.4044 V melampaui 75 V. Toleransi Voc/iradiasi >STC belum tercakup. | Nyatakan G/suhu sel, tambah margin/toleransi sumber; batas asap1.1 hanya A. | sedang |
| 32 | VRLA V=OCV−abs(I)(R+Rkabel)−Kk exp(−SoC/s0) — kurang tepat | §4.2 | Ohm benar; knee hanya A. Pada SoC=0, V tanpa beban cabang discharge 9.6 V sementara OCV tabel 11.6 V; tidak mengikuti keadaan istirahat. | Buat polarisasi dinamis/OCV konsisten dan kalibrasi discharge/cutoff. | tinggi |
| 33 | R(SoC)=Rfull[1+1.5(1−SoC)] — kurang tepat | §4.2 | Meningkat hingga2.5 Rfull adalah A tanpa kurva sumber, belum suhu/aging. | Label dan kalibrasi tiap model; jangan menganggap semua VRLA sama. | sedang |
| 34 | LFP V=OCV−abs(I)Rint — benar sebagai Thevenin sederhana | §4.2 | Hubungan resistif benar, tetapi kehilangan dinamika/polarisasi dan batas BMS. | Nyatakan rentang dan per model Rint. | rendah |
| 35 | Vcharge=OCV+ΔVover+IRchg; Rchg=3R atau Rint — kurang tepat | §4.2 | Aljabar tahanan benar; overpotential hanya SoC tidak bisa relaksasi. VRLA penuh memiliki OCV+over=14.45 V>float 13.7 V walau I=0. | Gunakan state polarisasi dan selesaikan I_CV=(Vset−OCV−over)/Rchg, clamp positif; selaraskan dengan penerimaan. | tinggi |
| 36 | RI²−OCV I+P=0; akar kecil I=(OCV−√(OCV²−4RP))/(2R) — salah untuk VRLA yang baru didefinisikan | §4.2 | Menghilangkan knee Kkexp dan kabel jika R tidak total. Benar hanya untuk V=OCV−IR. Pada R=0 ada pembagian0. | Gunakan E=OCV−knee, Rtotal; akar stabil 2P/(E+√(E²−4RP)); limit I=P/E saat R→0. | tinggi |
| 37 | Diskriminan<0 berarti tegangan runtuh — benar pada Thevenin/P konstan | §4.2 | Pmaks=E²/(4R); endpoint voltage/BMS dapat memutus lebih dulu. Dua akar ada bila diskriminan positif. | Pilih cabang tegangan tinggi stabil dan uji LVD sebelum collapse. | sedang |
| 38 | ΔV=kT Nsel(Tbat−25) — benar jika kT per sel dan V | §4.2 | Hasil13.52/14.10 benar; sumber menulis mV/°C pada parameter V/sel, interpretasi per-sel perlu konfirmasi. | Konversi mV→V eksplisit; sensor SCC memutuskan apakah koreksi diterapkan. | sedang |
| 39 | Ceff=Cn fT(T); ekstrapolasi0.0056/°C — kurang tepat | §4.3 | Interpolasi pada titik BAT benar. Slope0.0056 berasal segmen VRLA0–25°C, bukan berlaku semua kimia/luar rentang. | Piecewise per model, clamp/batas suhu; simpan muatan agar perubahan T tidak menciptakan energi. | sedang |
| 40 | Ieff=abs(I)(abs(I)/Iref)^(k−1); Iref=Cn/20 — benar untuk Peukert C20 | §4.3 | Aljabar normalisasi benar untuk arus konstan; LFP k=1 membuat Iref hilang. Basis C20 FirstPower tidak diketahui, MBL48 C5. | Label basis per model; model variabel arus/rekoveri perlu kalibrasi. | sedang |
| 41 | SoCdis−=Ieff dt/(3600 Ceff) — kurang tepat sebagai “SoC sebenarnya” | §4.3 | Memodelkan kapasitas tersedia laju arus, bukan penghitung coulomb murni. Mencampur SoC Peukert dengan energi tersimpan tanpa definisi rugi/recovery. | Pisahkan muatan fisik dan kapasitas tersedia; clamp 0 dan cek cutoff/neraca energi. | tinggi |
| 42 | SoCchg+=ηc I dt/(3600 Ceff); ηc piecewise — benar secara coulomb; kurang tepat klaim efisiensi energi | §4.3 | ηc coulomb berbeda round-trip Wh; ηc=.96 tidak sendiri membuktikan energi92–96%. | Definisikan rugi tegangan, resistif, coulomb dan uji integral Wh charge/discharge. | sedang |
| 43 | Iaccept=a Cn(1−SoC) — kurang tepat | §4.3 | Satuan A benar bila a per jam; tidak bergantung Vset. Mencegah CC 50 A LFP sesudah 90% dan bulk20–30A VRLA sesudah 80–70%, bertentangan narasi. | Terapkan taper di CV/absorption atau selaraskan semua contoh dengan minimum batas ini. | tinggi |
| 44 | Swa-lepas SoC−=.001 dt/86400 — kurang tepat | §4.3 | 3 poin persen per 30 hari secara linear; BAT VRLA≤3%, MBL/BatterySpace<3%; nilai persis 3% bukan kurang dari3%, dan Victron tidak memberi kan angka ini. | Parameter per model/suhu, clamp 0; jangan label LFP sama sebagai data. | sedang |
| 45 | Iaccept<.02 Cn ↔ SoC≥.98; CC→CV→Itail — kurang tepat | §4.3–§4.4 | VRLA a=1: ketat < berarti SoC>.98, bukan≥; LFP a=5 mencapai .02C pada 99.6%. Itail Victron bukan data di workbook. | Nyatakan ketaksamaan dan trigger CV berbasis tegangan; Itail per baterai A bila tidak ada. | sedang |
| 46 | Arus penyama paralel=ΔV/(R1+R2+Rkabel) — benar untuk Thevenin awal | §4.4 | Benar untuk resistansi total loop dan tegangan sumber tanpa BMS; respons dinamis diabaikan. | Tambahkan Rc dan BMS, gunakan OCV/terminal sesuai keadaan awal. | rendah |
| 47 | BMS Vover=Vcv+.2; Vunder=N Vcut; Ishort>3Idis; t 1 ms — kurang tepat / salah asal D untuk Vover | §4.5 | Cutoff discharge sebagai pack benar jika sel identik. Toleransi charge±.2V bukan ambang proteksi BMS; tak memonitor sel imbalance. Waktu/arus short A. | Pisahkan setpoint, cutoff pack, OVP/UVP tiap sel, dan spesifikasi BMS; jangan anggap BMS selalu lebih cepat MCB. | tinggi |
| 48 | Pin=Pout+P0+k1Pout+k2Pout²; η=Pout/Pin; idlePin=P0 — benar sebagai fit empiris | §5.2 | Dimensi/neraca benar pada k yang menghasilkan rugi≥0; rentang η/P0 A. | Batasi parameter fit agar rugi/η tetap fisik pada seluruh rentang. | rendah |
| 49 | a=Pr/η100−Pr−P0; b=(Pr/2)/η50−Pr/2−P0; k2=(a−2b)/(Pr²/2); k1=(b−k2Pr²/4)/(Pr/2) — benar | §5.2 | Penyelesaian dua titik efisiensi benar; ketiga tabel cocok. | Pertahankan presisi koefisien, bulatkan tampilan saja. | rendah |
| 50 | IDC=Pin/VDC; Presistif=Vac²/R — benar | §5.2–§5.3; §12 | Benar DC dan AC RMS resistif, VDC harus hasil jaringan termasuk kabel. | Tangani V=0, inverter OFF, dan pemilihan AC RMS. | rendah |
| 51 | Trip overload interpolasi log-log; LVD V<Vlvd selama tlvd, pulihV≥Vlvr — kurang tepat | §5.3 | Histeresis benar sebagai A, tetapi P/Pr=1.00 dimatikan600s padahal rating kontinu; range surge≤5s tidak konsisten titik2Pr1s dan Psurge.1s. | Perbaiki boundary tepatPr kontinu; definisikan kriteria waktu/rugi dan label asumsi tanpa datasheet. | sedang |
| 52 | Grid RUN Pdc=min(Pmpp,Pdc_max); Pac=min(Pac_r,Pdc−(P0+k1Pdc+k2Pdc²)) — kurang tepat | §6.2 | Koefisien §5.2 berbasis Pout tidak boleh langsung diterapkan sebagai basis Pdc. P0+ηpeak belum cukup menentukan dua k. Pac bisa negatif. | Fit terpisah berbasis Pdc atau invers f(Pac); clamp/RUN threshold dan aktual Pdc saat AC clipping. | tinggi |
| 53 | Grid OFF Pac=0; jendela .85–1.10Vnom,50±1Hz,tai≤2s,trecon60s — kurang tepat | §6.1–§6.2 | OFF benar untuk daya keluaran; standby tetap konsumsi. Tidak ada manual inverter/standar lengkap dalam workbook; IEC62116 metode uji bukan bukti sendiri setting seluruh inverter. | Sumberkan model/setting grid code; jangan klaim nilai60s sebagai IEC bila dokumen sendiri menyebut180s. | sedang |
| 54 | Pgrid=Pload−Pac — benar | §6.2 | Neraca di titik meter bila hanya beban dan inverter; sign impor+ sesuai §10. | Tambahkan charger/standby/beban lain saat ada. | rendah |
| 55 | Pchg_max=VbatIchg_max; Pdis_max=VbatIdis_max; SBU Pdis=f(Pload)−Ppv — benar bersyarat | §7.2 | Benar jika daya PV sesudah MPPT, tegangan terminal aktual dan f total inputDC. Pdis negatif harus menjadi charging, bukan discharge negatif. | Clamp cabang, tambah Iaccept/CV/suhu/BMS dan tegangan yang dihitung solver. | sedang |
| 56 | Pgridchg_dc=min(VbatIgridchg,Pchg_max−Pchg_pv); Pac_chg=Pgridchg_dc/ηchg — kurang tepat / benar untuk konversi kedua | §7.2 | Sisa batas bisa negatif, belum Iaccept/SoC target/CV; ηchg=.92 hanya A. | Max(0,sisa), regulator dan larangan charge-discharge simultan; rugi di neraca. | sedang |
| 57 | Ppv+Pdis+ηchgPac_chg=f(Pinv)+Pchg+Pcurtail — salah terhadap definisi Ppv aktual | §7.2 | Ppv didefinisikan daya MPPT aktual DC; daya tidak dipanen bukan daya yang masuk bus. Menambahkan curtail di kanan menghitung daya potensial sebagai aktual. f(0)=P0 juga salah bila inverter tidur saat bypass. | Gunakan Ppv_available dan explicit aktual=Pavailable−Pcurtail, atau hilangkan curtail dari neraca bus aktual; pisahkan standby. | tinggi |
| 58 | Pgrid=Pgrid_masuk−Pekspor — benar | §7.2 | Tanda sesuai meter; impor/ekspor perlu dihitung di simpul AC aktual. | Tetapkan perilaku ekspor surplus serta limit/no-export lengkap. | rendah |
| 59 | ρ(T)=ρ20[1+αCu(T−20)] — benar sebagai linear tembaga | §8.2 | Satuan dan tanda benar; T harus suhu konduktor, bukan Ta. αCu umum bukan data workbook. | Nyatakan Tcond; αCu [PERLU VERIFIKASI]. | rendah |
| 60 | Rloop=ρ(T)2L/A Kcl+NsambRc — benar bersyarat | §8.2 | Loop2L sesuai KBL untuk DC2kawat/AC1fasaPF1. Satu kabel di graf jangan masing-masing dihitung2L lagi. | Tentukan data edge satu konduktor atau pasangan loop; hitung sambungan/Rc nyata. | sedang |
| 61 | ΔV=IRloop; ΔV%=ΔV/Vsumber×100 — benar | §8.2 | KBL Perhitungan cocok; bukan umum untuk AC3fasa/reaktif. | Pertahankan batas model dan konvensi frac vs persen. | rendah |
| 62 | Iz_eff=KHA kamb kgroup — benar sebagai derating bersyarat | §8.2 | KHA per media/tabel acuan penting; KBL hanya memberi kamb PV, bukan NYY. | Jangan terapkan kamb EN50618 PV ke NYY; pilih metode instalasi lalu faktor yang sesuai. | sedang |
| 63 | Tcond=Ta+(Tmax−Tref)(I/Iz_eff)² — kurang tepat | §8.2 | Di Ta 70 PV, k=.92 dan I=Iz_eff memberi 100°C>90°C, bertentangan derating. Pada Ta35 memakai KHA 60 membuat prediksi dingin konservatif tapi tidak terkalibrasi. | Pakai model termal yang mereproduksi Tcond=Tmax pada kondisi KHA aktual tanpa menggandakan koreksi. | tinggi |
| 64 | dTcond/dt=(Tss−Tcond)/τcab — benar sebagai lag orde1 | §8.2 | Dimensi benar bila dt dan τ satuan sama; τ tabel menit, dt solver detik. | Konversi×60; tentukan solusi eksponensial atau timestep stabil, ukur τ. | sedang |
| 65 | Panas I/Iz>1.25 atauT≥Tmax; rusakT≥Tmax+20 selama60s — kurang tepat | §8.2 | Ambang/delay rusak A; Tref/KHA dapat bertentangan. Nilai steady108.4°C tidak berarti asap seketika. | Terapkan dinamika dan akumulasi60s setelah threshold; label parameter skenario. | sedang |
| 66 | x=I/In_eff; In_eff=In[1−.005(Ta−Tref)] — kurang tepat | §9.1 | Tidak memasukkan derating berdampingan yang tabelnya sudah ada; slopeA universal tidak sesuai tiap seri. Arus AC harus RMS, DC magnitude. | Gunakan faktor sumber per seri; batas positif; pisahkan threshold termal dan magnetik. | sedang |
| 67 | t_trip: ≤1.13 tak trip; titik1.13/7200,1.45/1800,2.55/20,5/6 log-log — kurang tepat | §9.1 | Model cocok sebagai A IEC 60898 rendah In, tetapi nontrip1jam tidak berarti tak trip selamanya. Tak berlaku universal IEC 60947/C120N 100 A. Diskontinuitas di1.13. | Pilih kurva per standar/In/seri, label batas waktu konvensional vs no-trip permanen. | tinggi |
| 68 | xmAC B4,C8,D14,K12,Z3; xmDC=1.4xmAC — salah sebagai aturan semua katalog | §9.1 | MCB DC C120N E68 menyatakan8In±20%; faktor 1.4 mengubah menjadi11.2In di luar9.6In. Beberapa produk memakai Ii khusus. | Gunakan threshold DC yang dinyatakan masing-masing model, jangan kalikan lagi. | tinggi |
| 69 | x≥xm→.02s — kurang tepat | §9.1 | Waktu tetap A, bukan hasil kurva sumber; perlu membedakan opening dan total clearing/busur. | Masukkan toleransi kurva/interrupt time, I²t bila diperlukan. | sedang |
| 70 | h+=dt/t_trip; triph≥1; dh/dt=−h/τcool saatx<1 — kurang tepat | §9.1–§9.2 | Dosis empiris dapat dipakai, bukan energi termal fisik. Pada1≤x≤1.13 tidak panas/tidak dingin; magnetik tidak semestinya mengintegrasikan dosis termal. | State termal tersendiri, cooldown halus, event magnetik terpisah; τcool dalamdetik. | sedang |
| 71 | Vsistem_dc>Ue per kutub; Iprospektif>Icu; ACdiDC V≥48 atauI>3In→gagal — kurang tepat | §9.1 | Ue pada workbook sering rating perangkat total kutub, tidak boleh otomatis per kutub; ratingIcu bergantung tegangan. Ambang48/3In tanpa data. | Per konfigurasi pemutusan/kutub/polaritas; perangkat tanpa ratingDC dinyatakan tidak terverifikasi pada semua tegangan. | tinggi |
| 72 | IhsPV≈Isc_array (batas1.25Isc); IhsBAT=OCV/(Rbat+Rkabel+Rc) — kurang tepat / benar Thevenin awal untuk kedua | §9.1 | Arus PV sesuai kondisi G,T;1.25 bukan hukum fisik batas iradiasi umum. Short BAT belum induktansi/BMS/knee. | Bedakan faktor desain dan aktual G; gunakan Eeff/SoC/suhu/polarisasi dan sumber lain bila relevan. | sedang |
| 73 | Kurva fuse log-log1.13/36000,…,≥20/.005; h samaMCB — kurang tepat | §9.2 | Semua titik A dan belum bisa membuktikan fuse meter cepat sama gPV. Di42In model .005s tepat, tidak <.005s. | Kurva/I²t per fuse, waktu total clearing, rating tegangan dan kapasitas pemutusan. | tinggi |
| 74 | FuseIn≤Ifuse_max; reverse≥1.35In — benar untuk batas rating pertama; kurang tepat aturan kedua | §9.2 | Ifuse_max bukan threshold trip panel.1.35 bukan jaminan universal atau waktu aman modul; kurva trainer sendiri memberi ≈6964s. | Verifikasi minimum arus gangguan vs kurva dan withstand panel/kabel; pakai katalog fuse. [Siemens, hlm.164–169](https://cache.industry.siemens.com/dl/files/810/45314810/att_829959/v1/SENTRON_Fuse_Systems_complete_English_10_2014_201502111459517016.pdf) membedakan karakteristik IEC dan produknya. | tinggi |
| 75 | gPV arus konvensional tak melebur/melebur = 1.13/1.45 In — kurang tepat sebagai pernyataan standar tanpa syarat | §9.2 tabel parameter | Pasangan ini didukung katalog Siemens edisi 2014/2015 untuk IEC saat itu, tetapi conventional time, rating, tipe fuse dan edisi standar harus ikut disebut. Angka ini bukan dua titik waktu universal dari kurva fuse meter cepat. | Sumberkan edisi IEC/kurva produk dan pisahkan gPV dari fuse alat ukur. [Siemens Photovoltaic fuses](https://cache.industry.siemens.com/dl/files/810/45314810/att_829959/v1/SENTRON_Fuse_Systems_complete_English_10_2014_201502111459517016.pdf). | sedang |
| 76 | SPD Uc≥1.2Voc_cold; wear+=1/Nmax; wear≥1 habis; Uc<Voc→terbakar — kurang tepat | §9.3 | Margin/wear diskret hanya A, bukan respons lonjakan/umur SPD. Tidak mengecek Up vs withstand perangkat atau arus, suhu, dan energi. | Label simbolis; sumberkan Uc/Up/tipe/rating koordinasi dan distribusi wear per tingkat lonjakan. | sedang |
| 77 | Eimp+=max(Pgrid,0)dt/3600; Eexp+=max(−Pgrid,0)dt/3600 — benar | §10.2 | W×detik/3600=Wh; sign EXIM konsisten. | Jika sign berubah dalamdt, pecah interval sebelum integrasi. | rendah |
| 78 | Pembacaan=kuantisasi[(1+εg)E], εg±.01 tetap — kurang tepat | §10.2 | Model galat statis bisa untuk latihan; Class1 bukan error tetap seragam semua kondisi. Resolusi LCD dibedakan dari register/pulsa. | Tetapkan pembulatan vs truncation, bias untuk pulsa, Imin, arus mulai dan saturation. | sedang |
| 79 | PF≈1→kVArh≈0; Isek=Iprimer×.0004 — benar | §10.2 | Beban resistif dan rasio CT100A/.04A memberi 2500;63A→25.2mA. | PF=1 hanya beban ideal; polaritas CT memengaruhi tanda. | rendah |
| 80 | Meter arus>100A rusak; fase/tegangan hilang E tidak bertambah — kurang tepat | §10.2 | 100A batas ukur SDM, bukan ambang kerusakan seketika; sumber juga memberi 120% kontinu. Pada3fasa kehilangan satu fasa tidak otomatis menghentikan energi fasa lain. | Model range/overload per sumber dan integrasi masing-masing fasa. | sedang |
| 81 | Pulsa=Wh×imp/kWh÷1000 — benar | §10.3 | 3200imp/kWh=3.2imp/Wh. Dengan bias+.5%,250Wh terbaca 251.25 Wh memberi 804pulsa, bukan 800. | Nyatakan800 untuk ideal/bias0; pulsa perlu accumulator fractional. | sedang |
| 82 | n=hari tahun; δ=23.45°sin[360(284+n)/365]; B=360(n−81)/365; EoT=9.87sin2B−7.53cosB−1.5sinB — benar sebagai pendekatan tahunan | §11.2 | Satuan derajat harus dikonversi untuk math.sin. Formula aproksimasi musiman; kabisat belum ditangani. | Tetapkan derajat→rad, hari/kabisat dan toleransi. [NOAA](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) sebagai pembanding geometri, bukan koefisien rumus identik. | sedang |
| 83 | tsur=tWIB+[4(λ−105)+EoT]/60; ω=15°(tsur−12); cosθz=sinφsinδ+cosφcosδcosω — benar | §11.2 | Tanda bujur timur dan WIB benar. Klaim terbit/terbenam teks tidak sesuai hasil 365hari. | Pertahankan rumus, koreksi rentang jam; beda horizon geometrik dan refraksi. | sedang |
| 84 | Gclear=Gpeak max(cosθz,0)^p; G=kcGclearftilt; kc(t)=kc[1−dkc s(t)] — kurang tepat | §11.2 | Dimensi benar tetapi profil empiris, bukan pengukuran/radiasi bidang miring. Cos zenith tinggi tidak membuktikan orientasi tidak berpengaruh. | Pisahkan GHI/POA dan label A; gunakan azimut/tilt/difus bila latihan orientasi. | sedang |
| 85 | Tmax=29+3kc; Ta setengah-kosinus naik/turun — benar secara interpolasi, kurang tepat sebagai cuaca tervalidasi | §11.1–§11.2 | Mencapai24/32 saatkc1, periodik kalau t<6 ditambah24. ContohTbat charging/cloud tidak didefinisikan satu skenario. | Wrap waktu; Ta dihitung dengan kc yang sama atau label contohcerah terpisah. | sedang |
| 86 | ΣIin(Vbus)−ΣIout(Vbus)=0 dengan bisection “fungsi monoton” — salah sebagai jaminan | §12.2 | KCL benar; constant power P/V memberi F′=−1/R+P/V², bisa ganti tanda, duaakar/noakar. SCC/PV/bypass/state dapat diskontinu. | Bracket per cabang, pilih stabil, residual/energi/convergence;3–5iterasi drop saja tak membuktikan konvergen. | tinggi |
| 87 | dt≤.2t_trip; dtmaks60s bilax<.9; minimum 10 ms; magnetik event — kurang tepat | §12.4 | dt minimum bisa melanggar bound untukfuse.005s: syarat≤1 ms. x antara.9–1 belum rinci; timestep tak dibatasi transisi baterai/cuaca. | Lokasi kejadian semua proteksi cepat termasuk fuse/BMS; error/residual adaptif, batasi SoC dan transisiCV. | tinggi |
| 88 | EPV+Egrid=Eload+ΔEtersimpan+loss dengan toleransi.5% — kurang tepat | §12.5 | Prinsip konservasi benar, tetapi ekspor grid/curtail/P0/selfdischarge belum didefinisikan, ΔE dari SoC Peukert belum jelas dan basis relatif di daya 0 belum ada. | Neraca grid aktual dengan tanda, energi stored∫OCVdq dan loss eksplisit, toleransi absolut+relatif; curtail hanya potensial. | tinggi |
| 89 | Nilai duplikat §13/§15 — kurang tepat sebagai referensi independen | §13–§15 | Nilai H berasal rumus yang sama; beberapa mengulang kesalahan MPPT. ±.5V pada 75.4V tidak boleh mengaburkan keputusan batas75V. | Pertahankan DS sebagai sumber independen; koreksi H dari tabel hasil ulang dan uji limit dengan angka presisi. | sedang |

## 3. Parameter tidak cocok, tidak lengkap, atau belum wajar

| No. | Temuan parameter | Lokasi / sel bukti | Dampak | Usulan | Prioritas |
| --- | --- | --- | --- | --- | --- |
| 1 | ε PV 0…+.03 disamaratakan sebagai D | §1.1; PV Datasheet PV C21:S21, C65; Contoh REC C15:H15 | Mitsubishi ±3%; TENKA +5% dan opsional±3%; Gain 0/+5 W; REC 0/+5 W. Rentang tunggal kehilangan toleransi negatif/5% dan beda W vs %. | Per model bedakan sorting, ketidakpastian pengukuran dan mismatch; jangan ambil semua dari0–3%. | tinggi |
| 2 | Tmin/Tmax PV−40…85 diklaim umum D | §1.1; PV E28:F29 | MJT245/250 tertulis Tidak tercantum; bukan otomatis rating −40/85. | Null/unknown per model; fallback A [PERLU VERIFIKASI]. | sedang |
| 3 | Rentang C1 sampai1e−5 tidak mencakup contoh A | §1.4 vs§1.7A | Contoh A menghasilkan 2.28356e−5. STC 23 kelas4.3773e−10…1.4850e−6 dan C2 .046405….074515; rentang.09357 adalah non-STC. | Pisahkan rentang STC / non-STC dan periksa pembatasan global tidak memotong kurva. | sedang |
| 4 | Klaim seluruh galat NOCT −1.5…−2.4% dan Pmax model ambigu | §1.4; PV E35,H35,M35,G35 | Tabel memakai VmImp, sedangkan §1.7 memakai maxkurva. Maksimum NOCT aktual empat modul 175.58/397.91/323.90/172.05W; rentang termasuk−.80%, bukan−1.5…−2.4%. | Tampilkan kedua besaran, labelVmImp vs maksimumPV dan ubah kesimpulan; lihat§4A. | sedang |
| 5 | toleransi NOCT ±2°C disamaratakan | §1.4; PV E24:G24 vsC24,H24:S24 | Mitsubishi/SolarWorld toleransi NOCT tidak tercantum. Efekdaya±.9% hanyaγ−.0045 pada G800; LONGi±.68%,AE±.70%,REC±.52%. | Per model, tandai unknown; jangan jadikan toleransi uniform alasan validasi. | sedang |
| 6 | PWM Vabs disejajarkan equalization/absorption; 3 tahap vs4 tahap | §2.1–§2.2; PWM RBL B12,B17:B19 | Sumber menyebutPWM 4 tahap dan tegangan equalization, tidak memberi Vabs/tabs. Kompatibilitas LFP RBL tidak didukung (B16 lead-acid). | Pisah stage, profil dan kompatibilitas; asumsi absorption A. | tinggi |
| 7 | PWM 2P185 Wp padaRBL20 A dinilai dengan clipping seolah konfigurasi sah | §2.4,§13; PWM C8=240W,C6=20A | 370 Wp melampaui240W; IscSTC26.2A>20A. Perhitungan252Wterminal sudah>240W, perilaku oversize PWM belum sumber. | Label contoh melewati rating, jangan contoh operasi normal; data manual proteksi arus/daya atau konfigurasi sah. | tinggi |
| 8 | profil MPPT Vbulk 14.3 “semua jenis/model”; skala36/48 tak cukup | §3.1; MPPT Pengisian A3,C6:F10,C20; Spesifikasi C17:I17 | Profil14.3/28.6 hanya 300/600 W untuk Vented/Sealed/Gel/NiCd;Custom bukan 14.3. 850/3KW bukan data ini, dan LFPtidak tercantum sebagai jenis standar. | Model-specific, Setpoint Custom; tandai adopsi3KW/850 dan LFP A. | tinggi |
| 9 | ηmax=.98 dan Pfix 2 W diberi kesan rugi RUN universal | §3.1–§3.2; MPPT Spesifikasi C14:I14, Pengisian C14:D14 | .98 maksimum;2W standby300/600W. Tidak membuktikan RUN fixed 2 W ataupun2W850/3KW. | Per state/model curve η; standby terpisah A jika dikalibrasi. | sedang |
| 10 | VRLA 100 Ah “hanya Rfull” terlalu mutlak | §4.1,§13.5; BAT LFP12100 B8:B15 | Sheet juga memuatVnom12,Cn100,umurfloat12th20–25°C,ukuran,terminal. Yang tidak tersedia adalahkurva isi/lepas dan basis laju. | Ubah menjadi “hanya Rfull untuk model resistif selain nominal”; tetapcharge OCV A. | rendah |
| 11 | Victron200A ditafsir sebagai pulsa | §4.1 baris296; BAT LFP-Smart 25.6-100 B18:B19 | 200A **kontinu maksimum**,100A rekomendasi. Datasheet tidak memberi 200A sebagai pulse. Batas trip model bisa salah. | GunakanIdis_cont_max200A,Idis_recommended100A; Ipulse unknown. [Victron technical data](https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html) mengonfirmasi kategoriini. | tinggi |
| 12 | Itail .02C dipakai Victron sebagaiDS; overpotentialtarget3.65V/cell disamaratakan | §4.1,§4.2,§4.7; BAT MBL48 B17,32Ah B22 vsVictron B27:B31 | .02C adaMBL/BatterySpace, tidak Victron. Victron CV 28.4 V=3.55V/cell, bukan 3.65; model a5 dan Δover memberi V pada SoC .95=28.04V. | Profil charge per model; nilaiItail Victron A [PERLU VERIFIKASI]; kalibrasi Δover pada 28.4V. | tinggi |
| 13 | Cutoff BMS Vcv+.2 bukan data tegangan lebih | §4.5; BAT MBL48 B16,B20;32Ah B21,B25 | MBLcharge cutoff58.4±.2 adalah toleransi setpoint;32 Ah charge 14.6±.2 tetapi cutoff15.6±.2, bukan 14.8 V. Model OVP generik menghapus perbedaan ini. | Pisah charge/CV, cutoff charge, BMS OVP; cutoff 32 Ah 2 V/sel saat discharge juga nilai sumber tak lazim [PERLU VERIFIKASI] ke produsen. | tinggi |
| 14 | ηc=.96 dan self-discharge LFP .1%/hari universal | §4.3; BAT Victron B13,B14;MBL48B13:B15,32AhB13:B15 | Round-trip 92% ≠ ηc 96%;<1% per 100 siklus bukan self-discharge bulanan. MBL/BatterySpace<3%/bulan, bukan≤3. | Parameter energi/coulomb/aging/selfdischarge terpisah per model/suhu. | sedang |
| 15 | Charge VRLA 0.3C diberlakukan pada 100 Ah yang belum diketahui; BMS short / waktu 10 s / 1 ms | §4.1–§4.5; BAT Aokly B14 vs FirstPower/TNE | 0.3C hanya Aokly7/12/20; waktu short tidak ada di datasheet. ProteksiBMS 100 A / 200 A bukan jaminan delay 10 s. | Per model D/A [PERLU VERIFIKASI]; jangan ajarkan selalu BMS sebelum MCB. | tinggi |
| 16 | Inverter P0 dinyatakan 1–3% Pr tetapi 5 kW 40–80 W | §5.1,§7.1 | 5 kW 1–3%=50–150 W;40 W=.8%. Bukan ketidakcocokan datasheet (tidak ada), tetapi rentang internal tidak konsisten. | Ubah rentang persen/kW spesifik; datasheet model terpilih tetap dibutuhkan. | rendah |
| 17 | OCV, knee 2 V, Rchg 3R, penerimaan a1/a5 dan Peukert k 1.2/1.4 | §4.2–§4.3 | Semua A. Model mengubah pengisian/SoC/LVD secara besar; k 1.4 laju <1 jam membutuhkan aturan transisi dan kalibrasi. tabel OCV LFP 0%=2.8V tak mencapai cutoff MBL 2.5 V / 32 Ah 2 V saat istirahat. | Model per kimia/per produk; pisahkan OCV / tegangan berbeban, fit charge dan energi, normalisasi Peukert di batas arus. | tinggi |
| 18 | Klaim galat Peukert besar hanya “di atas 1 C” | §4.3 validasi Aokly; BAT 6-FM-20 E35=18.4 A, B9=20 Ah | Contoh 30 menit sudah memiliki galat +21.42% pada 18.4/20=0.92 C, sebelum 1 C. Toleransi ±10% mulai gagal pada laju ini. | Ubah batas validitas menjadi data arus/durasi yang benar-benar diuji; jangan menandai semua arus ≤1 C tervalidasi. | sedang |
| 19 | model Tcond dan τcab 10 menit belum bukti rusak | §8.1–§8.3; KBL Datasheet A6,A19 | KHA benar; model termal memakai KHA derated sekaligus ΔT acuan tetap sehingga tidak mereproduksi batas. 108.4°C hanya steady, harus lag dan delay 60 s. | Kalibrasi model termal bersumber; jangan menganggap steady cepat. | tinggi |
| 20 | MCB magnetik C120 8 In±20% diubah 11.2 In; derating pemasangan berdampingan diabaikan | §9.1; MCB DC E68;AC E91:E94,E330 | D langsung bertentangan dengan faktor kdc generik; In_eff tidak memakai derating nyata. Rating DC ABB 3/4P 440 V bukan 880 V. | Simpan rating per model/config, standar dan polaritas; tidak melakukan perkalian per kutub tanpa diagram. | tinggi |
| 21 | SPD Up 1–2.5kV, Uc 600–1000V diterapkan pada trainer SCC Voc 24/75 V | §9.3 | Tidak ada datasheet SPD/withstand elektronik; Up pada orde kV tidak membuktikan SCC terlindungi. Nmax 5–20 kejadian tidak setara dengan umur berbasis energi. | Label simbolis A; pilih SPD sesuai sistem dan withstand, grounding dan energi pulsa. | sedang |
| 22 | SDM >100 A rusak seketika bertentangan toleransi kontinu120% | §10.2; KWH SDM230 C16,C18 | 100 A batas range;120% kontinu juga ada. Kerusakan pada 100.01 A tidak bersumber. | Pisahkan overrange, batas kontinu/delay dan kerusakan A. | sedang |
| 23 | Teks Batam Tc 25–75°C dan orientasi hampir tidak berpengaruh terlalu umum | §1.2,§11.2 | G0, Ta22 bisa Tc 22;G1100,Ta36,NOCT47,fmount15 memberi 88.125°C. Elevasi tinggi di siang bukan orientasi seharian. | Tentukan rentang contoh, bukan batas fisik; tambah clip/error Tmax dan POA jika orientasi dilatih. | sedang |
| 24 | Koordinat/cuaca Gpeak,p,kc,Tmin/Tmax,rerata4.8 belum data Batam | §11.1–§11.2 | Workbooks tidak memuat cuaca/geografi. Semua energi 7.2/6.6/6.4merupakan hasil profil A, bukan climatology. | Label A; sumber cuaca lokal/POA [PERLU VERIFIKASI], dan ubah jam terbit/terbenam dari hitungan. | sedang |

Parameter yang cocok langsung dengan workbook: seluruh tujuh baris jendela MPPT/Voc/Ppv/Iin/Ichg/deteksi/BTS §3.1; arus charge dan load RBL 10–60 A serta Voc 24/48 V; angka STC/koefisien PV (kecuali generalisasi toleransi/unknown di atas); KHA PV/NYY §8.1 dan faktor suhu PV; Rfull FirstPower12100=4.5mΩ; kapasitas Aokly 20 Ah dan TNE100Ah; nominal/tegangan/Rint/suhu Victron dan MBL48; CT 2500, rentang tegangan, kelas energi serta 3200imp/kWh RS dan default .001kWh/pulse1 SDM. Rating MCB dasar cocok bila konfigurasi dan standar yang tercantum tetap dipertahankan. Label “D” harus mengacu nilai per produk, bukan menjadi izin menggeneralisasi mekanisme perangkat.

## 4. Tabel hasil hitung ulang seluruh contoh

“Cocok” hanya menyatakan aritmetika pada rumus/asumsi tertulis. Persentase selisih terhadap angka dokumen/datasheet disebut sesuai kolom; perbedaan pembulatan kecil tidak diprioritaskan sebagai bug. Angka ulang ini juga menggantikan nilai H duplikat pada §15.

### 4A. PV, NOCT, dan batas suhu

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Perbandingan | Penilaian |
| --- | --- | --- | --- | --- | --- |
| 1 | §1.4 PV-MJT245GB | P model 174.0 W; DS 177.0 W | Vmp × Imp 174.0401 W; MPP 175.5819 W | MPP vs DS -0.801%; Vmp × Imp vs DS -1.672% | Dokumen memakai hasil kali titik koreksi, bukan maksimum kurva. |
| 2 | §1.4 SW 240 poly | P model 170.5 W; DS 174.2 W | Vmp × Imp 170.5007 W; MPP 172.0546 W | MPP vs DS -1.232%; Vmp × Imp vs DS -2.124% | Dokumen memakai hasil kali titik koreksi, bukan maksimum kurva. |
| 3 | §1.4 LR5-72HPH-540M | P model 397.5 W; DS 403.6 W | Vmp × Imp 397.4956 W; MPP 397.9122 W | MPP vs DS -1.409%; Vmp × Imp vs DS -1.512% | Dokumen memakai hasil kali titik koreksi, bukan maksimum kurva. |
| 4 | §1.4 AE MD-120 440W | P model 323.1 W; DS 331.0 W | Vmp × Imp 323.0842 W; MPP 323.9036 W | MPP vs DS -2.144%; Vmp × Imp vs DS -2.391% | Dokumen memakai hasil kali titik koreksi, bukan maksimum kurva. |

Perluasan silang-cek ke **19 kelas dengan data NOCT/NMOT tersedia** (menghindari memilih hanya empat modul):

| No. | Model | P DS (W) | MPP ulang (W) | Galat daya vs DS | Voc ulang / DS (V) | Isc ulang / DS (A) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | PV-MJT245GB | 177.00 | 175.5819 | -0.801% | 33.97906 / 33.80 | 7.03765 / 7.04 |
| 2 | PV-MJT250GB | 182.00 | 179.1406 | -1.571% | 34.16175 / 34.00 | 7.12673 / 7.13 |
| 3 | SW 240 poly | 174.20 | 172.0546 | -1.232% | 34.18850 / 33.70 | 6.80021 / 6.80 |
| 4 | LR5-72HPH-540M | 403.60 | 397.9122 | -1.409% | 46.40504 / 46.54 | 11.19080 / 11.20 |
| 5 | LR5-72HPH-545M | 407.40 | 401.5034 | -1.447% | 46.54566 / 46.68 | 11.24736 / 11.25 |
| 6 | LR5-72HPH-550M | 411.10 | 405.4912 | -1.364% | 46.68628 / 46.82 | 11.29584 / 11.31 |
| 7 | LR5-72HPH-555M | 414.80 | 409.1526 | -1.361% | 46.82690 / 46.97 | 11.34432 / 11.35 |
| 8 | LR5-72HPH-560M | 418.60 | 412.8317 | -1.378% | 46.96752 / 47.11 | 11.39280 / 11.40 |
| 9 | AE MD-120 440W | 331.00 | 323.9036 | -2.144% | 38.68191 / 38.80 | 10.87298 / 10.78 |
| 10 | AE MD-120 445W | 335.00 | 327.5483 | -2.224% | 38.97191 / 39.00 | 10.91334 / 10.82 |
| 11 | AE MD-120 450W | 338.00 | 331.3048 | -1.981% | 39.27126 / 39.20 | 10.95370 / 10.86 |
| 12 | AE MD-120 455W | 342.00 | 334.9878 | -2.050% | 39.56126 / 39.40 | 10.99406 / 10.90 |
| 13 | AE MD-120 460W | 345.00 | 338.7500 | -1.812% | 39.85126 / 39.60 | 11.03442 / 10.94 |
| 14 | REC385AA Pure | 293.00 | 289.5425 | -1.180% | 45.82791 / 45.70 | 8.20589 / 8.16 |
| 15 | REC390AA Pure | 297.00 | 293.2883 | -1.250% | 45.92241 / 45.80 | 8.23814 / 8.20 |
| 16 | REC395AA Pure | 301.00 | 297.0362 | -1.317% | 46.01690 / 45.90 | 8.26232 / 8.24 |
| 17 | REC400AA Pure | 305.00 | 301.0920 | -1.281% | 46.11139 / 46.00 | 8.28650 / 8.28 |
| 18 | REC405AA Pure | 309.00 | 304.8564 | -1.341% | 46.20588 / 46.10 | 8.30262 / 8.32 |
| 19 | REC410AA Pure | 312.00 | 308.7484 | -1.042% | 46.30037 / 46.20 | 8.34293 / 8.36 |

Semua galat MPP pada 19 kelas tersebut −0.801%…−2.224%, di dalam ±3% yang diusulkan. Ini mendukung pendekatan pada titik NOCT/NMOT yang tersedia, bukan seluruh kurva/cahaya rendah. Vmp/Imp yang dihasilkan juga tidak otomatis sama dengan MPP yang ditemukan; kedua set nilai lengkap tersimpan dalam JSON hasil.

Klaim §1.4 “maksimum ≤0.5% di atas Pmax” benar pada **23 kelas STC**; residual endpoint menunjukkan kata “persis” tidak benar:

| No. | Model | Pmax DS (W) | MPP STC ulang (W) | Selisih | I(Voc) (A) | I(Vmp)−Imp (A) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 240W-60P | 240 | 240.78593 | +0.3275% | 5.93e-06 | 5.93e-06 |
| 2 | 245W-60P | 245 | 245.36848 | +0.1504% | 1.3e-05 | 1.3e-05 |
| 3 | PV-MJT245GB | 245 | 245.79710 | +0.3253% | 4.17e-06 | 4.17e-06 |
| 4 | PV-MJT250GB | 250 | 250.77094 | +0.3084% | 3.66e-06 | 3.66e-06 |
| 5 | SW 240 poly | 240 | 241.05072 | +0.4378% | 2.04e-06 | 2.04e-06 |
| 6 | LR5-72HPH-540M | 540 | 540.20152 | +0.0373% | 3.92e-07 | 3.92e-07 |
| 7 | LR5-72HPH-545M | 545 | 545.07301 | +0.0134% | 3.62e-07 | 3.62e-07 |
| 8 | LR5-72HPH-550M | 550 | 550.39295 | +0.0714% | 2.9e-07 | 2.9e-07 |
| 9 | LR5-72HPH-555M | 555 | 555.31476 | +0.0567% | 2.5e-07 | 2.5e-07 |
| 10 | LR5-72HPH-560M | 560 | 560.25962 | +0.0464% | 2.15e-07 | 2.15e-07 |
| 11 | AE MD-120 440W | 440 | 440.21095 | +0.0479% | 2.87e-07 | 2.87e-07 |
| 12 | AE MD-120 445W | 445 | 445.14767 | +0.0332% | 2.89e-07 | 2.89e-07 |
| 13 | AE MD-120 450W | 450 | 450.23719 | +0.0527% | 2.89e-07 | 2.89e-07 |
| 14 | AE MD-120 455W | 455 | 455.22567 | +0.0496% | 2.91e-07 | 2.91e-07 |
| 15 | AE MD-120 460W | 460 | 460.26359 | +0.0573% | 2.91e-07 | 2.91e-07 |
| 16 | JS185CB-48P | 185 | 185.74541 | +0.4029% | 7.1e-08 | 7.1e-08 |
| 17 | JS310CB-80P | 310 | 311.26903 | +0.4094% | 5.65e-09 | 5.65e-09 |
| 18 | REC385AA Pure | 385 | 385.88546 | +0.2300% | 5.95e-07 | 5.95e-07 |
| 19 | REC390AA Pure | 390 | 390.89999 | +0.2308% | 3.23e-07 | 3.23e-07 |
| 20 | REC395AA Pure | 395 | 395.89871 | +0.2275% | 1.56e-07 | 1.56e-07 |
| 21 | REC400AA Pure | 400 | 401.28546 | +0.3214% | 6.52e-08 | 6.52e-08 |
| 22 | REC405AA Pure | 405 | 406.28389 | +0.3170% | 2.57e-08 | 2.57e-08 |
| 23 | REC410AA Pure | 410 | 411.51734 | +0.3701% | 1.27e-08 | 1.27e-08 |

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §1.4, G1000,Tc65,240W-60P | 200.5 vs196.8W (+1.9%) | 200.50944 vs196.80000W (+1.8849%); Voc33.1824V | Cocok; model kurva tidak persis mengikutiγ. |
| 2 | §1.7A suhu/arus | Tc55;Isc6.951;Imp6.504 | Tc55.000°C;Isc6.95072A;Imp6.50412A | Cocok. |
| 3 | §1.7A koreksiV | Vt1.638;ΔV−.3655;Voc33.82;Vmp25.13 | Vt1.637723V;ln.8=−.22314355;ΔV−.365447V;Voc33.821353V;Vmp25.134553V | Cocok. |
| 4 | §1.7A kurva | C2.09357;C1 2.28e−5;166.0W,26.72V,6.21A;I30=4.87 | C2.093569959;C1 2.28355791e−5;166.033673W,26.716212V,6.214716A;I30=4.873020A | Cocok; C1 di luar rentang umum tertulis. |
| 5 | §1.7A ceklinear/rasio | 166.1W;ratioI.500;ratioVoc.892 | 166.080000W;.500000 padaTc sama;.892000,37.2→33.1824V | Cocok; rasio arus membutuhkan suhu sama. |
| 6 | §1.5 arusbalik3 string | 17.1A>15A | 17.12000A>15A; 2 string8.56000A | Cocok aritmetika; rating fuse bukan waktu aman panel. |
| 7 | §1.7B shading | Geff575;Isc7.42;377.3W@52.2V/7.22A;303.9W@24.9V/12.23A;normal 622.5 | 575W/m²;7.4175A;377.321123W@52.247809V/7.221760A;303.928700W@24.857856V/12.226666A;622.538060W | Cocok dengan Tc tetap25°C dan model bypass −.6V; bukan validasi bayangan nyata. |
| 8 | §1.4 pengaruh NOCT±2°C | setara±.9%daya | .9%TENKA/MJT,.96%SW,.68%LONGi,.70%AE,.52%REC pada G800 | Tidak universal; sebagian sumber tidak memiliki toleransi. |
| 9 | §1.2 rentangTc | 25–75°C | G0,Ta22,fmount0→22°C;G1100,Ta36,NOCT47,fmount15→88.125°C | Rentang hanya contoh, bukan batas model. |

### 4B. PWM dan MPPT

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §2.4 panelJS185G800/T55 | Isc10.64;Vmp13.07;130.7W@13.24V/9.87A | 10.6372A;13.068818V;130.671884W@13.235332V/9.872958A | Cocok. |
| 2 | §2.4 PWMbulkVbat12.6 | Vpv12.9;Iarray20.17;Ichg20;P252vs261.3W96% | Iarray20.172576A (per panel 10.086288A);Ichg20A;P252W;Pmpp261.343768W;96.4247% | Cocok hitung, tetapi 370 Wp melewati batas240W RBL. |
| 3 | §2.4 PWMabsVbat14.4 | 14.89A;214.4W82% | 14.889759A;214.412529W;82.0424% | Cocok bila Iaccept dan CV tidak membatasi tambahan; SoC tak diberikan. |
| 4 | §2.4 PWMSTCVbat12.7 | 165.3vs185.7W89% | 165.307795vs185.745412W;88.99696% | Cocok. |
| 5 | §2.2 Iself | ≈.13W | <.010A×13V=<.130W | Angka adalah batasatas. |
| 6 | §2.4 salahVoc | 37.2V>24V | 37.2/24=1.55>1.2; masuk cabang rusak A | Ketaksamaan cocok;asap bukan data perangkat. |
| 7 | §3.4 MPPTper panel /string | 219.5W@22.37V/9.81A;Pin438.9W@44.7V | MPP panel 219.450376W@22.371744V/9.809266A;Pmpp string 438.900751W@44.743488V;Pin sesudah ηtrk 434.511744W | Pin dokumen kehilanganηtrk=.99. |
| 8 | §3.4 MPPToutput | 428.1W;16.5A | 423.821509W;16.300827A | Dokumen lebih 4.279 W terhadap angka428.1,≈1.009%; tanpaηtrk428.122736W. |
| 9 | §3.4 MPPTVoc dingin | 60.8V<75V pada 15°C;75.4V>75V untuk 2S24020°C | 60.770000V<75;75.404400V>75 | Cocok; peringatan batas harus presisi. |
| 10 | §3.4 MPPTSTCclip | 622W>600W | 622.538060W>600;ηtrk=.99→Pin594W;Pout580.12W pada batas600 | Pembulatan622 sebaiknya622.5; enforcement clipping memerlukan titik aktual. |
| 11 | §13 panelpaket | 2×13.1=26.2A>20;2×185=370W>240 | 26.200A>20A;370W>240W | Cocok; jangan menyebut normal. |

### 4C. Baterai: tegangan, Peukert, pengisian

| No. | Laju DS (jam) | I DS (A) | Kapasitas dokumen model / DS (Ah) | Ulang model / DS (Ah) | Galat | Waktu model sampai SoC 0 (jam) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 20 | 1 | 20.0 / 20.0 | 20.000000 / 20.0 | +0.0000% | 20.000000 |
| 2 | 10 | 1.86 | 17.7 / 18.6 | 17.665560 / 18.6 | -5.0239% | 9.497613 |
| 3 | 5 | 3.4 | 15.7 / 17.0 | 15.657925 / 17.0 | -7.8946% | 4.605272 |
| 4 | 2 | 6.9 | 13.6 / 13.8 | 13.591274 / 13.8 | -1.5125% | 1.969750 |
| 5 | 1 | 11.5 | 12.3 / 11.5 | 12.271296 / 11.5 | +6.7069% | 1.067069 |
| 6 | 0.5 | 18.4 | 11.2 / 9.2 | 11.170341 / 9.2 | +21.4167% | 0.607084 |

Tabel cocok setelah pembulatan. Metode yang mereproduksi dokumen adalah **memakai I dari tabel datasheet**, menghitung t_model=20/I^1.2, lalu C_model=I×t_model (untuk 20 Ah,Iref 1 A). Bukan kapasitas pada durasi model tepat20/10/5/2/1/.5jam. Jika durasi model dipaksa sama, kapasitasnya berturut20.000000/17.817974/15.874011/13.625841/12.139245/10.814837Ah. Model SoC saja belum menghitung cutoff10.5V, sehingga menamai ini validasi tegangan cutoff belum tepat.

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §4.2 koreksitemp35°C | float13.7→13.52;cycle14.4→14.10 | 13.52000V;14.10000V | Cocok jika−3/−5mV/°C/sel. |
| 2 | §4.2 bulk 0.2–0.3C | berakhirSoC.88–.92 | I20 tetap → .910987;I30 tetap → .877121;dengan Iaccept =min(30,100(1−s))→.980852 | Klaim rentang benar hanya jika mengabaikan penerimaan tertulis. |
| 3 | §4.3 absorption.90→.98 | sekitar2jam,ηrata≈.8 | 2.114609jam denganηpiecewise dan Iaccept;1.694145jam jikaη=.95konstan | ≈2jam benar jika tahap benar; bulk dengan Iaccept baru mencapai Vabs≈.981, sehingga tahap awal .90 bertentangan. |
| 4 | §4.3 time47.9A/100Ah | model1.33;skalaAokly1.28jam | 1.328591jam;datasheet dengan interpolasi log-log1.281289jam,linear1.417391jam | Cocok dengan interpolasi log-log; skala20→100Ah/interpolasi bukan karakterisasi FirstPower100Ah. |
| 5 | §4.7 VRLAR | Rbat7.9mΩ;kabel1.4;total9.3 | 7.875000mΩ;1.400000mΩ;9.275000mΩ | Cocok setelah pembulatan; simpan9.275untukhitung. |
| 6 | §4.7 VRLA500W | Pin568.2;I47.9;V11.86 | Pin568.181818W;I47.925630A;V11.855490V;dengan R bulat .0093dan568.2→47.932257A | Cocok pada SoC .5, knee .0000908V nyarisnol. |
| 7 | §4.7 Peukert 10 menit | Ieff75.3;SoC turun 12.5%,.50→.375 | Ieff75.316026A;turun.12552671;SoC.37447329 untuk I tetap | Cocok sebagai aproksimasi beku; beban konstan: I bertambah ketika SoC turun. |
| 8 | §4.7 LVD100/500/1000W | SoC.03/.06/.11 | SoC.033086/.063206/.166780 menggunakan E=OCV−knee,R(s)+kabel dan Pinfit 500 W | 100/500 cocok;1000 tidak cocok (16.678%, selisih 5.678 poin).1000W juga melebihi rating 500 W, hanya probe LVD jika overload diabaikan. |
| 9 | §4.7 LFPCC 50 A .20→.95 | rate.48/jam;1.56jam,lalu CV 28.4 sampai2A | rate.48/jam;1.562500jam jika 50Aterus;1.602739jam memakai Iaccept a5;Vat95=28.040V;CV 28.4 V di SoC .965169;Itail 2 A di .996jika model Iaccept | Aritmetika CC konstan benar, alurCV tidak konsisten; Itail Victron A. |
| 10 | §4.3 swa-lepas | .1%/haridan≤3%/bulan | 3.000poinSoCper 30 hari linear | VRLA sesuai limit;LFP <3%tidak dipenuhi tepat 3%. |
| 11 | §4.6 DoDlatihan | VRLA50%;LFP80% | sisa SoC .50/.20;Victron2500siklus 80%DoD | Aritmetika benar; nilai DoD VRLA adalahA;umur DS bukan rumus prediksi. |

### 4D. Inverter off-grid, grid-tie, dan hibrida

| No. | Model | k1 ulang | k2 ulang (1/W) | η5% /10% /25% /100% | Perbandingan |
| --- | --- | --- | --- | --- | --- |
| 1 | §5.2 500W | 0.0378585859 | 0.000165010101 | 0.734223 / 0.829112 / 0.890881 / 0.880000 | Cocok seluruh koefisien/efisiensi tabel. |
| 2 | §5.2 1500W | 0.0228019324 | 4.998389694e-05 | 0.773265 / 0.859378 / 0.913343 / 0.900000 | Cocok seluruh koefisien/efisiensi tabel. |
| 3 | §5.2 5000W | 0.0216365355 | 1.345291268e-05 | 0.816327 / 0.886240 / 0.927254 / 0.910000 | Cocok seluruh koefisien/efisiensi tabel. |

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §5.4 beban500W | Pin568.2;η.880 | 568.181818W;.880000;koefisien bulat→568.200W | Cocok. |
| 2 | §5.4 beban100/25/0W | 113.4W/η.882;η25.734;idle 8 | 100→113.435960W/η.881555;25→34.049596W/η.734223;0→8W | Cocok. |
| 3 | §6.3 4S240G800/T55 | P664.1;V106.9;Voc148.8/152.8;Pac638 | 664.134693W;106.864850V;Voc148.8/152.8176V;η konstan .96→637.569305W | Cocok sebagai aproksimasi η=.96; rumus loss grid-tie tidak dapat direproduksi eksak tanpa k1/k2. |
| 4 | §6.3 anti-island/reconnect | ≤2s/60s | t≤2s;resambung t_stabil+60s | Aturanmodel,dapat diperiksa secara logika; tidak ada datasheet mengesahkan waktunya. |
| 5 | §7.3 SBU 1500 W | f1000=1085;surplus415;8.0A | f1000=1085.089448W;charge414.910552W;7.979049A@52V;grid 0 | Cocok. |
| 6 | §7.3 SBU 600 W | 485W;9.3A | 485.089448W;9.328643A@52V;grid 0 | Cocok. |
| 7 | §7.3 SUB 600 W | AC535;impor465;baterai idle | AC534.588711W (inversf);impor465.411289W;baterai idle | Cocok. |
| 8 | §7.3 Utility First 600 W | grid1000;PV charge | grid1000W;PV charge 600W atau11.538462A@52V sebelum limit | Cocok jika MPPT DC 600danbaterai menerima 600 W. |
| 9 | §7.3 full 5000 W | f5495;107A@51.2,125A@44;limit≈4.7kW | 5494.505495W;107.314560A/124.875125A;limit4674.849560W@51.2 dan 4042.667562W@44V (100A) | Cocok 4.7 kW hanya pada 51.2 V terminal; pada 44 V≈4.04kW. |

### 4E. Kabel: semua penampang, KHA, dan panas

| No. | A (mm²) | R model / maksDS (Ω/km) | DS lebih /Kcl | Rloop 10m (Ω) | ΔV20A (V) | ΔV48V (%) |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2.5 | 7.000000 / 8.210 | 17.2857% / 1.172857 | 0.140000 | 2.800000 | 5.833333 |
| 2 | 4 | 4.375000 / 5.090 | 16.3429% / 1.163429 | 0.087500 | 1.750000 | 3.645833 |
| 3 | 6 | 2.916667 / 3.390 | 16.2286% / 1.162286 | 0.058333 | 1.166667 | 2.430556 |
| 4 | 10 | 1.750000 / 1.950 | 11.4286% / 1.114286 | 0.035000 | 0.700000 | 1.458333 |
| 5 | 16 | 1.093750 / 1.240 | 13.3714% / 1.133714 | 0.021875 | 0.437500 | 0.911458 |
| 6 | 25 | 0.700000 / 0.795 | 13.5714% / 1.135714 | 0.014000 | 0.280000 | 0.583333 |
| 7 | 35 | 0.500000 / 0.565 | 13.0000% / 1.130000 | 0.010000 | 0.200000 | 0.416667 |

Seluruh nilai cocok dengan rumus dan cache `KBL/Perhitungan` untuk input contoh B6:B11. Selisih resistansi LAPP **11.4286–17.2857%** sesuai pembulatan “11–17%”; bukan galat penyalinan dokumen. Kcl per penampang berbeda dan berasal R maksimum, bukan pengukuran R aktual tiap kabel. KHA PV dan NYY disalin benar pada delapan baris §8.1; nilai ini tidak dihitung dariρ.

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §8.3 2.5mm²10m20A48V | R.140;ΔV2.80;5.83% | .140000Ω;2.800000V;5.833333% | Cocok. |
| 2 | §8.3 4mm²3m20A12.6V | 26.3mΩ;.525;4.17% | 26.250000mΩ;.525000V;4.166667% | Cocok. |
| 3 | §8.3 6mm²3m20A12.6V | 17.5mΩ;.350;2.78% | 17.500000mΩ;.350000V;2.777778% | Cocok. |
| 4 | §8.3 10mm²3m20A12.6V | 10.5mΩ;1.67% | 10.500000mΩ;.210000V;1.666667% | Cocok. |
| 5 | §8.3 2.5→6mm² | R.417×;turun58.3% | .41666667×;58.333333% | Cocok untuk panjang/suhu sama. |
| 6 | §8.3 panasPV4mm² | 60/44=1.36;T90.8 | 1.363636;90.785124°C (steady) | Cocok dengan rumus; validasi fisik hanya A. |
| 7 | §8.3 panasNYY2.5mm² | 35/25=1.4;T108>70→rusak | 1.400000;108.400000°C(steady) | Pembulatan108wajar; rusak perlu τcabdan≥90°C selama 60 s, bukan seketika. |
| 8 | §8.2 batas derating termal | kamb70=.92;Tmax90 | I=Iz_eff,Ta 70→Tmodel100°C | Modeltermal tidak mencocoki batas KHA derated; perlu perbaikan. |

### 4F. Proteksi MCB, fuse, SPD dan kWh meter

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §9.1 MCB 20 C/DC | xm11.2/224A | 8×1.4=11.2;224A | Cocok secara aritmetikaA; bertentangan jika dipakaiC120Ndata threshold 8±20%. |
| 2 | §9.1 PV short 2P240 | 17.1A;x.86;tak trip | 17.120000A;x.856000;tak trip | Cocok pada STC dan In_eff 20A. |
| 3 | §9.1 BAT short | wire4.4mΩ;I1448;x72;20ms | wire4.375000mΩ;I1447.887324A;x72.394366;20msA;Icu6kA>1.447887kA | Cocok hanya Rwire tanpa pembulatan;rumus dengan angka tercetak.0044 menghasilkan1443.820225A. |
| 4 | §9.1 arustahan25/30/50A | 4108/1374/23.4s | 4108.100832/1373.772826/23.419687s | Cocok dengan kurva A; tidak membuktikan kurva produsen. |
| 5 | §9.2 meter / fuse | 12.6/.03=420A;42×;<5ms | 420.000000A;42×;t=.005s tepat | Arus cocok; modelt≥20=.005 memberi 5ms, bukan<5ms. |
| 6 | §9.2 fuse 15 A / arus 17.1 A | x1.14;≈9jam | x1.140000;t9.218601jam;dengan17.12At9.119628jam | Cocok setelah pembulatan;waktu A. |
| 7 | §9.2 rule1.35In | reverse≥1.35In | kurva modelt(1.35)=6964.471287s=1.934575jam | Rulearus tidak sendiri menjamin withstand panel. |
| 8 | §9.3 SPD4S240T15 | Uc183V | 1.2×152.8176=183.381120V | Cocok setelah pembulatan;sebagai batas≥pilih rating yang tidak kurang 183.381V. |
| 9 | §10.2 CT63A | ratio2500;25.2mA | 100/.04=2500;63×.0004=.0252A=25.200000mA | Cocok. |
| 10 | §10.3 Eexport/import | 150/250Wh | 150.000/250.000Wh | Cocok. |
| 11 | §10.3 bias +.5% / LCD | 150.75/251.25Wh;.15/.25 kWh | 150.750/251.250Wh;.15/.25 kWh jika pembulatan terdekat.01 | Cocok dengan metode kuantisasi ini;metode belum ditentukan. |
| 12 | §10.3 pulsaRS | 800pulsaimport sesudah bias +.5% | ideal800;denganbias yang sama804 | Teksperlu memisahkan ideal/bias; keluaran pulsa bukan LCD yang dibulatkan. |

### 4G. Matahari, suhu, dan integral harian

| No. | Contoh / lokasi | Dokumen | Hitung ulang | Penilaian |
| --- | --- | --- | --- | --- |
| 1 | §11.3 21Mar10:00 | EoT−7.8;tsur 9.807;ω−32.9° | EoT−7.842806min;tsur 9.805953h;ω−32.910701° | Cocok pembulatan bertahap. |
| 2 | §11.3 sudut/G | cos.8391;elev57.1;G810;kc.6→486;.25→203 | cos.83919537;elev57.055250°;810.281071/486.168643/202.570268W/m² | Cocok. |
| 3 | §11.3 Ta/Tc | 27.6;53.0 | Ta27.630927°C;Tc52.952210°C padaG cerah | Cocok untuk skenario Ta Tmax 32(kc1),bukan Ta untuk kc.6/.25. |
| 4 | §11.2 terbit geometrik 365 hari | 05:57–06:12 | 05:48:32–06:19:33WIB | Tidak cocok;deviasi batas awal≈8.5min,batas akhir≈7.6min. |
| 5 | §11.2 terbenam geometrik 365 hari | 17:56–18:11 | 17:46:07–18:17:18WIB | Tidak cocok;geometri horizon 0°,bukan refraksi. |
| 6 | §11.2 elevasi tengah hari | 65–89° | 65.420217–89.919519° | Minimum wajar,maksimum sebaiknya≈90°;bukan bukti orientasi bebas. |

| No. | Tanggal /n | Dokumen Gclear (kWh/m²/hari) | Integral ulang | kc=.7 | Penilaian |
| --- | --- | --- | --- | --- | --- |
| 1 | 21 Mar /80 | 7.2 | 7.204837 | 5.043386 | Cocok pembulatan; profil A. |
| 2 | 21 Sep /264 | 7.2 | 7.205883 | 5.044118 | Cocok pembulatan; profil A. |
| 3 | 21 Jun /172 | 6.6 | 6.597030 | 4.617921 | Cocok pembulatan; profil A. |
| 4 | 21 Des /355 | 6.4 | 6.400839 | 4.480587 | Cocok pembulatan; profil A. |

Klaim “kc=.7 sekitar5.0” cocok pada ekuinoks (≈5.044), tetapi solstis memberi 4.618/4.481kWh/m²/hari. Bukan rata-rata tahunan Batam yang dibuktikan. Nilai rerataIndonesia4.8 tidak bisa diperiksa dari workbooks; tetap [PERLU VERIFIKASI].

## 5. Acuan §15, keterbatasan, dan verifikasi akhir

Semua 18 baris acuan §15 telah dicakup: empat DS NOCT/NMOT pada §4A; rasio Isc/Voc serta MPP 240 pada§4A; PWM/MPPT/Voc cold pada§4B; VRLA/Peukert pada§4C; inverter/hibrida pada§4D; kabel pada§4E; MCB/kWh pada§4F; iradiasi pada§4G. Nilai acuan MPPT harus **423.821509W /16.300827A** jikaηtrk=.99 tetap dipakai. NilaiNOCT 177/403.6/Voc38.8/Isc6.8 adalahDS yangbenar; jangan diganti menjadi hasil model.

Tidak dilakukan uji aplikasi karena proyek belum berisi `package.json`, kode, atau test runner. Perintah wajib **`npm run check` sudah dijalankan dan gagal ENOENT**: `D:/MyAPP/SimPLTS/package.json` tidak ditemukan. Ini keterbatasan repositori saat review, bukan hasil lint/test/build lulus. Skrip hitung ulang Python selesai exit0.

Prioritas perbaikan: konsistensi SCC/baterai CC/CV dan loss MPPT; definisi daya/energi aktual; solver nonmonoton/roots; proteksi per model; lalu parameter A / penjelasan validasi. Perubahan ini adalah usulan review, belum diterapkan.

Hanya satu berkas proyek dibuat: `docs/review/MODEL_FISIKA-codex.md`. Tidak menambah dependensi, menghapus file, mengubah AGENTS, melakukan commit/push/merge, atau mengubahLOG_SESI. Aturan khususmode reviewer “Hanya menulis SATU file laporan … jangan mengubah file lain” digunakan untuk membatasi perubahan proyek.

Sumber primer tambahan: [Victron Lithium Smart—technical data](https://www.victronenergy.com/media/pg/Lithium_Battery_Smart/en/technical-data.html) untuk kategori arus kontinu dan profilCV; [Siemens Fuse Systems, edisi2014/2015, bagian Photovoltaic fuses](https://cache.industry.siemens.com/dl/files/810/45314810/att_829959/v1/SENTRON_Fuse_Systems_complete_English_10_2014_201502111459517016.pdf) untukmembedakan1.35vs1.45 menurut karakteristik fuse; [NOAA General Solar Position Calculations](https://gml.noaa.gov/grad/solcalc/solareqns.PDF) untuk konvensi geometri/waktu dan horizon. Sumber tambahan tidak mengganti spesifikasi workbook dengan produk NG/versi lain, dan tidak mengesahkan klaim IEC tanpa edisi/kurva lengkap.

SHA-256 sumber yang dibaca (untuk mengidentifikasi revisi review):

| No. | Berkas | SHA-256 |
| --- | --- | --- |
| 1 | AGENTS.md | 72beaf3691aedef5a2537c9667097db419bcf4a78873aa35d48c0ea483988130 |
| 2 | MODEL_FISIKA.md | b59b4a17ee04888f8cf9a36f5daff7ad1caadf13b395a10048cc331e169114ef |
| 3 | Datasheet_Battery.xlsx | 2a44c16d474f1a7c1cbfa7729c5d248c8ba84fc5c188798caaa7f8ab1444e60b |
| 4 | Datasheet_Kabel_Tembaga.xlsx | 98244caf78274206959b03b15947dd7445039db4bb46472be6177c1e18a116a7 |
| 5 | Datasheet_kWh_Meter_EXIM.xlsx | bc662df16f92b28430cf07cb1a710db5517b5794beb76a0d87b95c8422db0c73 |
| 6 | Datasheet_MCB_AC_DC.xlsx | 096976be12880b506e687101f6c10d1e52ab7df873412981b931369508f814b8 |
| 7 | Datasheet_Panel_Surya_Update.xlsx | 171cfa7c103fea932c2a9ad8c8813142094aa821f0ab4dca5a10dea6ee4f5c47 |
| 8 | Datasheet_SCC_MPPT_ID.xlsx | f34c69fe1d10188c3e894d208aee8ceb1e9f26158f58999a2f22a18407e4125c |
| 9 | Datasheet_SCC_PWM.xlsx | fcbafb1e912b3339b02fb899d6cef87837f96913d63c256f4359289d24a1e0a5 |
