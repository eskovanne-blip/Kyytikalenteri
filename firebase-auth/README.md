# Koulukyydit – Firebase-versio

Versionumerointi `firebase_2.0.6` kuuluu vain Firebase-versiolle. Seuraava julkaisu käyttää numeroa `firebase_2.0.7`. CSV-versionumero pysyy erillisenä.

Sovellus käyttää Firebase-projektia `kyytikalenteri-auth`, sähköposti- ja salasanakirjautumista sekä Firestore-tietokantaa alueella `europe-north1`. Käyttäjän on vahvistettava sähköpostiosoitteensa ennen kalenterin luomista tai siihen liittymistä.

## Perhekalenterin käyttöönotto

1. Ota tämän hakemiston Firestore-säännöt käyttöön Firebase Consolessa tai aja Firebase CLI:llä `firebase deploy --only firestore:rules --project kyytikalenteri-auth`.
2. Avaa Firebase-sovellus GitHub Pagesissa polussa `/Kyytikalenteri/firebase-auth/`.
3. Luo käyttäjätili, vahvista sähköpostiosoite ja kirjaudu sisään.
4. Ensimmäinen käyttäjä luo yhteisen kalenterin. Hän luo kutsukoodin jokaiselle perheenjäsenelle tämän sähköpostiosoitteella.
5. Perheenjäsen rekisteröityy samalla sähköpostilla, vahvistaa osoitteensa ja syöttää kalenterin tunnuksen sekä kutsukoodin.

Kaikki perheenjäsenet käyttävät samaa `households/{tunnus}/state/calendar`-asiakirjaa. Säännöt rajaavat luku- ja kirjoitusoikeuden vahvistettuun käyttäjään, joka on aktiivinen kalenterin jäsen. Älä lisää tähän hakemistoon Firebase Admin SDK:n yksityisiä avaimia.

