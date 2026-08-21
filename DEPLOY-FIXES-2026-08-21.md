# Productie-deploy — fixes 2026-08-21

Vier fixes, end-to-end geverifieerd op de testomgeving (`app.testreppic.nl`).
Alles zit in deze `main`; alleen stap "Handmatig op productie" hieronder is geen code.

## De fixes

| # | Commit | Wat |
|---|---|---|
| 1 | `fd920f7` | **Desktop-opname-webhook**: `RECALL_SDK_WEBHOOK_SECRET` wordt nu doorgegeven aan de app-container (Dockerfile ARG/ENV + docker-compose build-args én runtime) + build-heapflag tegen OOM |
| 2/3 | `974910a` + `4ae620b` | **Dashboard-gesprekssamenvatting**: geen zichtbare HTML-tags (`<span class="small-gap">`) meer — escape-first i.p.v. dubbele formattering |
| 4 | `d5f4884` | **Analyse-tag**: analyse-route valt terug op de env-tag (`baseline`) als de route zelf geen tag heeft → voorkomt de LiteLLM-gateway-500 (`'>' not supported between NoneType and int`) |

## Deploy (productie)

1. Laatste `main` pullen (of deze export-zip gebruiken).
2. **Handmatig op productie** (niet in code): in de prod-`.env` zetten
   ```
   RECALL_SDK_WEBHOOK_SECRET=whsec_...
   ```
   Dit is de **Signing Secret** van het Recall-webhook-endpoint
   `https://app.reppic.ai/api/webhooks/recall-sdk` (Recall-dashboard → Webhooks →
   dat endpoint → Signing Secret → onthullen). `RECALL_WEBHOOK_SECRET` (bot)
   blijft ongewijzigd staan.
3. Herbouwen + recreaten (**`--build`** verplicht — Next.js bakt de env-waarde bij
   `next build` in de serverbundle):
   ```
   docker compose up -d --build app
   ```
4. Controle in de container:
   ```
   docker compose exec app printenv RECALL_SDK_WEBHOOK_SECRET   # toont whsec_...
   ```
5. In Recall → endpoint `recall-sdk` → gefaalde events **Replay** (haalt eerder
   mislukte opnames alsnog binnen).

## Verificatie

- Desktop-opname → in de app-log: `[Recall SDK Webhook] Event received:
  sdk_upload.complete` → `Created conversation:` → `Conversation analysis
  completed`; in Recall staat de aflevering op **Succeeded (200)**.
- Gesprekssamenvatting in het dashboard toont schone tekst zonder `<span…>`-tags.

## Opmerking over fix 4 (analyse-tag)
Deze 500 trad alleen op met een **virtuele sleutel** (die `/model/info` niet mag
lezen → routes zonder tag). Een productiesleutel mét `/model/info`-toegang heeft
al een tag, dus productie draaide de analyse al. De fix is een strikt veiliger
terugval (`tag ?? "baseline"`) die productie niet verandert wanneer de tag al
gezet is, en beschermt tegen het randgeval dat hij ontbreekt.
