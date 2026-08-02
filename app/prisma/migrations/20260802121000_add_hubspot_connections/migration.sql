-- Gespreksvoorbereiding (fase 2): HubSpot-koppeling per tenant.
-- Tokens encrypted-at-rest (AES-256-GCM, src/lib/crypto/secretBox.ts).

CREATE TABLE "hubspot_connections" (
    "id" VARCHAR(40) NOT NULL,
    "company_id" VARCHAR(40) NOT NULL,
    "portal_id" VARCHAR(32) NOT NULL,
    "access_token_enc" TEXT NOT NULL,
    "refresh_token_enc" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "scopes" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'active',
    "connected_by" VARCHAR(40),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hubspot_connections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "hubspot_connections_company_id_key" ON "hubspot_connections"("company_id");
