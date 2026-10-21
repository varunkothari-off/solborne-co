-- Solborne-only operational ledger. No KFS schema or customer record changes.
CREATE TABLE solborne_presales.businesses (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_key text NOT NULL UNIQUE CHECK(length(business_key) BETWEEN 1 AND 160),
 display_name text NOT NULL CHECK(length(display_name) BETWEEN 1 AND 200),
 owner_confirmed_customer_at timestamptz,
 confirmation_note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE solborne_presales.payments (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 business_id uuid NOT NULL REFERENCES solborne_presales.businesses(id),
 payment_reference text NOT NULL UNIQUE,
 status text NOT NULL CHECK(status IN ('pending','paid','failed','refunded','cancelled')),
 confirmed_at timestamptz,
 CHECK(status <> 'paid' OR confirmed_at IS NOT NULL),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX solborne_paid_businesses ON solborne_presales.payments(business_id) WHERE status='paid';
CREATE TABLE solborne_presales.website_deliveries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 delivery_key text NOT NULL UNIQUE,
 business_id uuid REFERENCES solborne_presales.businesses(id),
 project_name text NOT NULL,
 website_url text NOT NULL,
 delivery_status text NOT NULL CHECK(delivery_status IN ('draft','reviewed','delivered','withdrawn')),
 free_website boolean NOT NULL DEFAULT true,
 is_house_project boolean NOT NULL DEFAULT false,
 confirmed_at timestamptz,
 CHECK(delivery_status <> 'delivered' OR confirmed_at IS NOT NULL),
 confirmation_note text,
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE solborne_presales.businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE solborne_presales.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE solborne_presales.website_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON solborne_presales.businesses,solborne_presales.payments,solborne_presales.website_deliveries FROM PUBLIC,anon,authenticated,solborne_presales_runtime;
-- Only explicitly approved aggregate output is public. No names, amounts or identities.
CREATE FUNCTION public.solborne_public_metrics() RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
 SELECT jsonb_build_object(
 'businessesHelped',(SELECT count(*) FROM solborne_presales.businesses b WHERE b.owner_confirmed_customer_at IS NOT NULL OR EXISTS(SELECT 1 FROM solborne_presales.payments p WHERE p.business_id=b.id AND p.status='paid' AND p.confirmed_at IS NOT NULL)),
 'freeWebsitesDelivered',(SELECT count(*) FROM solborne_presales.website_deliveries WHERE free_website AND delivery_status='delivered' AND confirmed_at IS NOT NULL));
$$;
REVOKE ALL ON FUNCTION public.solborne_public_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.solborne_public_metrics() TO anon,authenticated,service_role;
INSERT INTO solborne_presales.businesses(business_key,display_name,owner_confirmed_customer_at,confirmation_note)
VALUES('kisno-propty-llp','KISNO PROPTY LLP',now(),'Baseline business helped explicitly confirmed by Varun, 21 October 2026. No payment amount or transaction is asserted.');
INSERT INTO solborne_presales.website_deliveries(delivery_key,business_id,project_name,website_url,delivery_status,is_house_project,confirmed_at,confirmation_note)
SELECT v.key,b.id,v.name,v.url,'delivered',true,now(),'Existing delivery explicitly confirmed by Varun, 21 October 2026; confirmation time is not a historical delivery date.'
FROM solborne_presales.businesses b CROSS JOIN (VALUES
 ('kfs','KFS','https://kfs.solborne.in/'),('avasa','Avasa','https://avasa.solborne.in/'),('solborne','Solborne & Co.','https://solborne.in/')
) AS v(key,name,url) WHERE b.business_key='kisno-propty-llp';
