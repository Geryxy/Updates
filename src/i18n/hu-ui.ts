/** Magyar szövegek: kezelőfelület, menük, oktatómód. */
export const huUi: Record<string, string> = {
  // Általános
  'ui.ok': 'Rendben', 'ui.cancel': 'Mégse', 'ui.back': 'Vissza', 'ui.close': 'Bezárás', 'ui.nothing': 'Nincs',
  'ui.perTurn': 'körönként', 'ui.year': '{n}. év', 'ui.turn': 'Kör {n}/{max}', 'ui.turnShort': '{n}. kör',
  'ui.turns': '{n} kör', 'ui.turnsLeft': 'még {n} kör', 'ui.now': 'most',
  'ui.diplomacy': 'Diplomácia', 'ui.research': 'Kutatás', 'ui.economy': 'Gazdaság', 'ui.supplyView': 'Utánpótlás',
  'ui.nextArmy': 'Következő sereg', 'ui.menu': 'Menü', 'ui.endTurn': 'Kör vége', 'ui.log': 'Eseménynapló', 'ui.tasks': 'Aktuális feladatok',
  'ui.settings': 'Beállítások', 'ui.help': 'Irányítás és súgó', 'ui.tutorial': 'Oktatómód', 'ui.seasons': 'Évszakok',
  'ui.seasonHint': 'Négy kör után új évszak következik. Egy év tizenhat körből áll.',
  'ui.zoomIn': 'Nagyítás', 'ui.zoomOut': 'Kicsinyítés', 'ui.home': 'Ugrás a fővárosra',
  'ui.aiTurn': 'Az ellenfelek lépnek…', 'ui.noIdleArmy': 'Nincs több mozgatható hadsereg.',

  // Főmenü
  'menu.subtitle': 'A birodalmak felemelkedése',
  'menu.new': 'Új játék', 'menu.continue': 'Játék folytatása', 'menu.load': 'Mentés betöltése', 'menu.tutorial': 'Oktatómód',
  'menu.exit': 'Vissza a launcherbe', 'menu.noSave': 'Még nincs mentett játék.',
  'menu.chooseFaction': 'Válaszd ki a királyságodat', 'menu.style': 'Játékstílus', 'menu.difficulty': 'Nehézség', 'menu.map': 'Térkép',
  'menu.map.preset': 'Eldória', 'menu.map.random': 'Véletlenszerű',
  'menu.map.preset.desc': 'Az előre elkészített, kiegyensúlyozott világtérkép.',
  'menu.map.random.desc': 'Minden játékban új, véletlenszerűen generált kontinens.',
  'menu.start': 'Játék indítása',
  'diff.easy': 'Könnyű', 'diff.normal': 'Normál', 'diff.hard': 'Nehéz',
  'diff.easy.desc': 'Az ellenfelek pontatlanul mérlegelnek, sokszor tétlenek, és későn üzennek hadat.',
  'diff.normal.desc': 'Az ellenfelek megfontoltan építkeznek és csak kedvező esélyekkel támadnak.',
  'diff.hard.desc': 'Az ellenfelek pontosan számolnak, összevonják seregeiket és kivárják a jó pillanatot – csalás nélkül.',

  // Játékmenü és mentés
  'gm.resume': 'Vissza a játékba', 'gm.save': 'Játék mentése', 'gm.load': 'Játék betöltése', 'gm.quit': 'Kilépés a főmenübe',
  'save.slot.auto': 'Automatikus mentés', 'save.slot.slot1': '1. mentési hely', 'save.slot.slot2': '2. mentési hely', 'save.slot.slot3': '3. mentési hely',
  'save.empty': 'Üres', 'save.saveHere': 'Mentés ide', 'save.load': 'Betöltés', 'save.delete': 'Törlés',
  'save.saved': 'A játék elmentve.', 'save.saveFail': 'A mentés nem sikerült.', 'save.loaded': 'Mentés betöltve.',
  'save.loadFail': 'A mentés nem tölthető be.', 'save.importFail': 'Érvénytelen vagy sérült mentésfájl.',
  'save.file': 'Mentés fájlba', 'save.fileHint': 'A mentést JSON-fájlként exportálhatod, és bármelyik eszközön importálhatod.',
  'save.export': 'Exportálás (JSON)', 'save.import': 'Importálás (JSON)',

  // Beállítások
  'set.music': 'Zene hangereje', 'set.sfx': 'Hangeffektek', 'set.mute': 'Minden hang némítása',
  'set.quality': 'Grafika', 'set.quality.low': 'Alacsony (takarékos)', 'set.quality.medium': 'Közepes', 'set.quality.high': 'Magas',
  'set.fullscreen': 'Teljes képernyő (F11)', 'set.windowSize': 'Ablakméret', 'set.saves': 'Mentések helye', 'set.openSaves': 'Mentések mappájának megnyitása',
  'set.webSaves': 'A mentések ezen az eszközön, a böngésző tartós tárolójában (IndexedDB) vannak.',
  'set.version': 'Verzió: {v}',
  'help.win': 'Bal kattintás: mező vagy hadsereg kijelölése; kiemelt mezőre kattintva mozgás, támadás|Jobb kattintás: menetparancs távoli mezőre|Egérgörgő: nagyítás · Húzás: térkép mozgatása|Enter: kör vége · N: következő sereg · C: főváros|D: diplomácia · K: kutatás · G: gazdaság · U: utánpótlás-nézet · L: napló|Esc: panel bezárása vagy menü · Ctrl+S: gyorsmentés · F11: teljes képernyő',
  'help.touch': 'Koppintás: mező vagy hadsereg kijelölése|Kijelölt sereggel koppints egy kiemelt mezőre a mozgáshoz vagy támadáshoz|Távoli mező: koppints rá, majd „Menetelés ide”|Húzás egy ujjal: térkép mozgatása · Két ujj: nagyítás|Az alsó sáv gombjaival minden funkció elérhető',
  'help.goalTitle': 'A győzelem útjai',
  'help.goal': 'Területi: a mezők 65%-a három egymást követő körben|Katonai: két ellenséges főváros elfoglalása és megtartása|Pontozás: az 50. kör végén a legerősebb királyság nyer|Vereség: ha minden városod és sereged odavész',

  // Mezőpanel
  'tile.unknown': 'Ismeretlen terület', 'tile.unknownHint': 'Sűrű köd borítja. Küldj felderítőket, hogy feltárd!',
  'tile.owner': 'Tulajdonos', 'tile.unowned': 'Gazdátlan', 'tile.terrain': 'Terep', 'tile.move': 'Mozgási költség', 'tile.defense': 'Védelmi bónusz',
  'tile.yield': 'Hozam', 'tile.resource': 'Lelőhely', 'tile.features': 'Jellemzők', 'tile.river': 'Folyó', 'tile.road': 'Út', 'tile.ruin': 'Feltáratlan rom',
  'tile.notVisible': 'A terület jelenleg nincs látótávolságon belül.',

  // Város
  'city.level': 'Városszint', 'city.pop': 'Lakosság', 'city.happiness': 'Elégedettség', 'city.defense': 'Erődítés', 'city.building': 'Építkezés',
  'city.training': 'Kiképzés', 'city.manage': 'Város kezelése', 'city.buildTab': 'Építés', 'city.recruitTab': 'Toborzás',
  'city.tab.overview': 'Áttekintés', 'city.tab.build': 'Építkezés', 'city.tab.recruit': 'Toborzás',
  'city.tax': 'Adóbevétel', 'city.foodNeed': 'Élelemigény', 'city.construction': 'Folyamatban', 'city.buildings': 'Épületek', 'city.slots': 'építési hely',
  'city.slotsFree': 'Szabad építési hely: {n}', 'city.upgrade': 'Városfejlesztés', 'city.upgradeTo': 'Fejlesztés: {level}',
  'city.upgradeDesc': '{slots} építési hely, {pop} fős népességkorlát, nagyobb adó és termelés.',
  'city.upgradeBtn': 'Fejlesztés', 'city.buildBtn': 'Építés', 'city.recruitBtn': 'Toborzás', 'city.cancel': 'Visszavonás',
  'city.idle': 'Jelenleg nem folyik építkezés.', 'city.noTraining': 'Nincs kiképzés alatt álló osztag.', 'city.waiting': 'helyre vár',
  'city.lost': 'A város már nincs a birtokodban.',
  'unit.stats': 'Támadás {a} · Védelem {d} · Mozgás {m}', 'unit.upkeep': 'Fenntartás', 'unit.popCost': '100 lakos',

  // Hadsereg
  'army.men': 'Létszám', 'army.squads': 'osztag', 'army.morale': 'Morál', 'army.supply': 'Ellátottság', 'army.moves': 'Mozgáspont', 'army.xp': 'Tapasztalat',
  'army.hint': 'Koppints egy kiemelt mezőre: fehér = mozgás, piros = támadás, kék = egyesítés.',
  'army.noMoves': 'A hadsereg ebben a körben már nem mozoghat.',
  'army.attack': 'Támadás', 'army.march': 'Menetelés ide ({army})', 'army.cancelMarch': 'Menet megszakítása',
  'army.found': 'Város alapítása', 'army.split': 'Osztag leválasztása', 'army.splitFail': 'Nincs szabad szomszédos mező a leválasztáshoz.',

  // Csata
  'battle.title': 'Csata előtt', 'battle.attacker': 'Támadó', 'battle.defender': 'Védő', 'battle.power': 'Harci erő',
  'battle.estLoss': 'Becsült veszteség', 'battle.men': 'fő', 'battle.chance': 'Győzelmi esély',
  'battle.risk.low': 'Alacsony kockázat', 'battle.risk.medium': 'Mérsékelt kockázat', 'battle.risk.high': 'Magas kockázat', 'battle.risk.extreme': 'Szinte reménytelen',
  'battle.note': 'A harci erő a fenti tényezők szorzata. A hadiszerencse a támadó erejét legfeljebb ±15%-kal módosítja.',
  'battle.gone': 'A célpont már nem támadható.',
  'battle.won': 'Győzelem!', 'battle.lost': 'Vereség', 'battle.reportLine': '{turn}. kör · hadiszerencse: {roll}',
  'battle.cityCaptured': 'Elfoglalt város: {city}', 'battle.before': 'Csata előtt', 'battle.after': 'Csata után', 'battle.losses': 'Veszteség', 'battle.fateLabel': 'Kimenetel',
  'battle.fate.held': 'Megtartotta állásait', 'battle.fate.advanced': 'Előrenyomult', 'battle.fate.retreated': 'Visszavonult',
  'battle.fate.destroyed': 'Megsemmisült', 'battle.fate.repelled': 'Visszaverték',

  // Diplomácia
  'dip.hint': 'Az uralkodók mérlegelik az erőviszonyokat, a kapcsolatot és saját érdekeiket. A gombokon látod, mire számíthatsz.',
  'dip.relation': 'Kapcsolat', 'dip.power': 'Katonai erő', 'dip.lands': 'Területek', 'dip.you': 'te', 'dip.dead': 'Ez a királyság elbukott.',
  'dip.tag.war': 'Háború', 'dip.tag.alliance': 'Szövetség', 'dip.tag.trade': 'Kereskedelem', 'dip.tag.nap': 'Meg nem támadás ({n} kör)',
  'dip.tag.truce': 'Fegyverszünet ({n} kör)', 'dip.tag.peace': 'Béke',
  'dip.likely': 'várhatóan elfogadja', 'dip.unlikely': 'várhatóan elutasítja',
  'dip.jointwar': 'Közös háború: {target}', 'dip.gift': 'Pénzbeli támogatás', 'dip.giftHint': 'Javítja a kapcsolatot.',
  'dip.war': 'Hadüzenet', 'dip.warBreak': 'Hadüzenet (szerződésszegés!)',
  'dip.warTitle': 'Hadüzenet: {faction}', 'dip.warText': 'A háború megszakítja a kereskedelmet. Érvényes szerződés megszegése minden uralkodó bizalmát megrendíti.',
  'dip.cancel.trade': 'Kereskedelem felmondása', 'dip.cancel.nap': 'Szerződés felmondása', 'dip.cancel.alliance': 'Szövetség felmondása',
  'dip.accepted': 'Az ajánlatot elfogadták.', 'dip.refused': 'Az ajánlatot elutasították.', 'dip.total': 'Összesen (szükséges: {need})',
  'prop.title': '{faction} követe érkezett', 'prop.accept': 'Elfogadom', 'prop.reject': 'Elutasítom',
  'prop.trade': '{faction} kereskedelmi megállapodást ajánl: mindkét királyság körönként többletaranyhoz jut.',
  'prop.nap': '{faction} meg nem támadási szerződést ajánl tíz körre.',
  'prop.alliance': '{faction} katonai szövetséget ajánl: közös ellátás, átvonulás és kölcsönös védelem.',
  'prop.peace': '{faction} békét kér. A háború véget ér, és hat körös fegyverszünet lép életbe.',
  'prop.jointwar': '{faction} közös hadviselésre hív.',

  // Kutatás
  'res.done': 'Kész', 'res.cost': '{n} kutatási pont', 'res.start': 'Kutatás', 'res.requires': 'Feltétel: {name}',
  'res.rate': 'Kutatás: +{n} pont körönként.', 'res.current': 'Folyamatban: {name}.', 'res.none': 'Nincs kiválasztott kutatás.',

  // Gazdaság
  'eco.net': 'Egyenleg körönként', 'eco.stock': 'Készlet', 'eco.research': 'Kutatás: +{n}/kör', 'eco.lands': 'Területek: {n} (cél: {goal})',
  'eco.cities': 'Városok: {n}', 'eco.capitals': 'Elfoglalt fővárosok: {n}/2', 'eco.modifiers': 'Érvényes hatások',
  'mod.boom': 'Kereskedelmi fellendülés (+30% arany)', 'mod.reforms': 'Reformígéret (−15% arany)', 'mod.rationing': 'Fejadag (−30% fenntartás)',

  // Eseményhatások
  'fx.happy': 'Elégedettség', 'fx.pop': 'Népesség', 'fx.morale': 'Morál', 'fx.research': 'Kutatás', 'fx.rel': 'Kapcsolat', 'fx.relOther': 'Harmadik fél',
  'fx.deposit': 'Új vaslelőhely', 'fx.mercs': '2 zsoldososztag', 'fx.none': 'Nincs közvetlen hatás',

  // Feladatok
  'task.none': 'Minden rendben – zárd le a kört!', 'task.event': 'Esemény vár a döntésedre', 'task.proposal': 'Követ vár a válaszodra',
  'task.food': 'Élelemhiány fenyeget ({n}/kör)', 'task.gold': 'Veszteséges a kincstár ({n}/kör)', 'task.research': 'Válassz kutatást',
  'task.build': '{city}: üres az építési sor', 'task.unhappy': '{city}: lázadás veszélye', 'task.supply': '{army}: nincs utánpótlás',
  'task.idle': '{army} parancsra vár',

  // Játék vége
  'end.victory': 'Győzelem!', 'end.defeat': 'Vereség', 'end.score': 'A játék véget ért', 'end.toMenu': 'Vissza a főmenübe', 'end.viewMap': 'Térkép megtekintése',
  'score.territory': 'Terület', 'score.cities': 'Városok', 'score.economy': 'Gazdaság', 'score.military': 'Hadsereg', 'score.diplomacy': 'Diplomácia', 'score.total': 'Összesen',

  // Oktatómód
  'tut.label': 'Küldetés {n}/{max}:', 'tut.done': 'Az oktatómód véget ért – Eldória a tiéd, uralkodj bölcsen!',
  'tut.0.title': 'A térkép használata', 'tut.0.short': 'Mozgasd a térképet, és jelöld ki a fővárosodat',
  'tut.0.text': 'Húzd a térképet (egérrel vagy ujjal), nagyíts görgővel vagy két ujjal, majd jelöld ki a csillaggal jelölt fővárosodat. A köd az ismeretlen vidéket takarja.',
  'tut.1.title': 'A gazdaság működése', 'tut.1.short': 'Nyisd meg a Gazdaság ablakot',
  'tut.1.text': 'A felső sáv mutatja az öt erőforrást és körönkénti változásukat. Nyisd meg a Gazdaság ablakot (koppints egy erőforrásra a felső sávban, vagy nyomd meg a G-t), és nézd meg, miből áll a bevételed. Télen az élelemtermelés megfeleződik!',
  'tut.2.title': 'Építkezés', 'tut.2.short': 'Indíts el egy építkezést a fővárosban',
  'tut.2.text': 'Jelöld ki a fővárost, nyisd meg az Építés fület, és építs például fakopácstelepet vagy laktanyát. Az építkezés több körig tart, az építési helyek száma véges.',
  'tut.3.title': 'A hadsereg mozgatása', 'tut.3.short': 'Mozgasd a hadseregedet egy szomszédos mezőre',
  'tut.3.text': 'Jelöld ki a seregedet (pajzs a fővárosnál), majd koppints egy fehérrel kiemelt mezőre. A gazdátlan mezők a tieid lesznek, amint rájuk lépsz. Az erdő és a hegy több mozgáspontba kerül.',
  'tut.4.title': 'Harc', 'tut.4.short': 'Támadd meg a közeli útonállókat',
  'tut.4.text': 'A főváros közelében útonállók táboroznak. Vidd a közelükbe a sereget, majd koppints a pirossal kiemelt mezőre. A csata előtti képernyő megmutatja az esélyeket – csak utána döntesz.',
  'tut.5.title': 'Diplomácia', 'tut.5.short': 'Tegyél diplomáciai ajánlatot vagy küldj ajándékot',
  'tut.5.text': 'Nyisd meg a Diplomácia ablakot (D). Ajánlj kereskedelmi megállapodást valamelyik szomszédnak, vagy küldj pénzbeli támogatást a kapcsolat javítására.',
  'army.bandits': 'Útonállók',
};
Object.assign(huUi, {
  // Launcher
  'l.play': 'Játék indítása', 'l.starting': 'Indítás…', 'l.exit': 'Kilépés', 'l.mode': 'Megjelenítés',
  'l.fullscreen': 'Teljes képernyő', 'l.windowed': 'Ablakos mód', 'l.versionLabel': 'Játék verziója',
  'set.fullscreen.on': 'Teljes képernyő',
});
