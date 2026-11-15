# Köd Koronája – A birodalmak felemelkedése

Körökre osztott fantasy stratégiai játék Eldória világában. Egyetlen közös kódbázisból készül
a **Windows-alkalmazás** (Tauri 2, saját launcherrel és telepítővel) és az **iPhone-on Safariból
játszható PWA**.

## Mit tud a játék?

- 11 × 11-es hatszögrácsos világtérkép köddel, folyókkal, utakkal, romokkal, lelőhelyekkel
- Négy játszható frakció egyedi bónuszokkal; három AI-ellenfél saját személyiséggel, három nehézségi fokon
- Öt erőforrás, 14 épület, öt városszint, építési idők, népesség, elégedettség, lázadások
- Hat egységtípus, legfeljebb hat osztagos hadseregek, terep- és útfüggő mozgás, többkörös menetparancs
- Átlátható harcrendszer csata előtti becsléssel és részletes csatajelentéssel
- Utánpótlási hálózat (külön térképnézet), évszakok, 10 döntéses esemény
- Diplomácia nyolc lehetőséggel, indokolt AI-döntésekkel; 15 technológia három ágon
- Területi, katonai és pontozásos győzelem; hat küldetéses oktatómód
- Automatikus mentés, három mentési hely, JSON export/import
- 3D-ben (Blenderben) modellezett világ: 25 városmodell (5 szint × 5 tulajdonos), külön figura minden
  egységtípushoz minden frakció színeiben, évszakonként változó hegyek, erdők, dombok, mocsarak és romok
- Döntött (2,5D) térképnézet: a seregek a térképen az összetételük szerinti figurákból állnak
- Szintetizált hang: nincs letöltendő hangfájl, minden offline is működik

## Fejlesztés

```bash
npm install
npm run dev        # fejlesztői szerver: http://localhost:5173 (launcher: /launcher.html)
npm test           # játékszabályok unit tesztjei + teljes 50 körös AI-szimuláció
npm run build      # optimalizált statikus fájlok a dist/ mappába
npm run preview    # a kész build kipróbálása helyben
```

## 3D-s modellek (Blender)

A városok, egységek és a domborzat Blenderben, kódból készülnek (`tools/blender/kk/`), és előre
lerenderelt, átlátszó hátterű képatlaszként kerülnek a játékba (`public/sprites/`). Így a játék
sebessége és a telefonos működés nem változik, a modellek pedig bármikor újragenerálhatók:

```bash
python -m venv .venv && .venv/bin/pip install bpy pillow   # egyszer: a Blender Python-modulként
.venv/bin/python tools/blender/build.py                     # csak a megváltozott modelleket rendereli újra
.venv/bin/python tools/blender/build.py --only 'city-5-*'   # csak a mintára illőket
.venv/bin/python tools/blender/build.py --force             # mindent újra
```

| Fájl | Tartalom |
| --- | --- |
| `kk/core.py` | anyagok, alapformák, közös kameraszög és megvilágítás, renderelés |
| `kk/props.py` | építőelemek: házak, tornyok, falak, sátrak, fák, zászlók |
| `kk/cities.py` | az öt városszint frakciónkénti stílussal |
| `kk/units.py` | egységfigurák (milícia, lándzsás, íjász, lovas, ostromgép, felderítő) |
| `kk/terrain.py` | domborzat évszakonként, romok |
| `kk/atlas.py` | körülvágás, árnyékhalványítás, atlaszba csomagolás (WebP) |

Minden kép ugyanabból a kameraszögből (40°-os rálátás) és ugyanazzal a fényeléssel készül, ezért a
külön renderelt modellek egy világnak látszanak; a talaj a játékban ugyanilyen arányban rövidül.

## Windows – Köd Koronája Launcher

```bash
npm run tauri build
```

Windows 10/11 (x64) gépen Rust és a Visual Studio C++ Build Tools szükséges. A kimenetek:

| Fájl | Hely |
| --- | --- |
| `KodKoronajaLauncher.exe` | `src-tauri/target/release/` |
| EXE telepítő (NSIS) | `src-tauri/target/release/bundle/nsis/` |
| MSI telepítő (opcionális: `npm run tauri build -- --bundles msi`) | `src-tauri/target/release/bundle/msi/` |

Windows nélkül is elkészül a telepítő: a `.github/workflows/windows-build.yml` minden feltöltéskor
Windows-gépen lefordítja az alkalmazást, majd csendes telepítéssel, indítással és eltávolítással
ellenőrzi. A kész fájlok (`KodKoronajaSetup_x64.exe`, `KodKoronajaLauncher.exe`, `KodKoronaja_x64.msi`)
a futás **Artifacts** részéből tölthetők le; `v*` címke esetén GitHub-kiadás is készül.

- A telepítő felhasználói szintű (nem kér rendszergazdai jogot), Start menü és asztali parancsikont
  hoz létre, és a Windows beállításaiból eltávolítható.
- A WebView2 futtatókörnyezetet szükség esetén a telepítő tölti le (bootstrapper). A játék ezután
  internet nélkül fut.
- A mentések és a beállítások helye: `%LOCALAPPDATA%\hu.kodkoronaja.launcher\` (`saves\*.json`,
  `settings.json`). A launcher és a játék beállításaiból is megnyitható.
- A launcher és a játék ugyanazt a beállításfájlt használja (teljes képernyő, ablakméret, hangerők, grafika).

## iPhone – Safari / PWA

A `dist/` mappa tartalma bármely HTTPS-tárhelyre feltölthető (relatív útvonalakat használ).
A `.github/workflows/web-deploy.yml` az alapértelmezett ágra kerülő változatot GitHub Pages-re
teszi ki. Safariban: **Megosztás → Főképernyőhöz adás**; ezután a játék teljes képernyős
alkalmazásként indul, és az első betöltés után offline is működik. A mentések eszközönként
külön, IndexedDB-ben tárolódnak; eszközök között JSON export/importtal vihetők át.

## Irányítás

| | Windows | iPhone |
| --- | --- | --- |
| Kijelölés | bal kattintás | koppintás |
| Mozgás / támadás | kattintás a kiemelt mezőre | koppintás a kiemelt mezőre |
| Menet távoli mezőre | jobb kattintás | koppintás, majd „Menetelés ide” |
| Térkép | húzás, görgő | húzás, kétujjas nagyítás |
| Gyorsbillentyűk | Enter kör vége · N sereg · C főváros · D/K/G/U/L panelek · Esc · Ctrl+S · F11 | – |

## Felépítés

```
src/
  game/      játékállapot és szabályok (gazdaság, város, mozgás, harc, utánpótlás,
             diplomácia, kutatás, évszakok, események, győzelem, körkezelés)
  ai/        prioritásalapú stratégiai AI (személyiségek, döntési motor, vezérlő)
  world/     hatszögrács, térképgenerátor, útkeresés, tereptípusok
  data/      frakciók, egységek, épületek, technológiák, események
  scenes/    Phaser-jelenetek (betöltés, menüháttér, világtérkép)
  render/    3D-s képatlaszok kezelése, festett talaj és köd, címerek, logó
  ui/        DOM-alapú kezelőfelület (HUD, panelek, felugró ablakok, menük)
  storage/   mentés (IndexedDB / Windows-fájlok), beállítások
  platform/  Tauri- és böngészőfüggő réteg
  audio/     szintetizált zene és hangeffektek
  i18n/      szövegek (magyar; új nyelv egy további szótárral adható hozzá)
src-tauri/   a Windows-alkalmazás natív (Rust) rétege
tests/       Vitest tesztek
tools/blender/  a 3D-s modellek és a renderelés Blender-szkriptjei
```

A szabályok (`game/`, `ai/`, `world/`) nem függnek sem a megjelenítéstől, sem a platformtól;
a megjelenítés csak olvassa az állapotot, a módosítás mindig a rendszereken keresztül történik.

## Későbbi bővítési lehetőségek

Ötküldetéses történeti kampány, további térképméretek, angol nyelv, online mentésszinkron.
