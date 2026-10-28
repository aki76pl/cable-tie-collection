# Kolekcja Opasek

Cztery parametryczne modele opasek do kabli do druku 3D, z podglądem 3D na żywo i eksportem STL / 3MF. Działa jako aplikacja na Windows 11 i jako strona w przeglądarce.

To osobny projekt obok [Generatora Opasek](https://github.com/aki76pl/cable-tie-generator) (opaska z oczkami i grzybkiem). Tutaj są cztery inne konstrukcje.

## Modele

| Model | Jak się zapina | Materiał |
|---|---|---|
| **Zapadkowa** | Klasyczna „trytytka”: ząbki piłowe na pasku, główka z kanałem i sprężystą zapadką. Zaciska się co jeden ząbek. | PETG lub TPU 95A |
| **Z zadziorami** | Płaski pasek z oczkiem na jednym końcu i elastycznymi zadziorami na drugim. Koniec przekłada się przez oczko, a zadziory rozkładają się za nim. | TPU |
| **Montażowa** | Płytka do przykręcenia pod blatem lub na ścianie (otwory z fazą pod łeb stożkowy), z niej wychodzi pasek z oczkami zapinany na kołku na płytce. | TPU 95A |
| **Z klamrą** | Klamra przelotowa jak przy plecaku: rama z poprzeczką i dwiema szczelinami. Regulacja bezstopniowa, trzyma tarcie. Opcjonalne żeberka na pasku. | TPU 95A lub PETG |

Każdy model ma własny zestaw parametrów (długość, szerokość i grubość paska oraz wymiary zapięcia), a program sam pilnuje, żeby elementy się mieściły, np. ogranicza liczbę ząbków, zadziorów czy oczek i pokazuje ostrzeżenie. Wszystkie modele drukuje się płasko, bez podpór. Siatka jest zawsze szczelna (manifold), bo bryły liczy biblioteka [manifold-3d](https://github.com/elalish/manifold).

## Rozwój

```bash
npm install
npm run dev        # wersja web z przeładowaniem na żywo
npm run electron   # aplikacja desktopowa
npm run dist       # instalator + wersja portable w folderze release/
```

Nowy model to jeden plik w `src/models/` (parametry, sekcje panelu i funkcja `build`) dopisany do listy w `src/generate.js`.

## Licencja

MIT
