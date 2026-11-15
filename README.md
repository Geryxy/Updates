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
- Kódból rajzolt grafika és szintetizált hang: nincs külső fájl, minden offline is működik

## Fejlesztés

```bash
npm install
npm run dev        # fejlesztői szerver: http://localhost:5173 (launcher: /launcher.html)
npm test           # játékszabályok unit tesztjei + teljes 50 körös AI-szimuláció
npm run build      # optimalizált statikus fájlok a dist/ mappába
npm run preview    # a kész build kipróbálása helyben
```

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
  render/    kódból rajzolt grafika (terep, városok, címerek, logó)
  ui/        DOM-alapú kezelőfelület (HUD, panelek, felugró ablakok, menük)
  storage/   mentés (IndexedDB / Windows-fájlok), beállítások
  platform/  Tauri- és böngészőfüggő réteg
  audio/     szintetizált zene és hangeffektek
  i18n/      szövegek (magyar; új nyelv egy további szótárral adható hozzá)
src-tauri/   a Windows-alkalmazás natív (Rust) rétege
tests/       Vitest tesztek
```

A szabályok (`game/`, `ai/`, `world/`) nem függnek sem a megjelenítéstől, sem a platformtól;
a megjelenítés csak olvassa az állapotot, a módosítás mindig a rendszereken keresztül történik.

## Későbbi bővítési lehetőségek

Ötküldetéses történeti kampány, további térképméretek, angol nyelv, online mentésszinkron.
