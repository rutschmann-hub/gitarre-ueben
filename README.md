# 🎸 Gitarrenübungen

Persönliche Web-App zum strukturierten Gitarre-Üben – mit Akkord-Trainer, Skalen, Übungssequenzen und Fortschrittsverfolgung.

**Live:** https://rutschmann-hub.github.io/gitarre-ueben/

## Module

| Seite | Was sie macht |
|---|---|
| **Übungsplan** (`index.html`) | Startseite, Einstieg in alle Kategorien |
| **Akkord-Bandit** (`akkord-bandit.html`) | Slot-Maschine: zieht zufällig Akkordtyp + Grundton (Dom7, Maj7, Moll7, Moll7♭5, Dim7) und zeigt den Griff auf dem Griffbrett |
| **Griffbrett-Widget** (`akkord_griffbrett.html`) | Interaktives Griffbrett, per `iframe` + `postMessage` im Bandit eingebunden |
| **Akkorde** (`ueben/akkorde.html`) | *Platzhalter – noch in Arbeit* |
| **Skalen** (`ueben/skalen.html`) | *Platzhalter – noch in Arbeit* |
| **Sequenzen** (`ueben/sequenzen.html`) | Eigene Abhak-Listen für strukturiertes Üben |
| **Fortschritt** (`fortschritt.html`) | Zeigt pro Akkordtyp × Grundton, wie oft geübt wurde (Rundenbalken je 100 Wiederholungen) |
| **Protokoll** (`protokoll.html`) | Übungstagebuch mit 24 Zeilen (nur lokal gespeichert) |

## Technik

- **Reines HTML/CSS/JS** – kein Build-Schritt, kein Framework, keine externen Dependencies
- **Hosting:** GitHub Pages
- **Speicherung:** zuerst `localStorage`, Sync ausschließlich über ein Google Sheet mit Apps-Script-Web-App (`google-apps-script/fortschritt-api.gs`, Client: `assets/sheet-api.js`) – Geübt-Zähler und Sequenzen, kein Token nötig
- **Design:** CSS-Variablen in `assets/style.css`, automatischer Dark Mode
- **Schriften:** DM Mono, Fraunces (Google Fonts), Bravura (lokal, für Notensymbole)

## Projektstruktur

```
├── index.html               Startseite
├── akkord-bandit.html       Akkord-Slot-Maschine
├── akkord_griffbrett.html   Griffbrett-Widget (iframe)
├── fortschritt.html         Fortschrittsübersicht
├── protokoll.html           Übungsprotokoll
├── ueben/                   Akkorde, Skalen, Sequenzen
├── assets/                  CSS, JS-Module, Fonts, Favicon
├── data/                    archiv.json (Altdaten)
└── google-apps-script/      Backend für den Sheet-Sync
```

## Lokal starten

Kein Build nötig – einfach einen statischen Server im Projektordner starten:

```bash
python3 -m http.server 8000
```

Dann http://localhost:8000 öffnen.
