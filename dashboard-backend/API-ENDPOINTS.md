# Dashboard-backend — API-endpoints

Basis-URL (lokaal): `http://localhost:5001`

## Authenticatie

De meeste endpoints vereisen een **JWT** in de header:

```
Authorization: Bearer <token>
```

Het token wordt ondertekend met `JWT_SECRET` (gedeeld met Reppic) en bevat:
`{ id, email, role, company_id }`. De backend leest hieruit de gebruiker en
filtert data automatisch op `company_id` (via `getCompanyFilter`). Een
`superadmin`-rol ziet alle bedrijven.

**Middleware-kolom:**
- `JWT` → vereist een geldig Bearer-token (`requireJwtAuth`)
- `SuperAdmin` → alleen voor `superadmin`-rol (`requireSuperAdmin`)
- `Publiek` → geen auth (login, webhooks, etc.)

De kolom **Reppic** markeert met ⭐ de endpoints die de Reppic-integratie
daadwerkelijk aanroept. De overige endpoints horen bij de eigen frontend van de
backend en zijn optioneel.

---

## ⭐ Endpoints die de Reppic-integratie gebruikt

| Methode | Pad | Auth | Doel |
|---|---|---|---|
| POST | `/api/transcripts` | JWT | **Transcript pushen** (server→server vanuit `dashboardSyncService`, én handmatige upload). Body: `{ filename, content, language, status, isPdf }` |
| GET | `/api/analytics/summary` | JWT | **Strategisch dashboard** data. Query: `lang` (nl/en/…), optioneel `year`, `month`, `demo=true` |
| GET | `/api/analytics/operational` | JWT | **Operationeel dashboard** data (PICA, weerstand, vervolgstappen). Query: `lang`, optioneel `year`, `month`, `demo=true` |
| GET | `/api/plans/status/:language` | JWT | Status van geüploade plannen (of er een strategisch/operationeel plan is) |
| POST | `/api/plans/:planType` | JWT | Strategisch/operationeel **plan uploaden** (`planType` = `strategic` \| `operational`) |
| GET | `/api/plans/:planType` | JWT | Geüpload plan ophalen |
| GET | `/api/companies` | SuperAdmin | Bedrijvenlijst (gebruikt in de handmatige transcript-upload door admins) |
| POST | `/api/ai/suggested-questions` | Publiek | Voorgestelde vervolgvragen voor de conclusie-chat |
| POST | `/api/ai/conclusion-chat` | Publiek | Chat met de AI over een dashboard-conclusie (ConclusionCard) |

---

## Volledige endpoint-lijst

### Auth
| Methode | Pad | Auth |
|---|---|---|
| POST | `/api/auth/login` | Publiek |
| POST | `/api/auth/2fa-verify` | Publiek |
| POST | `/api/auth/logout` | Publiek |
| GET | `/api/auth/me` | Publiek (leest sessie) |
| POST | `/api/auth/forgot-password` | Publiek |
| POST | `/api/auth/reset-password` | Publiek |
| PATCH | `/api/auth/profile` | JWT |
| POST | `/api/auth/2fa/setup` | JWT |
| POST | `/api/auth/2fa/enable` | JWT |
| POST | `/api/auth/2fa/disable` | JWT |

### Bedrijven & gebruikers
| Methode | Pad | Auth |
|---|---|---|
| GET | `/api/companies` | SuperAdmin |
| POST | `/api/companies` | SuperAdmin |
| GET | `/api/company` | JWT |
| PATCH | `/api/companies/:id` | JWT |
| POST | `/api/companies/:id/test-webhook` | SuperAdmin |
| DELETE | `/api/companies/:id` | SuperAdmin |
| GET | `/api/users` | SuperAdmin |
| PATCH | `/api/users/:id/password` | SuperAdmin |
| DELETE | `/api/users/:id` | SuperAdmin |

### Transcripts
| Methode | Pad | Auth |
|---|---|---|
| POST | `/api/transcripts` | JWT |
| GET | `/api/transcripts` | JWT |
| GET | `/api/transcripts/:id` | JWT |
| DELETE | `/api/transcripts/:id` | JWT |

### Plannen & strategie-documenten
| Methode | Pad | Auth |
|---|---|---|
| POST | `/api/strategy-documents` | JWT |
| GET | `/api/strategy-documents` | JWT |
| POST | `/api/plans/:planType` | JWT |
| GET | `/api/plans` | JWT |
| GET | `/api/plans/:planType` | JWT |
| GET | `/api/plans/status/:language` | JWT |
| DELETE | `/api/plans/:planType` | JWT |

### Analytics
| Methode | Pad | Auth |
|---|---|---|
| GET | `/api/analytics/summary` | JWT |
| GET | `/api/analytics/operational` | JWT |
| DELETE | `/api/analytics/snapshots/:type` | JWT |
| GET | `/api/reanalysis/status/:language` | Publiek |

### AI (conclusies & chat)
| Methode | Pad | Auth |
|---|---|---|
| POST | `/api/ai/tile-chat` | Publiek |
| POST | `/api/ai/suggested-questions` | Publiek |
| POST | `/api/ai/conclusion-chat` | Publiek |
| POST | `/api/ai/tile-conclusion` | Publiek |
| POST | `/api/ai/management-conclusion` | Publiek |

### Overig
| Methode | Pad | Auth | Doel |
|---|---|---|---|
| POST | `/api/webhooks/assemblyai` | Publiek | Webhook transcriptie-provider |
| GET | `/api/brandkit/logo` | Publiek | Bedrijfslogo ophalen |
| POST | `/api/brandkit/logo` | Publiek | Logo uploaden |
| DELETE | `/api/brandkit/logo` | Publiek | Logo verwijderen |
| GET | `/robots.txt` | Publiek | — |

---

## Voorbeelden

**Transcript pushen (zoals Reppic doet, server→server):**
```bash
curl -X POST http://localhost:5001/api/transcripts \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "filename": "Gesprek met Acme BV",
    "content": "<volledige transcript-tekst>",
    "language": "nl",
    "status": "pending",
    "isPdf": false
  }'
```

**Strategische analyse ophalen:**
```bash
curl "http://localhost:5001/api/analytics/summary?lang=nl" \
  -H "Authorization: Bearer <JWT>"
```

**Operationele analyse ophalen:**
```bash
curl "http://localhost:5001/api/analytics/operational?lang=nl" \
  -H "Authorization: Bearer <JWT>"
```

> Zonder geldig token geven de JWT-endpoints `401 {"error":"Niet ingelogd"}`.
> Dat is de snelste manier om te checken of de backend draait en bereikbaar is.
