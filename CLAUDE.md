# Gitarrenübungen

Gitarren-Übungs-App, live unter https://rutschmann-hub.github.io/gitarre-ueben/

## Tech-Stack

- Reines HTML/CSS/JS – kein Build-Schritt, kein Framework, kein TypeScript
- Persistenz: `localStorage` für lokalen State, GitHub Contents API für Sync (`data/progress.json`)
- Fonts: DM Mono, Fraunces (Google Fonts), Bravura (lokal, für Noten-Symbole)

## Dateistruktur

| Datei | Beschreibung |
|---|---|
| `index.html` | Startseite / Übersicht aller Module |
| `akkord-bandit.html` | Akkord-Bandit: Slot-Maschine für Akkord-Übungen |
| `akkord_griffbrett.html` | Griffbrett-Widget (als iframe in Bandit eingebunden) |
| `fortschritt.html` | Fortschritts-Verlauf (Tabelle, GitHub-Sync) |
| `protokoll.html` | Übungsprotokoll |
| `ueben/akkorde.html` | Akkord-Übungsseite |
| `ueben/sequenzen.html` | Sequenz-Übungen |
| `ueben/skalen.html` | Skalen-Übungen |
| `assets/style.css` | Globales CSS mit CSS-Variablen (Dark-Mode via `prefers-color-scheme`) |
| `assets/github-api.js` | GitHub API Modul (`GitHubAPI.load()` / `.save()`) |
| `data/progress.json` | Fortschrittsdaten im Repo (wird per API geschrieben) |

## Konventionen

- UI-Texte und Kommentare auf **Deutsch**
- Keine Kommentare die nur das WHAT beschreiben – nur wenn das WHY nicht offensichtlich ist
- Keine externen Dependencies einführen
- CSS-Variablen aus `style.css` nutzen (`--accent`, `--surface`, `--border`, `--text` usw.)
- Inline-`<style>` pro Seite für seitenspezifisches CSS ist OK

## Datenpersistenz

`GitHubAPI` (in `assets/github-api.js`) liest/schreibt `data/progress.json` via GitHub Contents API.

```js
const data = await GitHubAPI.load();   // lädt (mit localStorage-Fallback)
data.meineSektion = { ... };
await GitHubAPI.save(data);            // speichert lokal + zu GitHub
```

Das `progress.json` hat folgende Top-Level-Keys:
`sequenzen`, `skalen`, `akkorde`, `fortschritt`, `geuebt`, `proGeuebt`

Lokale localStorage-Keys (nicht überschneiden!):
- `gitueben_bandit_state` – Bandit-Zustand
- `gitueben_geuebt` – Geübt-Zähler (Bandit)
- `gitueben_pro_geuebt` – Pfeile-pro-Zähler
- `akkordGriffbrett.v1` – Griffbrett-Widget-Zustand
- `gh_token`, `gitueben_progress`, `gitueben_sha`, `gitueben_dirty` – GitHubAPI intern

## Griffbrett-Widget (iframe)

`akkord_griffbrett.html` läuft als `<iframe>` in `akkord-bandit.html`. Kommunikation via `postMessage`:

- Elternseite → iframe: `{ chord: 'dom7'|'maj7'|'moll7'|'moll7b5'|'dim7', grundton: 'C'…'B' }`
- iframe → Elternseite: `{ grundtonUpdate: 'C'…'B' }` (wenn User Grundton im Widget ändert)
- iframe → Elternseite: `{ griffbrettHeight: number }` (für responsive iframe-Höhe)
