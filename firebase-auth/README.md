# Koulukyydit – Firebase-versio

Versionumerointi `F_2.0.20` kuuluu vain Firebase-versiolle. CSV-versionumero pysyy erillisenä.

## Varmuuskopio data

Parametrit-osiossa jokainen aktiivinen kalenterin käyttäjä voi valita **Tee CSV-varmuuskopio**. Toiminto odottaa selaimesta käynnistetyt Firebase-tallennukset ja lukee kalenterin sekä sallitut jäsenyystiedot suoraan Firestore-palvelimelta. Ilman yhteyttä tai tarvittavia oikeuksia tiedostoa ei luoda. Vanhat CSV-tiedoston avaamisen toiminnot, paikallisen tiedoston jatkuva tallennus ja WhatsApp-lähetyksen varmuuskopiokysymys on poistettu Firebase-versiosta.

CSV-latauksen käynnistyttyä sen ajankohta tallennetaan palvelimen aikaleimalla kalenterin yhteiseen `households/{tunnus}/state/backup`-asiakirjaan (`lastBackupAt`, `lastBackupBy`). Parametreissa näkyy viimeisin kirjattu ajankohta. Tieto ei riipu selaimen paikallisesta muistista eikä katoa CSV-palautuksessa. Selain ei voi varmistaa, onko ladattu tiedosto lopulta tallennettu levylle; aikaleima tarkoittaa latauksen käynnistämistä. Jos aikaleiman tallennus epäonnistuu, käyttäjälle näytetään ilmoitus ja muistutus jää voimaan.

Kaikille aktiivisille käyttäjille kysytään varmuuskopiota, kun edellisestä on kulunut yli 30 vuorokautta. Jos ajankohtaa ei vielä ole, kysytään ensimmäisen kirjatun kopion tekemistä. Peruuttamisen jälkeen samalta käyttäjältä kysytään samassa selainistunnossa aikaisintaan seuraavana päivänä. Tilanne tarkistetaan kirjautumisen jälkeen, sivulle palattaessa ja tunnin välein. Tuore yhteinen varmuuskopio kuittaa muistutuksen kaikilta käyttäjiltä.

CSV:n merkistö on UTF-8 (BOM), rivinvaihto CRLF ja sarakkeet ovat alkuperäiset `type,date,direction,person`. Alkuperäiset `parameter`, `saldo`, `person`, `trip` ja `note` -rivit säilyvät samassa muodossa, mukaan lukien hintahistoria, maksun etumerkki ja käytöstä poistetut henkilöt. `parameter,version` säilyttää alkuperäisen CSV-muodon version `1.1.22`.

Lisätietueet käyttävät samoja neljää saraketta:

| type | date | direction | person |
| --- | --- | --- | --- |
| `calendar` | Kalenterin tunnus | `metadata` | JSON: `id`, `name`, `ownerUid`, `memberScope`, `exportedAt`, `appVersion` |
| `member` | Firebase Auth UID | Rooli (`owner`, `admin`, `member`) | JSON: `email`, `active`, `joinedAt` |

Omistajan ja pääkäyttäjän (`admin`) varmuuskopiossa ovat kaikki kalenterin Firestore-jäsenyydet, myös passiiviset (`memberScope: all`). Tavallisen käyttäjän kopiossa ovat kaikki kalenteritiedot sekä vain oma jäsenyys (`memberScope: self`). Ero näytetään käyttöliittymässä. Näin käyttäjäluettelon nykyiset lukuoikeudet säilyvät. Jäsenyydet kuvaavat kalenterin käyttöoikeuksia, eivät Firebase-projektin kaikkien Auth-tilien luetteloa. Salasanoja, salaisia kirjautumis- tai istuntotunnisteita tai kutsukoodeja ei viedä. Vanha CSV-lukija voi käsitellä kalenterimerkinnät ja ohittaa uudet tietuetyypit; Auth-tilejä ei voi palauttaa tällä CSV:llä.

**Palauta CSV-varmuuskopio** on varmuuskopion tekemisen napin alapuolella. Omistaja tai ylläpitäjä valitsee CSV-tiedoston (enintään 5 Mt). Tiedosto tarkistetaan ja vahvistuskysymyksessä näytetään lähde- ja kohdekalenteri, henkilöiden, päivien ja maksujen määrät sekä päivämerkintöjen ajanjakso. **Peruuta** keskeyttää muuttamatta tietoja.

Hyväksytty palautus korvaa kalenterin henkilöt, päivämerkinnät, maksut ja hintahistorian kaikilta kuukausilta. Kalenterin käyttäjäjäsenyyksiä, tunnuksia ja käyttöoikeuksia ei palauteta tai muuteta. Alkuperäisen muodon CSV:t sekä uudet varmuuskopiot käyvät palautukseen. Palautus kirjoitetaan Firestore-transaktiolla ja keskeytetään, jos kalenteri on muuttunut vahvistuskysymyksen aikana, kirjautuminen vaihtuu, oikeudet puuttuvat tai yhteys ei toimi. Paikallinen kalenteri päivitetään onnistuneen tallennuksen jälkeen.

Kuukausiyhteenvedon alareunan **Tee PDF** lataa valitun kuukauden A4-pystyraportin. Raportissa näkyvät samat maksut ja saldot kuin kuukausiyhteenvedossa sekä päivien henkilöt ja merkinnät aamu- ja iltasarakkeissa. Päivät ilman merkintöjä jätetään pois. Päivätaulukko tiivistyy tarvittaessa: tavallinen 20 koulupäivän kuukausi mahtuu yhdelle sivulle. Poikkeuksellisen pitkä sisältö jatkuu lisäsivuille ilman tietojen poisjättämistä. Koko päivälle tallennetut merkinnät näytetään molemmissa sarakkeissa.

PDF luodaan selaimessa paikallisesti kirjastolla jsPDF 4.2.1 (`vendor/jspdf.umd.min.js`, MIT-lisenssi tiedostossa `vendor/jspdf-LICENSE.txt`). Raporttitietoja ei lähetetä PDF-palveluun.

Sovellus käyttää Firebase-projektia `kyytikalenteri-auth`, sähköposti- ja salasanakirjautumista sekä Firestore-tietokantaa alueella `europe-north1`. Käyttäjän on vahvistettava sähköpostiosoitteensa ennen kalenteriin liittymistä. Uuden kalenterin luonti on estetty.

## Kalenterin käyttöönotto

1. Ota tämän hakemiston Firestore-säännöt käyttöön Firebase Consolessa tai aja Firebase CLI:llä `firebase deploy --only firestore:rules --project kyytikalenteri-auth`.
2. Avaa Firebase-sovellus GitHub Pagesissa polussa `/Kyytikalenteri/firebase-auth/`.
3. Käyttäjä avaa kirjautumissivun Liity kutsukoodilla -toiminnosta, syöttää kutsussa olevan sähköpostin, kalenterin tunnuksen ja koodin sekä vahvistaa sähköpostiosoitteen.
4. Kalenterin ylläpitäjä luo kutsukoodit käyttäjien sähköpostiosoitteille Käyttäjät-osiosta.

Kaikki kalenterin käyttäjät käyttävät samaa `households/{tunnus}/state/calendar`-asiakirjaa. Säännöt rajaavat luku- ja kirjoitusoikeuden vahvistettuun käyttäjään, joka on aktiivinen kalenterin jäsen. Älä lisää tähän hakemistoon Firebase Admin SDK:n yksityisiä avaimia.
