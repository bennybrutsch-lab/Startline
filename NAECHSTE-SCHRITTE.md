# Nächste Schritte

Stand: 18.11.2026. Diese Datei hält fest, was entschieden ist und als Nächstes kommt.

## Entschieden: 26 Wege statt 6

Die App soll 26 Wege anbieten, etwas Eigenes aufzubauen. Gewählt nach dem, was junge Leute selbst nutzen.

**Creator und Social Media**
1. Eigener TikTok- oder YouTube-Kanal
2. Faceless-Kanal mit KI
3. Clipper: Clips für große Creator schneiden
4. Video-Editor für Creator
5. UGC-Creator: Videos für Marken drehen
6. Thumbnail- und Grafik-Designer für Creator
7. Streamer auf Twitch oder Kick
8. Podcast mit Freunden
9. Eigene Community auf Discord oder als WhatsApp-Kanal
10. Social-Media-Manager für junge Marken

**Fashion, Sneaker und Reselling**
11. Sneaker-Reselling
12. Vintage-Reselling auf Vinted und Depop
13. Trading Cards
14. Sneaker-Customizing und -Cleaning
15. Fashion-Kanal mit Outfits, Hauls und Thrift-Flips

**KI und Apps**
16. Websites mit KI für Läden (hat schon einen fertigen Plan)
17. Eigene App bauen und veröffentlichen
18. KI-Tool für eine Nische
19. Roblox-Spiele bauen
20. Discord-Bots
21. KI-Chatbots und Automationen für Firmen und Creator
22. Online-Shops für junge Marken einrichten
23. KI-Werbeclips und KI-Bilder für Marken
24. Notion-, Canva- und KI-Vorlagen verkaufen
25. KI-Avatare und Voiceover
26. Tools für Reseller

Gestrichen: Eventfotografie und alles, was nach Nebenjob für Erwachsene klingt, außerdem Print-on-Demand, Merch für Creator, Schmuck-Marke, Streetwear-Marke, KI-Kurse für Schüler, Kleidung upcyclen.

## Entschieden: So entstehen die Pläne

- Pro Weg ein Steckbrief: Beschreibung, ehrlicher Satz, rechtliche Hinweise, drei Vertiefungsfragen, vier Etappen mit Ziel und je drei Meilensteinen.
- Die KI schreibt aus Steckbrief und Antworten einen Plan für 30 Tage. Die App prüft und speichert ihn.
- Der Website-Weg behält seinen handgeschriebenen Plan.
- Die Fragen schlagen direkt drei aus allen 26 Wegen vor.

## Erledigt: Teil 1, Fragen und Steckbriefe

- Antworten sammeln Eigenschaften (Kamera, Schnitt, Design, Technik, Verkaufen, Kunden, Eigenes bauen, Tempo, Geduld, Community, Schreiben, Startgeld) statt Punkte für sechs Richtungen.
- Jeder Weg hat ein Profil aus diesen Eigenschaften. Die drei Wege mit der besten Übereinstimmung werden vorgeschlagen, der dritte aus einem anderen Bereich.
- Zwei neue Fragen, damit 26: Welcher Bereich reizt dich am meisten? Was machst du am Handy oder Laptop am meisten?
- Steckbriefe für alle 26 Wege in `daten/wege.json`. Der Website-Weg heißt jetzt überall „Websites mit KI für Läden“.

Noch zu prüfen von einem Menschen:
- Die Texte der Steckbriefe gegenlesen, vor allem die ehrlichen Sätze und die rechtlichen Hinweise. Mindestalter und Regeln der Plattformen ändern sich.
- Die Profile der Wege in `daten/wege.json` sind eine erste Einschätzung. Mit echten Testpersonen nachjustieren. Reselling-Wege kommen bei zufälligen Antworten etwas häufiger vor, Discord-Bots und Online-Shops seltener.

## Erledigt: Teil 2, Plan-Erstellung durch die KI

- Beim Wählen eines neuen Weges schreibt die KI 30 Tage aus dem Steckbrief und den Antworten der Person, als festes Format, geprüft vor dem Speichern (`src/plan-ki.js`).
- Die neuen Wege haben drei Vertiefungsfragen, der Website-Weg sechs. Die App zeigt die echte Zahl und darüber die rechtlichen Hinweise des Weges.
- Der Mentor kennt die rechtlichen Hinweise des gewählten Weges.
- Ohne Schlüssel bleiben die neuen Wege auf „Plan kommt bald“.
- Kostenbremse: höchstens 3 KI-Pläne pro Nutzer und Tag. Dafür gibt es die neue Tabelle `plan_erstellungen`, also einmal `npm run db:lokal` ausführen.

Noch nicht mit der echten KI ausprobiert. Geprüft ist der ganze Ablauf mit einer nachgebauten Antwort der Schnittstelle. Wie gut die Pläne wirklich sind, zeigt sich erst mit Schlüssel.

## Erledigt: Design

- Aussehen in Weiß, Schwarz und Türkis mit dem Logo, für alle Ansichten.
- Am Handy sitzt das Menü unten, am Rechner oben.
- Farben und Rundungen stehen als Variablen oben in `public/stil.css`.

## Als Nächstes

- Mit echtem Schlüssel für drei bis fünf verschiedene Wege einen Plan schreiben lassen und lesen: Sind die Aufgaben klein genug, bauen die Tage aufeinander auf, stehen die rechtlichen Hinweise an sinnvollen Tagen?
- Danach die Regeln in `src/plan-ki.js` nachschärfen.
- Messen, wie lange ein Plan dauert und was er kostet.

## Offen bei Benny

- Schlüssel für die Claude-Schnittstelle anlegen und in `.dev.vars` eintragen (siehe LIESMICH.md).
- Mentor, angepasste Tagesaufgaben und einen KI-Plan für einen neuen Weg mit echtem Schlüssel ausprobieren und ein Bildschirmfoto schicken.
- Internetadresse und Marke „Startline“ prüfen.

## Später, nicht jetzt

Bezahlung, Englisch, Altersprüfung, Impressum und Datenschutz, Begrenzung der Anmeldeversuche, „Ich hänge fest“-Knopf, Wochenrückblick.
