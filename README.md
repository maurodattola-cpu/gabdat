# My Class

Registro scolastico web ispirato ai portali per studenti e famiglie.

## Avvio

Prima serve Node.js 18 o superiore. Se PowerShell dice che `node` o `npm` non esistono, installa Node.js LTS da:

```text
https://nodejs.org/
```

Poi chiudi e riapri PowerShell.

1. Installa le dipendenze:

```powershell
npm install
```

2. Crea il file `.env` partendo da `.env.example` e sostituisci `<db_password>` con la password MongoDB reale.

3. Avvia il server:

```powershell
npm run dev
```

Poi apri:

```text
http://localhost:3000
```

Se `MONGODB_URI` non e configurato, il sito usa dati demo locali.

## Email notifiche

Quando un docente pubblica una comunicazione, il server puo inviare anche una email ai destinatari configurati.

Nel file `.env` aggiungi:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=la-tua-email@gmail.com
SMTP_PASS=la-password-app
NOTIFICATION_EMAIL_FROM=GabDat <la-tua-email@gmail.com>
NOTIFICATION_EMAIL_TO=destinatario1@gmail.com,destinatario2@gmail.com
```

Con Gmail devi usare una password per app, non la password normale dell'account.
