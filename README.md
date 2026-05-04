# Web Preview

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
