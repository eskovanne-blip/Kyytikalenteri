# Kyytikalenteri – Firebase-versio

Sovelluksen versio on `2.0.35`. GitHub Pagesin etusivu ohjaa tähän Firebase-sovellukseen.

## Pyhä- ja liputuspäivät

Kuukausikalenterissa ja päivän tiedoissa näkyvät Suomen valtakunnalliset pyhäpäivät, juhannus- ja jouluaatto sekä viralliset ja vakiintuneet liputuspäivät. Toistuvat päivät lasketaan nykyisten sääntöjen mukaan. Yksittäiset valtakunnalliset liputuspäivät lisätään julkaistujen päivämäärien perusteella. Kalenteripäivät ovat näkymän tietoja, eivät kyytimerkintöjä.

Lähteet ovat Yliopiston almanakkatoimiston [juhlapäivät](https://almanakka.helsinki.fi/fi/liputus-ja-juhlapaivat/), [liputuspäivät](https://almanakka.helsinki.fi/fi/liputus-ja-juhlapaivat/liputuspaivat-suomessa/) ja [vuoden 2027 liputuspäivät](https://almanakka.helsinki.fi/fi/liputus-ja-juhlapaivat/liputuspaivat-2027/).

## Kuskimerkinnät

Päivälle voi merkitä yhden aamukuskin ja yhden iltakuskin. Uusi valinta korvaa saman ajosuunnan aiemman kuskin. Jos vanhassa päivämerkinnässä on samalle ajosuunnalle useita kuskeja, viimeinen merkintä ratkaisee.

## Ajosuunnan hinta

Parametreissa näkyvät nykyinen hinta ja ajastetut hinnat. Syötä uusi hinta ja valitse voimaantulopäivä. Oletuksena on seuraavan kuukauden ensimmäinen päivä. Kyyti lasketaan sen päivänä voimassa olleella hinnalla. Samalle voimaantulopäivälle tallennettu uusi hinta korvaa aiemman hinnan. Voit poistaa ajastetun muutoksen ennen sen voimaantuloa.

## Maksujen hallinta

Kuukauden loppusaldo siirtyy seuraavan kuukauden pohjasaldoksi samalla etumerkillä. Edellinen kuukausi on valmiiksi valittuna. Voit vaihtaa nykyiseen kuukauteen. Kun valitset henkilön, voit muokata ehdotettua summaa ennen maksun vahvistamista. Valitse henkilön nimi uudelleen, jos haluat täydentää osasuoritusta tai poistaa kuukauden maksumerkinnän ja palauttaa saldon. Suoritus-sarakkeessa tähdellä merkitty summa tarkoittaa henkilölle maksettua summaa. Jos samalle kuukaudelle on kirjattu maksuja molempiin suuntiin, Suoritus näyttää molemmat summat.

## Varmuuskopiointi ja palautus

Parametrit-osiossa jokainen aktiivinen kalenterin käyttäjä voi valita **Tee CSV-varmuuskopio**. Toiminto odottaa selaimesta käynnistetyt Firebase-tallennukset ja lukee kalenterin sekä sallitut jäsenyystiedot suoraan Firestore-palvelimelta. Ilman yhteyttä tai tarvittavia oikeuksia tiedostoa ei luoda. Vanhat CSV-tiedoston avaamisen toiminnot, paikallisen tiedoston jatkuva tallennus ja WhatsApp-lähetyksen varmuuskopiokysymys on poistettu Firebase-versiosta.

CSV-latauksen käynnistyttyä sen ajankohta tallennetaan palvelimen aikaleimalla kalenterin yhteiseen `households/{tunnus}/state/backup`-asiakirjaan (`lastBackupAt`, `lastBackupBy`, `lastBackupByEmail`, `lastBackupVersion`). Parametreissa kaikille kalenterin jäsenille näkyvät viimeisin kirjattu ajankohta ja kopion tehneen käyttäjän sähköpostiosoite sekä varmuuskopion luoneen sovelluksen versio, jos tiedot ovat saatavilla. Tieto ei riipu selaimen paikallisesta muistista eikä katoa CSV-palautuksessa. Selain ei voi varmistaa, onko ladattu tiedosto lopulta tallennettu levylle; aikaleima tarkoittaa latauksen käynnistämistä. Jos aikaleiman tallennus epäonnistuu, käyttäjälle näytetään ilmoitus ja muistutus jää voimaan.

Kaikille aktiivisille käyttäjille kysytään varmuuskopiota, kun edellisestä on kulunut yli 30 vuorokautta. Jos ajankohtaa ei vielä ole, kysytään ensimmäisen kirjatun kopion tekemistä. Peruuttamisen jälkeen samalta käyttäjältä kysytään samassa selainistunnossa aikaisintaan seuraavana päivänä. Tilanne tarkistetaan kirjautumisen jälkeen, sivulle palattaessa ja tunnin välein. Tuore yhteinen varmuuskopio kuittaa muistutuksen kaikilta käyttäjiltä.

CSV:n merkistö on UTF-8 (BOM), rivinvaihto CRLF ja sarakkeet ovat alkuperäiset `type,date,direction,person`. Alkuperäiset `parameter`, `saldo`, `person`, `trip` ja `note` -rivit säilyvät samassa muodossa, mukaan lukien hintamuutokset, maksun etumerkki ja käytöstä poistetut henkilöt. Peräkkäisistä samanhintaisista merkinnöistä viedään vain ensimmäinen. `parameter,version` sisältää varmuuskopion luoneen Kyytikalenterin version.

Lisätietueet käyttävät samoja neljää saraketta:

| type | date | direction | person |
| --- | --- | --- | --- |
| `saldo-maksettu` | Kuukausi | Henkilölle maksettu summa | Henkilön nimi |
| `calendar` | Kalenterin tunnus | `metadata` | JSON: `id`, `name`, `ownerUid`, `memberScope`, `exportedAt`, `appVersion` |
| `member` | Firebase Auth UID | Rooli (`owner`, `admin`, `member`) | JSON: `email`, `active`, `joinedAt` |

Omistajan ja pääkäyttäjän (`admin`) varmuuskopiossa ovat kaikki kalenterin Firestore-jäsenyydet, myös passiiviset (`memberScope: all`). Tavallisen käyttäjän kopiossa ovat kaikki kalenteritiedot sekä vain oma jäsenyys (`memberScope: self`). Ero näytetään käyttöliittymässä. Näin käyttäjäluettelon nykyiset lukuoikeudet säilyvät. Jäsenyydet kuvaavat kalenterin käyttöoikeuksia, eivät Firebase-projektin kaikkien Auth-tilien luetteloa. Salasanoja, salaisia kirjautumis- tai istuntotunnisteita tai kutsukoodeja ei viedä. Vanha CSV-lukija voi käsitellä kalenterimerkinnät ja ohittaa uudet tietuetyypit; Auth-tilejä ei voi palauttaa tällä CSV:llä.

**Palauta CSV-varmuuskopio** on varmuuskopion tekemisen napin alapuolella. Omistaja tai ylläpitäjä valitsee CSV-tiedoston (enintään 5 Mt). Tiedosto tarkistetaan ja vahvistuskysymyksessä näytetään lähde- ja kohdekalenteri, henkilöiden, päivien ja maksujen määrät sekä päivämerkintöjen ajanjakso. **Peruuta** keskeyttää muuttamatta tietoja.

Hyväksytty palautus korvaa kalenterin henkilöt, päivämerkinnät, maksut ja hintahistorian kaikilta kuukausilta. Kalenterin käyttäjäjäsenyyksiä, tunnuksia ja käyttöoikeuksia ei palauteta tai muuteta. Alkuperäisen muodon CSV:t sekä uudet varmuuskopiot käyvät palautukseen. Palautus kirjoitetaan Firestore-transaktiolla ja keskeytetään, jos kalenteri on muuttunut vahvistuskysymyksen aikana, kirjautuminen vaihtuu, oikeudet puuttuvat tai yhteys ei toimi. Paikallinen kalenteri päivitetään onnistuneen tallennuksen jälkeen.

Kuukausiyhteenvedon alareunan **Tee PDF** lataa valitun kuukauden A4-pystyraportin. Raportissa näkyvät samat maksut ja saldot kuin kuukausiyhteenvedossa sekä päivien henkilöt ja merkinnät aamu- ja iltasarakkeissa. Päivät ilman merkintöjä jätetään pois. Päivätaulukko tiivistyy tarvittaessa: tavallinen 20 arkipäivän kuukausi mahtuu yhdelle sivulle. Poikkeuksellisen pitkä sisältö jatkuu lisäsivuille ilman tietojen poisjättämistä. Loma ja poissaolo näytetään kerran aamun sarakkeessa. Uudet Oma kyyti -merkinnät näkyvät siinä sarakkeessa, jolle ne valittiin. Vanha Oma kyyti -merkintä ilman ajosuuntatietoa näkyy molemmissa sarakkeissa.

PDF luodaan selaimessa paikallisesti kirjastolla jsPDF 4.2.1 (`vendor/jspdf.umd.min.js`, MIT-lisenssi tiedostossa `vendor/jspdf-LICENSE.txt`). Raporttitietoja ei lähetetä PDF-palveluun.

**Lähetä yhteenveto** muodostaa samasta raporttipohjasta 1680 × 2376 pikselin PNG-kuvan jokaiselle A4-sivulle. Esikatselun **Jaa kuva** avaa tiedostojen jakamista tukevan selaimen jakovalikon, josta käyttäjä valitsee WhatsAppin ja vastaanottajan. Kuvan voi aina tallentaa myös PNG-tiedostona ja liittää viestiin itse. Kuvan muodostus tapahtuu paikallisesti selaimessa.

Sovellus käyttää Firebase-projektia `kyytikalenteri-auth`, sähköposti- ja salasanakirjautumista sekä Firestore-tietokantaa alueella `europe-north1`. Käyttäjän on vahvistettava sähköpostiosoitteensa ennen kalenteriin liittymistä. Uuden kalenterin luonti on estetty.

## Kalenterin käyttöönotto

1. Ota tämän hakemiston Firestore-säännöt ja indeksit käyttöön Firebase CLI:llä `firebase deploy --only firestore:rules,firestore:indexes --project kyytikalenteri-auth`.
2. Avaa Firebase-sovellus GitHub Pagesissa polussa `/Kyytikalenteri/firebase-auth/`.
3. Käyttäjä avaa kirjautumissivun Liity kutsukoodilla -toiminnosta, syöttää kutsussa olevan sähköpostin, kalenterin tunnuksen ja koodin sekä vahvistaa sähköpostiosoitteen.
4. Kalenterin ylläpitäjä luo kutsukoodit käyttäjien sähköpostiosoitteille Käyttäjät-osiosta.

Kaikki kalenterin käyttäjät käyttävät samaa `households/{tunnus}/state/calendar`-asiakirjaa. Säännöt rajaavat luku- ja kirjoitusoikeuden vahvistettuun käyttäjään, joka on aktiivinen kalenterin jäsen. Älä lisää tähän hakemistoon Firebase Admin SDK:n yksityisiä avaimia.

Kirjautuminen löytää jäsenyyden myös uudessa selaimessa. Vahvistetulla sähköpostiosoitteella haetaan vain käyttäjän omat `members`-asiakirjat ja tarvittaessa hänelle osoitetut `invites`-asiakirjat collection group -hauilla. Aktiivinen kutsu hyväksytään transaktiossa, joka lisää oman jäsenyyden ja merkitsee kutsun käytetyksi yhdessä. Käytetty kutsu ei estä jo liittyneen käyttäjän kirjautumista. Paikallismuistin kalenteritunnus on vain nopeutus: jäsenyys tarkistetaan palvelimelta. Kyselyt edellyttävät `firestore.indexes.json`-tiedoston sähköpostihakemistoja ja tämän version sääntöjä. Haut eivät anna pääsyä muiden käyttäjien jäsenyyksiin tai kutsuihin.
