# Gitarrenübungen

Gitarren-Übungs-App, live unter https://rutschmann-hub.github.io/gitarre-ueben/

## Tech-Stack

- Reines HTML/CSS/JS – kein Build-Schritt, kein Framework, kein TypeScript
- Persistenz: `localStorage` für lokalen State, Google Sheet + Apps Script als einziger Sync-Weg
- Fonts: DM Mono, Fraunces (Google Fonts), Bravura (lokal, für Noten-Symbole)

## Dateistruktur

| Datei | Beschreibung |
|---|---|
| `index.html` | Startseite / Übersicht aller Module |
| `akkord-bandit.html` | Akkord-Bandit: Slot-Maschine für Akkord-Übungen |
| `akkord_griffbrett.html` | Griffbrett-Widget (als iframe in Bandit eingebunden) |
| `fortschritt.html` | Geübt-Zähler pro Akkordtyp × Tonart (Sheet-Sync) |
| `protokoll.html` | Übungsprotokoll (nur localStorage) |
| `ueben/akkorde.html` | Akkord-Übungsseite (Platzhalter) |
| `ueben/sequenzen.html` | Sequenz-Übungen (Sheet-Sync) |
| `ueben/skalen.html` | Skalen-Übungen (Platzhalter) |
| `assets/style.css` | Globales CSS mit CSS-Variablen (Dark-Mode via `prefers-color-scheme`) |
| `assets/sheet-api.js` | Client für das Sheet-Backend (`SheetAPI`) |
| `google-apps-script/fortschritt-api.gs` | Backend-Quelltext; wird manuell im Apps-Script-Editor des Sheets eingefügt und neu bereitgestellt |
| `data/archiv.json` | Alte Durchlauf-Daten, wird von keiner Seite gelesen |

## Konventionen

- UI-Texte und Kommentare auf **Deutsch**
- Keine Kommentare die nur das WHAT beschreiben – nur wenn das WHY nicht offensichtlich ist
- Keine externen Dependencies einführen
- CSS-Variablen aus `style.css` nutzen (`--accent`, `--surface`, `--border`, `--text` usw.)
- Inline-`<style>` pro Seite für seitenspezifisches CSS ist OK

## Datenpersistenz

Grundsatz: **localStorage zuerst**, das Google Sheet wird im Hintergrund nachgezogen. Ein älterer Sheet-Stand darf lokale, noch nicht hochgeladene Änderungen nie überschreiben.

`SheetAPI` (in `assets/sheet-api.js`) spricht die Apps-Script-Web-App an:

```js
const data = await SheetAPI.load();   // { geuebt, proGeuebt, sequenzen } oder null (offline)
await SheetAPI.zaehleHoch('geuebt', 'dom7', 'G', zeit);         // +1, serverseitig addiert
await SheetAPI.speichereEintrag('geuebt', 'dom7', 'G', 12, zeit); // auf mind. 12 setzen
await SheetAPI.speichereDaten('sequenzen', {...});               // ganzes Objekt ersetzen
```

Sheet-Blätter (werden bei Bedarf automatisch angelegt):
- `Fortschritt`: `Zaehler | Typ | Grundton | Count | LetzteUebung`
- `Daten`: `Schluessel | JSON` (aktuell nur `sequenzen`)

Die Web-App-URL ist öffentlich, daher validiert `doPost` alle Werte gegen Whitelists (Zähler, Akkordtypen, Grundtöne, erlaubte Daten-Schlüssel) und läuft unter `LockService`. Neue Typen oder Schlüssel müssen dort ergänzt werden. Nach Änderungen am `.gs` muss die Web-App neu bereitgestellt werden (Bereitstellungen verwalten → Bearbeiten → Neue Version), sonst läuft der alte Code weiter.

Lokale localStorage-Keys (nicht überschneiden!):
- `gitueben_bandit_state` – Bandit-Zustand
- `gitueben_geuebt` – Geübt-Zähler (Bandit)
- `gitueben_pro_geuebt` – Pfeile-pro-Zähler
- `gitueben_sequenzen`, `gitueben_sequenzen_dirty` – Sequenzen + „noch nicht hochgeladen“-Flag
- `gitueben_protokoll` – Übungsprotokoll
- `akkordGriffbrett.v1` – Griffbrett-Widget-Zustand
- `gitueben_migrated`, `gitueben_migrated_grundton` – einmalige Migrationen erledigt
- `gitueben_progress` – Altlast aus dem GitHub-Sync, wird nur noch einmalig für Sequenzen ausgelesen

## Griffbrett-Widget (iframe)

`akkord_griffbrett.html` läuft als `<iframe>` in `akkord-bandit.html`. Kommunikation via `postMessage`:

Nachrichten gehen nur an `location.origin`, Empfänger prüfen `e.source`.

- Elternseite → iframe: `{ chord: 'dom7'|'maj7'|'moll7'|'moll7b5'|'dim7', grundton: 'C'…'B' }`
- iframe → Elternseite: `{ grundtonUpdate: 'C'…'B' }` (wenn User Grundton im Widget ändert)
- iframe → Elternseite: `{ griffbrettHeight: number }` (für responsive iframe-Höhe)
