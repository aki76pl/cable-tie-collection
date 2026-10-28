# Kolekcja Opasek

Siedem parametrycznych modeli opasek i uchwytów do kabli do druku 3D, z podglądem 3D na żywo i eksportem STL / 3MF. Działa jako aplikacja na Windows 11 i jako strona w przeglądarce: <https://aki76pl.github.io/cable-tie-collection/>

## Modele

| Model | Jak się zapina | Materiał |
|---|---|---|
| **Zapadkowa** | Klasyczna „trytytka”: ząbki piłowe na pasku, główka z kanałem i sprężystą zapadką. Zaciska się co jeden ząbek. | PETG lub TPU 95A |
| **Z zadziorami** | Płaski pasek z oczkiem na jednym końcu i elastycznymi zadziorami na drugim. Koniec przekłada się przez oczko, a zadziory rozkładają się za nim. | TPU |
| **Z oczkami** | Pasek z rzędem oczek i grzybkowym kołkiem na drugim końcu (model z [Generatora Opasek](https://github.com/aki76pl/cable-tie-generator)). | TPU 95A |
| **Z klamrą** | Klamra przelotowa jak przy plecaku: rama z poprzeczką i dwiema szczelinami. Regulacja bezstopniowa, trzyma tarcie. Opcjonalne żeberka na pasku. | TPU 95A lub PETG |
| **Montażowa** | Płytka do przykręcenia pod blatem lub na ścianie (otwory z fazą pod łeb stożkowy), z niej wychodzi pasek z oczkami zapinany na kołku na płytce. | TPU 95A |
| **Wielokablowa** | Bloczek z kanałami trzyma kilka kabli równo obok siebie (kable wciska się od góry), a pasek z oczkami zamyka je i zapina się na kołku. | TPU 95A |
| **Klips na blat** | Sprężysta litera C zaciska się na krawędzi biurka bez wkręcania; pod blatem ma zatrzask na kabel lub wiązkę. | PETG lub PLA |

Każdy model ma własny zestaw parametrów, a program sam pilnuje, żeby elementy się mieściły (np. ogranicza liczbę ząbków, zadziorów czy oczek i pokazuje ostrzeżenie). Wszystkie modele drukuje się bez podpór. Siatka jest zawsze szczelna (manifold), bo bryły liczy biblioteka [manifold-3d](https://github.com/elalish/manifold).

## Funkcje

- **Napis na pasku**: wypukły lub wklęsły tekst, np. „TV”, „ROUTER”, „3”. Wielkie litery, cyfry i polskie znaki, do 16 znaków. Program sam robi na niego miejsce i zmniejsza litery, jeśli się nie mieszczą.
- **Test luzów**: tryb podglądu „Test luzów” układa na stole kilka krótkich sztuk różniących się luzem zapięcia (0,1–0,5 mm), z wartością na pasku. Drukujesz, sprawdzasz, która trzyma najlepiej, i wpisujesz ten luz.
- **Profil wydruku**: materiał (TPU 95A, PETG, PLA) i dysza (0,4 / 0,6 mm). Profil ustawia luzy i minimalne grubości oraz ostrzega, gdy materiał nie pasuje do modelu (np. zadziory z PLA).
- **Dopasowanie do wiązki**: wpisujesz średnicę wiązki lub kabla, a program dobiera długość paska albo średnicę uchwytu.
- **Presety**: zapisywanie własnych ustawień, eksport i import do pliku JSON oraz link z parametrami do wersji web.
- **Arkusz wydruku**: różne modele i ilości na jednym stole o podanym wymiarze; eksport do 3MF jako osobne obiekty.
- **Przekrój**: suwak w podglądzie przecina model wzdłuż paska, żeby obejrzeć zapięcie od środka.

## Pobieranie

- **Windows:** gotowe pliki są w zakładce [Releases](../../releases): instalator `KolekcjaOpasek-x.y.z-setup.exe` albo wersja przenośna `KolekcjaOpasek-x.y.z-portable.exe`.
- **Przeglądarka:** <https://aki76pl.github.io/cable-tie-collection/>

> Aplikacja nie ma podpisu cyfrowego, więc przy pierwszym uruchomieniu Windows SmartScreen może wyświetlić ostrzeżenie. Kliknij „Więcej informacji” → „Uruchom mimo to”.

## Rozwój

```bash
npm install
npm run dev        # wersja web z przeładowaniem na żywo
npm run electron   # aplikacja desktopowa
npm run dist       # instalator + wersja portable w folderze release/
```

Nowy model to jeden plik w `src/models/` (parametry, sekcje panelu i funkcja `build`) dopisany do listy w `src/generate.js`. Opcjonalnie model deklaruje miejsce na napis (`label`), ostrzeżenia dla materiałów (`materials`), dopasowanie do wiązki (`fit`) i ustawienia testu luzów (`test`).

## Prawa autorskie i licencja

Copyright © 2026 aki76pl. **Wszelkie prawa zastrzeżone.** Kod jest publiczny do wglądu, ale nie jest open source.

- **Wolno:** przeglądać kod, uruchamiać program i drukować wygenerowane modele na własny, niekomercyjny użytek.
- **Nie wolno** bez pisemnej zgody autora: zmieniać programu, rozpowszechniać go ani wygenerowanych modeli, ani używać ich komercyjnie (w tym sprzedawać modeli i wydruków).

Pełne warunki są w pliku [LICENSE](LICENSE). Inspiracje, źródła wymiarów i licencje użytych bibliotek opisuje plik [NOTICE.md](NOTICE.md).
