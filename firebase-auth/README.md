# Koulukyydit – Firebase-versio

Versionumerointi `firebase_2.0.10` kuuluu vain Firebase-versiolle. CSV-versionumero pysyy erillisenä.

Sovellus käyttää Firebase-projektia `kyytikalenteri-auth`, sähköposti- ja salasanakirjautumista sekä Firestore-tietokantaa alueella `europe-north1`. Käyttäjän on vahvistettava sähköpostiosoitteensa ennen kalenteriin liittymistä. Uuden kalenterin luonti on estetty.

## Perhekalenterin käyttöönotto

1. Ota tämän hakemiston Firestore-säännöt käyttöön Firebase Consolessa tai aja Firebase CLI:llä `firebase deploy --only firestore:rules --project kyytikalenteri-auth`.
2. Avaa Firebase-sovellus GitHub Pagesissa polussa `/Kyytikalenteri/firebase-auth/`.
3. Perheenjäsen avaa kirjautumissivun Liity perheeseen kutsukoodilla -toiminnosta, syöttää kutsussa olevan sähköpostin, kalenterin tunnuksen ja koodin sekä vahvistaa sähköpostiosoitteen.
4. Kalenterin ylläpitäjä luo kutsukoodit käyttäjien sähköpostiosoitteille Käyttäjät-osiosta.

Kaikki perheenjäsenet käyttävät samaa `households/{tunnus}/state/calendar`-asiakirjaa. Säännöt rajaavat luku- ja kirjoitusoikeuden vahvistettuun käyttäjään, joka on aktiivinen kalenterin jäsen. Älä lisää tähän hakemistoon Firebase Admin SDK:n yksityisiä avaimia.
