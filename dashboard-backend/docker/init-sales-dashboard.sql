-- Created on first Postgres container init (empty volume only).
-- On existing volumes, dashboard-backend runs `npm run db:ensure` at startup.
CREATE DATABASE sales_dashboard;
