--
-- PostgreSQL database dump
--

\restrict 7OwUqtcg9f8XkdTFN17C2OtWfavx1uhU1DvomBVsm3uJW49JYQmC5bQFBcseVSo

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: btree_gist; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;


--
-- Name: citext; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS citext WITH SCHEMA public;


--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: account_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.account_type AS ENUM (
    'bank',
    'investment',
    'pension',
    'loan',
    'custody',
    'other'
);


--
-- Name: asset_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.asset_class AS ENUM (
    'cash',
    'equity_public',
    'equity_private',
    'fixed_income',
    'property',
    'pension',
    'private_equity_fund',
    'debt_instrument',
    'other'
);


--
-- Name: audit_action; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.audit_action AS ENUM (
    'INSERT',
    'UPDATE',
    'DELETE'
);


--
-- Name: compliance_severity; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.compliance_severity AS ENUM (
    'info',
    'warning',
    'breach'
);


--
-- Name: entity_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.entity_type AS ENUM (
    'company',
    'spv',
    'trust',
    'partnership',
    'holding_company',
    'foundation'
);


--
-- Name: scenario_event_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.scenario_event_type AS ENUM (
    'business_sale',
    'inheritance',
    'relocation',
    'divorce',
    'tax_residency_change',
    'property_sale',
    'liquidity_event',
    'pe_exit',
    'dividend_recap',
    'leverage_change',
    'custom'
);


--
-- Name: transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.transaction_type AS ENUM (
    'buy',
    'sell',
    'deposit',
    'withdrawal',
    'dividend',
    'interest',
    'fee',
    'transfer',
    'valuation_adjustment',
    'distribution'
);


--
-- Name: user_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role AS ENUM (
    'admin',
    'adviser',
    'client'
);


--
-- Name: audit_row_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.audit_row_change() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_user_id UUID;
  v_firm_id UUID;
BEGIN
  BEGIN
    v_user_id := NULLIF(current_setting('app.current_user_id', true), '')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    v_firm_id := OLD.firm_id;
    INSERT INTO audit_log (firm_id, table_name, row_id, action, changed_by, before_data, after_data)
    VALUES (v_firm_id, TG_TABLE_NAME, OLD.id, 'DELETE', v_user_id, to_jsonb(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    v_firm_id := NEW.firm_id;
    INSERT INTO audit_log (firm_id, table_name, row_id, action, changed_by, before_data, after_data)
    VALUES (v_firm_id, TG_TABLE_NAME, NEW.id, 'UPDATE', v_user_id, to_jsonb(OLD), to_jsonb(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    v_firm_id := NEW.firm_id;
    INSERT INTO audit_log (firm_id, table_name, row_id, action, changed_by, before_data, after_data)
    VALUES (v_firm_id, TG_TABLE_NAME, NEW.id, 'INSERT', v_user_id, NULL, to_jsonb(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: account; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    owner_person_id uuid,
    owner_entity_id uuid,
    account_type public.account_type NOT NULL,
    provider text,
    currency_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    policy_number text,
    CONSTRAINT chk_account_owner_exactly_one CHECK (((((owner_person_id IS NOT NULL))::integer + ((owner_entity_id IS NOT NULL))::integer) = 1))
);

ALTER TABLE ONLY public.account FORCE ROW LEVEL SECURITY;


--
-- Name: adviser_household_assignment; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adviser_household_assignment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    adviser_id uuid NOT NULL,
    household_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.adviser_household_assignment FORCE ROW LEVEL SECURITY;


--
-- Name: app_user; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_user (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    email public.citext NOT NULL,
    role public.user_role NOT NULL,
    person_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    password_hash text,
    display_name text,
    phone text,
    address_line1 text,
    city text,
    postal_code text
);

ALTER TABLE ONLY public.app_user FORCE ROW LEVEL SECURITY;


--
-- Name: asset; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.asset (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    name text NOT NULL,
    asset_class public.asset_class NOT NULL,
    identifier text,
    currency_id uuid NOT NULL,
    is_liability boolean DEFAULT false NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    source_of_funds text
);

ALTER TABLE ONLY public.asset FORCE ROW LEVEL SECURITY;


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid,
    table_name text NOT NULL,
    row_id uuid NOT NULL,
    action public.audit_action NOT NULL,
    changed_by uuid,
    before_data jsonb,
    after_data jsonb,
    changed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.audit_log FORCE ROW LEVEL SECURITY;


--
-- Name: client_document; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_document (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    document_type text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_data bytea NOT NULL,
    source text DEFAULT 'uploaded'::text NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.client_document FORCE ROW LEVEL SECURITY;


--
-- Name: client_note; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.client_note (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    author_id uuid,
    note text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.client_note FORCE ROW LEVEL SECURITY;


--
-- Name: compliance_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid,
    entity_id uuid,
    severity public.compliance_severity NOT NULL,
    rule_code text NOT NULL,
    message text NOT NULL,
    detected_at timestamp with time zone DEFAULT now() NOT NULL,
    resolved_at timestamp with time zone,
    resolved_by uuid,
    metadata jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE ONLY public.compliance_log FORCE ROW LEVEL SECURITY;


--
-- Name: compliance_provider_actions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compliance_provider_actions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    provider_id uuid NOT NULL,
    adviser_id uuid NOT NULL,
    loa_template_id uuid,
    loa_version integer,
    documents_sent jsonb DEFAULT '[]'::jsonb NOT NULL,
    email_status text DEFAULT 'PENDING'::text NOT NULL,
    email_error text,
    sent_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.compliance_provider_actions FORCE ROW LEVEL SECURITY;


--
-- Name: currency; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.currency (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character(3) NOT NULL,
    name text NOT NULL,
    symbol text
);


--
-- Name: entity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    name text NOT NULL,
    entity_type public.entity_type NOT NULL,
    jurisdiction text,
    registration_number text,
    base_currency_id uuid NOT NULL,
    household_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.entity FORCE ROW LEVEL SECURITY;


--
-- Name: entity_ownership; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entity_ownership (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    owner_person_id uuid,
    owner_entity_id uuid,
    owned_entity_id uuid NOT NULL,
    ownership_pct numeric(7,4) NOT NULL,
    ownership_class text,
    valid_from date NOT NULL,
    valid_to date,
    structure_version_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    valid_range daterange GENERATED ALWAYS AS (daterange(valid_from, valid_to, '[)'::text)) STORED,
    CONSTRAINT chk_not_self_owned CHECK ((owner_entity_id IS DISTINCT FROM owned_entity_id)),
    CONSTRAINT chk_owner_exactly_one CHECK (((((owner_person_id IS NOT NULL))::integer + ((owner_entity_id IS NOT NULL))::integer) = 1)),
    CONSTRAINT chk_valid_range CHECK (((valid_to IS NULL) OR (valid_to > valid_from))),
    CONSTRAINT entity_ownership_ownership_pct_check CHECK (((ownership_pct >= (0)::numeric) AND (ownership_pct <= (100)::numeric)))
);

ALTER TABLE ONLY public.entity_ownership FORCE ROW LEVEL SECURITY;


--
-- Name: exchange_rate; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.exchange_rate (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    from_currency_id uuid NOT NULL,
    to_currency_id uuid NOT NULL,
    rate_date date NOT NULL,
    rate numeric(20,10) NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT exchange_rate_rate_check CHECK ((rate > (0)::numeric))
);


--
-- Name: fact_find; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fact_find (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    review_purposes jsonb DEFAULT '{}'::jsonb NOT NULL,
    personal_circumstances jsonb DEFAULT '{}'::jsonb NOT NULL,
    income_expenditure jsonb DEFAULT '{}'::jsonb NOT NULL,
    assets jsonb DEFAULT '{}'::jsonb NOT NULL,
    liabilities jsonb DEFAULT '{}'::jsonb NOT NULL,
    insurance jsonb DEFAULT '{}'::jsonb NOT NULL,
    investment_questions jsonb DEFAULT '{}'::jsonb NOT NULL,
    retirement_questions jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_capacity jsonb DEFAULT '{}'::jsonb NOT NULL,
    risk_questionnaire jsonb DEFAULT '[]'::jsonb NOT NULL,
    risk_score numeric(5,2),
    risk_category text,
    declaration jsonb DEFAULT '{}'::jsonb NOT NULL,
    completed_on date,
    signed_on date,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.fact_find FORCE ROW LEVEL SECURITY;


--
-- Name: firm; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.firm (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    base_currency_id uuid,
    fca_reference text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fund; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    name text NOT NULL,
    isin text NOT NULL,
    sedol text,
    sector text NOT NULL,
    asset_class text NOT NULL,
    ocf numeric(6,4),
    yield_pct numeric(6,4),
    risk_rating smallint,
    volatility_pct numeric(6,4),
    max_drawdown_pct numeric(6,4),
    manager text,
    manager_tenure_years numeric(5,2),
    esg_score numeric(5,2),
    currency_id uuid,
    inception_date date,
    aum numeric(20,2),
    description text,
    data_source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fund_risk_rating_check CHECK (((risk_rating >= 1) AND (risk_rating <= 7)))
);

ALTER TABLE ONLY public.fund FORCE ROW LEVEL SECURITY;


--
-- Name: fund_allocation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_allocation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    fund_id uuid NOT NULL,
    category text NOT NULL,
    weight_pct numeric(6,3) NOT NULL,
    as_of_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.fund_allocation FORCE ROW LEVEL SECURITY;


--
-- Name: fund_holdings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_holdings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    fund_id uuid NOT NULL,
    holding_name text NOT NULL,
    holding_weight_pct numeric(6,3) NOT NULL,
    as_of_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.fund_holdings FORCE ROW LEVEL SECURITY;


--
-- Name: fund_performance; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_performance (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    fund_id uuid NOT NULL,
    period text NOT NULL,
    return_pct numeric(8,4) NOT NULL,
    as_of_date date DEFAULT CURRENT_DATE NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.fund_performance FORCE ROW LEVEL SECURITY;


--
-- Name: fund_screen; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fund_screen (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    created_by uuid,
    name text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.fund_screen FORCE ROW LEVEL SECURITY;


--
-- Name: holding; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.holding (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    account_id uuid NOT NULL,
    asset_id uuid NOT NULL,
    as_of_date date NOT NULL,
    quantity numeric(24,8),
    market_value numeric(20,2) NOT NULL,
    currency_id uuid NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.holding FORCE ROW LEVEL SECURITY;


--
-- Name: household; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    name text NOT NULL,
    primary_adviser_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.household FORCE ROW LEVEL SECURITY;


--
-- Name: household_member; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.household_member (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    person_id uuid NOT NULL,
    relationship text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.household_member FORCE ROW LEVEL SECURITY;


--
-- Name: income; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.income (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    person_id uuid NOT NULL,
    income_type text NOT NULL,
    description text,
    amount numeric(20,2) NOT NULL,
    currency_id uuid NOT NULL,
    frequency text DEFAULT 'annual'::text NOT NULL,
    start_date date,
    end_date date,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.income FORCE ROW LEVEL SECURITY;


--
-- Name: loa_template; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loa_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    name text NOT NULL,
    file_name text NOT NULL,
    mime_type text NOT NULL,
    file_data bytea NOT NULL,
    field_map jsonb,
    version integer DEFAULT 1 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    uploaded_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.loa_template FORCE ROW LEVEL SECURITY;


--
-- Name: person; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.person (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    date_of_birth date,
    tax_residency text,
    domicile text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    phone text,
    email text,
    address_line1 text,
    address_line2 text,
    city text,
    postal_code text,
    country text,
    risk_tolerance text,
    kyc_status text DEFAULT 'pending'::text NOT NULL,
    kyc_verified_at date,
    source_of_wealth text,
    ni_number text
);

ALTER TABLE ONLY public.person FORCE ROW LEVEL SECURITY;


--
-- Name: provider; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.provider (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    provider_name text NOT NULL,
    provider_email text NOT NULL,
    servicing_email text,
    new_business_email text,
    email_verified boolean DEFAULT false NOT NULL,
    required_documents jsonb DEFAULT '["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.provider FORCE ROW LEVEL SECURITY;


--
-- Name: risk_exposure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_exposure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    as_of_date date NOT NULL,
    leverage_ratio numeric(7,4),
    concentration_pct numeric(7,4),
    liquidity_ratio numeric(7,4),
    fx_exposure jsonb DEFAULT '{}'::jsonb NOT NULL,
    computed_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.risk_exposure FORCE ROW LEVEL SECURITY;


--
-- Name: scenario; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scenario (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    name text NOT NULL,
    event_type public.scenario_event_type NOT NULL,
    event_date date NOT NULL,
    parameters jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_by uuid,
    status text DEFAULT 'draft'::text NOT NULL,
    result jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.scenario FORCE ROW LEVEL SECURITY;


--
-- Name: structure_version; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.structure_version (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    household_id uuid NOT NULL,
    label text NOT NULL,
    effective_date date NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.structure_version FORCE ROW LEVEL SECURITY;


--
-- Name: transaction; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.transaction (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    firm_id uuid NOT NULL,
    account_id uuid NOT NULL,
    asset_id uuid,
    transaction_type public.transaction_type NOT NULL,
    transaction_date date NOT NULL,
    quantity numeric(24,8),
    amount numeric(20,2) NOT NULL,
    currency_id uuid NOT NULL,
    description text,
    external_ref text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.transaction FORCE ROW LEVEL SECURITY;


--
-- Name: v_effective_ownership_today; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.v_effective_ownership_today AS
 WITH RECURSIVE ownership_chain AS (
         SELECT eo.id,
            eo.owner_person_id,
            eo.owner_entity_id,
            eo.owned_entity_id,
            (eo.ownership_pct)::numeric AS effective_pct,
            eo.owner_person_id AS root_person_id,
            ARRAY[eo.owned_entity_id] AS path
           FROM public.entity_ownership eo
          WHERE ((eo.valid_range @> CURRENT_DATE) AND (eo.owner_person_id IS NOT NULL))
        UNION ALL
         SELECT eo.id,
            oc.owner_person_id,
            eo.owner_entity_id,
            eo.owned_entity_id,
            ((oc.effective_pct * eo.ownership_pct) / 100.0) AS effective_pct,
            oc.root_person_id,
            (oc.path || eo.owned_entity_id)
           FROM (public.entity_ownership eo
             JOIN ownership_chain oc ON ((eo.owner_entity_id = oc.owned_entity_id)))
          WHERE ((eo.valid_range @> CURRENT_DATE) AND (NOT (eo.owned_entity_id = ANY (oc.path))))
        )
 SELECT root_person_id AS person_id,
    owned_entity_id AS entity_id,
    sum(effective_pct) AS effective_ownership_pct
   FROM ownership_chain
  GROUP BY root_person_id, owned_entity_id;


--
-- Data for Name: account; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.account (id, firm_id, owner_person_id, owner_entity_id, account_type, provider, currency_id, is_active, created_at, updated_at, policy_number) FROM stdin;
ef9f2608-21cf-4bfc-bac6-f12680798af0	524e600b-d62d-469d-b697-22ced0fbcc07	\N	a84e17c4-16a0-4b63-b19a-1f42176675d7	bank	Barclays Corporate	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	t	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01	\N
22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	524e600b-d62d-469d-b697-22ced0fbcc07	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	\N	investment	Coutts	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	t	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01	\N
\.


--
-- Data for Name: adviser_household_assignment; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.adviser_household_assignment (id, firm_id, adviser_id, household_id, created_at) FROM stdin;
e0738c0c-42d1-4734-969b-ac94c6e899a2	524e600b-d62d-469d-b697-22ced0fbcc07	3579ddda-bee0-490a-9a68-6a15424a667a	18889b89-2f36-4a30-aa55-d4fef82b3814	2026-08-27 15:48:10.731873+01
6d0405a6-be68-4f78-90a7-e7739652773f	524e600b-d62d-469d-b697-22ced0fbcc07	3579ddda-bee0-490a-9a68-6a15424a667a	262061da-d7ca-4b2f-a435-0745d97dca4a	2026-08-27 15:48:10.731873+01
5a18f8ab-e700-47cf-aa88-5e29d2a6fb58	524e600b-d62d-469d-b697-22ced0fbcc07	3579ddda-bee0-490a-9a68-6a15424a667a	a4f0f87d-b4c5-46c3-a471-966efeb22c50	2026-08-27 15:48:10.731873+01
\.


--
-- Data for Name: app_user; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.app_user (id, firm_id, email, role, person_id, is_active, created_at, updated_at, password_hash, display_name, phone, address_line1, city, postal_code) FROM stdin;
1dd97a4a-2d2d-4f66-a6b4-93edda311e1c	524e600b-d62d-469d-b697-22ced0fbcc07	adviser2@wealthmatrix.local	adviser	\N	f	2026-08-27 15:49:44.97552+01	2026-08-27 15:51:25.427987+01	$2b$12$vg3YJ5IDMQ6Q/Sqy2GMPZ.63bB9WRpexJpHT4y1kN9UtK0mkcGJUW	\N	\N	\N	\N	\N
4e618b57-c6d7-45d5-8f5d-1583df4403ae	524e600b-d62d-469d-b697-22ced0fbcc07	client@wealthmatrix.local	client	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	t	2026-08-26 16:26:55.770432+01	2026-08-28 10:23:29.723322+01	$2b$10$0Ux03VLqnoION9yhElzSEuLH9VFqglXFINBwM/96aklIlLMd8UJdG	\N	\N	\N	\N	\N
0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	524e600b-d62d-469d-b697-22ced0fbcc07	admin@wealthmatrix.local	admin	\N	t	2026-08-26 16:26:55.770432+01	2026-08-28 10:23:29.723322+01	$2b$10$0Ux03VLqnoION9yhElzSEuLH9VFqglXFINBwM/96aklIlLMd8UJdG	\N	\N	\N	\N	\N
3579ddda-bee0-490a-9a68-6a15424a667a	524e600b-d62d-469d-b697-22ced0fbcc07	adviser@wealthmatrix.local	adviser	\N	t	2026-08-26 16:26:55.770432+01	2026-08-28 12:01:58.59598+01	$2b$10$0Ux03VLqnoION9yhElzSEuLH9VFqglXFINBwM/96aklIlLMd8UJdG	Jordan Reeves	020 7946 0958	1 Fleet Street	London	EC4Y 1AA
\.


--
-- Data for Name: asset; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.asset (id, firm_id, name, asset_class, identifier, currency_id, is_liability, metadata, created_at, updated_at, source_of_funds) FROM stdin;
29763051-6611-4f2a-8795-be3c218293ab	524e600b-d62d-469d-b697-22ced0fbcc07	Business Term Loan	debt_instrument	\N	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	t	{}	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01	\N
4d0011a6-e73e-4fb7-be97-fdffccd2448f	524e600b-d62d-469d-b697-22ced0fbcc07	GBP Cash	cash	\N	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	f	{}	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01	\N
fb5cad1f-b9fd-4b55-9884-a17867f91cf4	524e600b-d62d-469d-b697-22ced0fbcc07	Global Equity Portfolio	equity_public	GLBL-EQ-01	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	f	{}	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01	\N
5877c56e-d71f-402a-9945-3aee78ff2d62	524e600b-d62d-469d-b697-22ced0fbcc07	Family Trust Property	property	\N	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	f	{}	2026-08-27 14:59:32.43536+01	2026-08-27 14:59:32.43536+01	inheritance
277142a2-9136-4486-a5fc-c423502fe9fa	524e600b-d62d-469d-b697-22ced0fbcc07	PEnsion 	cash	\N	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	f	{}	2026-08-27 16:01:10.81197+01	2026-08-27 16:01:10.81197+01	platform_investment
\.


--
-- Data for Name: audit_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_log (id, firm_id, table_name, row_id, action, changed_by, before_data, after_data, changed_at) FROM stdin;
761476b4-8654-41a8-a880-dd208b6e344e	524e600b-d62d-469d-b697-22ced0fbcc07	household	18889b89-2f36-4a30-aa55-d4fef82b3814	INSERT	\N	\N	{"id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "name": "Sterling Family", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-26T16:26:55.770432+01:00", "updated_at": "2026-08-26T16:26:55.770432+01:00", "primary_adviser_id": null}	2026-08-26 16:26:55.770432+01
de877a2a-2bcd-4fd7-a33e-ff1ffd7bc2fb	524e600b-d62d-469d-b697-22ced0fbcc07	entity	a84e17c4-16a0-4b63-b19a-1f42176675d7	INSERT	\N	\N	{"id": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "name": "Sterling Holdings Ltd", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-26T16:26:55.770432+01:00", "updated_at": "2026-08-26T16:26:55.770432+01:00", "entity_type": "holding_company", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "jurisdiction": "GB", "base_currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "registration_number": null}	2026-08-26 16:26:55.770432+01
0158b5b3-51ec-4490-ae74-d7b26ded3437	524e600b-d62d-469d-b697-22ced0fbcc07	account	ef9f2608-21cf-4bfc-bac6-f12680798af0	INSERT	\N	\N	{"id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "provider": "Barclays Corporate", "is_active": true, "created_at": "2026-08-26T16:26:55.770432+01:00", "updated_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "account_type": "bank", "owner_entity_id": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "owner_person_id": null}	2026-08-26 16:26:55.770432+01
a12f3e32-5f02-46b6-a621-a5dc5305c6b9	524e600b-d62d-469d-b697-22ced0fbcc07	asset	29763051-6611-4f2a-8795-be3c218293ab	INSERT	\N	\N	{"id": "29763051-6611-4f2a-8795-be3c218293ab", "name": "Business Term Loan", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "metadata": {}, "created_at": "2026-08-26T16:26:55.770432+01:00", "identifier": null, "updated_at": "2026-08-26T16:26:55.770432+01:00", "asset_class": "debt_instrument", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "is_liability": true}	2026-08-26 16:26:55.770432+01
05a55413-043d-4e70-9e69-d2f08fa38adf	524e600b-d62d-469d-b697-22ced0fbcc07	holding	c4da0617-f231-4aa4-9739-3c014705859d	INSERT	\N	\N	{"id": "c4da0617-f231-4aa4-9739-3c014705859d", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "29763051-6611-4f2a-8795-be3c218293ab", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-08-26", "created_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 500000.00}	2026-08-26 16:26:55.770432+01
29d9a674-9060-4c36-8e7e-268ca0904f9c	524e600b-d62d-469d-b697-22ced0fbcc07	asset	4d0011a6-e73e-4fb7-be97-fdffccd2448f	INSERT	\N	\N	{"id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "name": "GBP Cash", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "metadata": {}, "created_at": "2026-08-26T16:26:55.770432+01:00", "identifier": null, "updated_at": "2026-08-26T16:26:55.770432+01:00", "asset_class": "cash", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "is_liability": false}	2026-08-26 16:26:55.770432+01
533c054f-fc89-4d68-81e7-a2dac78b6572	524e600b-d62d-469d-b697-22ced0fbcc07	holding	f3a69198-abbb-4424-b5dd-c44098a1924c	INSERT	\N	\N	{"id": "f3a69198-abbb-4424-b5dd-c44098a1924c", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-08-26", "created_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 1200000.00}	2026-08-26 16:26:55.770432+01
71d39f61-01b6-4627-8155-c6fbd4c50fde	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	INSERT	\N	\N	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "updated_at": "2026-08-26T16:26:55.770432+01:00", "date_of_birth": null, "tax_residency": "GB"}	2026-08-26 16:26:55.770432+01
2252377a-78cc-445a-a96d-f623d4ae662b	524e600b-d62d-469d-b697-22ced0fbcc07	account	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	INSERT	\N	\N	{"id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "provider": "Coutts", "is_active": true, "created_at": "2026-08-26T16:26:55.770432+01:00", "updated_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "account_type": "investment", "owner_entity_id": null, "owner_person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c"}	2026-08-26 16:26:55.770432+01
8f2855ce-e7cf-4f08-b403-ac698c70920f	524e600b-d62d-469d-b697-22ced0fbcc07	asset	fb5cad1f-b9fd-4b55-9884-a17867f91cf4	INSERT	\N	\N	{"id": "fb5cad1f-b9fd-4b55-9884-a17867f91cf4", "name": "Global Equity Portfolio", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "metadata": {}, "created_at": "2026-08-26T16:26:55.770432+01:00", "identifier": "GLBL-EQ-01", "updated_at": "2026-08-26T16:26:55.770432+01:00", "asset_class": "equity_public", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "is_liability": false}	2026-08-26 16:26:55.770432+01
41dde47d-ec04-4066-8067-10045cdb5475	524e600b-d62d-469d-b697-22ced0fbcc07	holding	72f50133-5cd0-4bd1-ae89-c6c4d2fc56b6	INSERT	\N	\N	{"id": "72f50133-5cd0-4bd1-ae89-c6c4d2fc56b6", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "fb5cad1f-b9fd-4b55-9884-a17867f91cf4", "quantity": 1.00000000, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-08-26", "created_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 2400000.00}	2026-08-26 16:26:55.770432+01
a819091b-c978-48f0-898f-1160e540a128	524e600b-d62d-469d-b697-22ced0fbcc07	holding	71a11291-b6f3-4d05-bdc0-9c38d7cbd128	INSERT	\N	\N	{"id": "71a11291-b6f3-4d05-bdc0-9c38d7cbd128", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-08-26", "created_at": "2026-08-26T16:26:55.770432+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 850000.00}	2026-08-26 16:26:55.770432+01
6f35d8ab-a234-4d11-9bf2-44131240719b	524e600b-d62d-469d-b697-22ced0fbcc07	entity_ownership	d99ef9db-bce0-4f61-88ac-9207e3077201	INSERT	\N	\N	{"id": "d99ef9db-bce0-4f61-88ac-9207e3077201", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "valid_to": null, "created_at": "2026-08-26T16:26:55.770432+01:00", "updated_at": "2026-08-26T16:26:55.770432+01:00", "valid_from": "2020-01-01", "valid_range": "[2020-01-01,)", "ownership_pct": 100.0000, "owned_entity_id": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "owner_entity_id": null, "owner_person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "ownership_class": "ordinary_shares", "structure_version_id": null}	2026-08-26 16:26:55.770432+01
f6a98c6a-11b3-4e2b-883c-f17ac4c29185	524e600b-d62d-469d-b697-22ced0fbcc07	household_member	756c8340-4601-4118-a03c-21e16a30f933	INSERT	\N	\N	{"id": "756c8340-4601-4118-a03c-21e16a30f933", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-26T16:26:55.770432+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "relationship": "head"}	2026-08-26 16:26:55.770432+01
ec240adb-a9be-4c7f-83b9-34521f7d81db	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	cf0835f2-ca56-4b3a-8c14-920d02fab02c	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "cf0835f2-ca56-4b3a-8c14-920d02fab02c", "name": "Clever ", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:49:59.050416+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2030-05-27", "event_type": "business_sale", "parameters": {"salePrice": 500000}, "updated_at": "2026-08-27T10:49:59.050416+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:49:59.050416+01
8f8c002d-5a08-44cf-ac4f-e19c0e235bc4	524e600b-d62d-469d-b697-22ced0fbcc07	holding	88a52f11-56ae-49f2-969e-baee84b92aad	INSERT	\N	\N	{"id": "88a52f11-56ae-49f2-969e-baee84b92aad", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-07-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 820000.00}	2026-08-27 12:43:02.949748+01
013fc794-b311-4a5e-92ef-8327296229fb	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	cf0835f2-ca56-4b3a-8c14-920d02fab02c	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "cf0835f2-ca56-4b3a-8c14-920d02fab02c", "name": "Clever ", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:49:59.050416+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2030-05-27", "event_type": "business_sale", "parameters": {"salePrice": 500000}, "updated_at": "2026-08-27T10:49:59.050416+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "cf0835f2-ca56-4b3a-8c14-920d02fab02c", "name": "Clever ", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:49:59.050416+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2030-05-27", "event_type": "business_sale", "parameters": {"salePrice": 500000}, "updated_at": "2026-08-27T10:49:59.205887+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:49:59.205887+01
e8753b18-9f6e-4c31-bece-6b8935dc9e43	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	cf0835f2-ca56-4b3a-8c14-920d02fab02c	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "cf0835f2-ca56-4b3a-8c14-920d02fab02c", "name": "Clever ", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:49:59.050416+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2030-05-27", "event_type": "business_sale", "parameters": {"salePrice": 500000}, "updated_at": "2026-08-27T10:49:59.205887+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "cf0835f2-ca56-4b3a-8c14-920d02fab02c", "name": "Clever ", "result": {"delta": 400000, "details": {"params": {"salePrice": 500000}, "baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}, "netProceeds": 400000, "removedAttribution": 0}, "narrative": "Selling the business for 500,000 at an assumed 20% CGT rate yields net proceeds of 400,000, replacing the entity's attributed value of 0 in the household's net worth.", "baselineNetWorth": 3950000, "projectedNetWorth": 4350000}, "status": "complete", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:49:59.050416+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2030-05-27", "event_type": "business_sale", "parameters": {"salePrice": 500000}, "updated_at": "2026-08-27T10:49:59.205887+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:49:59.205887+01
78cce2b3-b88e-4914-ae63-de956b15bcac	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	262513ec-4f32-4123-b0d1-14c854f102dc	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "262513ec-4f32-4123-b0d1-14c854f102dc", "name": "Clever ", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:50:50.682693+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2000-05-27", "event_type": "divorce", "parameters": {"amount": 500000}, "updated_at": "2026-08-27T10:50:50.682693+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:50:50.682693+01
c12f637f-860f-4e94-a483-6914f4f2085e	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	262513ec-4f32-4123-b0d1-14c854f102dc	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "262513ec-4f32-4123-b0d1-14c854f102dc", "name": "Clever ", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:50:50.682693+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2000-05-27", "event_type": "divorce", "parameters": {"amount": 500000}, "updated_at": "2026-08-27T10:50:50.682693+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "262513ec-4f32-4123-b0d1-14c854f102dc", "name": "Clever ", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:50:50.682693+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2000-05-27", "event_type": "divorce", "parameters": {"amount": 500000}, "updated_at": "2026-08-27T10:50:50.755361+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:50:50.755361+01
9bdce640-52bd-4f55-8d67-0349b1b1b0d1	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	262513ec-4f32-4123-b0d1-14c854f102dc	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "262513ec-4f32-4123-b0d1-14c854f102dc", "name": "Clever ", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:50:50.682693+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2000-05-27", "event_type": "divorce", "parameters": {"amount": 500000}, "updated_at": "2026-08-27T10:50:50.755361+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "262513ec-4f32-4123-b0d1-14c854f102dc", "name": "Clever ", "result": {"delta": 0, "details": {"baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}, "parameters": {"amount": 500000}}, "narrative": "divorce scenarios require jurisdiction/case-specific rules (e.g. matrimonial asset division, dual-residency tax treaties, covenant-triggered re-leveraging) not yet modelled quantitatively. Baseline net worth is shown unchanged; extend EVENT_HANDLERS with a dedicated calculation for this event type.", "baselineNetWorth": 3950000, "projectedNetWorth": 3950000}, "status": "complete", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T10:50:50.682693+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2000-05-27", "event_type": "divorce", "parameters": {"amount": 500000}, "updated_at": "2026-08-27T10:50:50.755361+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 10:50:50.755361+01
2753aa83-5817-4e54-85cb-a2a691f0e8bb	524e600b-d62d-469d-b697-22ced0fbcc07	holding	3a752f2f-c5f0-457f-b7a7-5d7f2d45f0bd	INSERT	\N	\N	{"id": "3a752f2f-c5f0-457f-b7a7-5d7f2d45f0bd", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-02-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 700000.00}	2026-08-27 12:43:02.949748+01
4c56b25c-9375-4907-bb7b-06309f444e13	524e600b-d62d-469d-b697-22ced0fbcc07	holding	c83e7b15-135f-443e-a47e-78a11737cf30	INSERT	\N	\N	{"id": "c83e7b15-135f-443e-a47e-78a11737cf30", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-05-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 780000.00}	2026-08-27 12:43:02.949748+01
e894be4b-bc6b-475e-b8ba-713cf7b1fefa	524e600b-d62d-469d-b697-22ced0fbcc07	holding	bba374aa-e600-469a-906f-179189613938	INSERT	\N	\N	{"id": "bba374aa-e600-469a-906f-179189613938", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "fb5cad1f-b9fd-4b55-9884-a17867f91cf4", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-02-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 2000000.00}	2026-08-27 12:43:02.949748+01
b0a1dc85-2227-4259-ab77-4096f7476f17	524e600b-d62d-469d-b697-22ced0fbcc07	holding	7a853ed9-665e-496a-8958-22aa696d8a14	INSERT	\N	\N	{"id": "7a853ed9-665e-496a-8958-22aa696d8a14", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "fb5cad1f-b9fd-4b55-9884-a17867f91cf4", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-05-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 2200000.00}	2026-08-27 12:43:02.949748+01
b9d0e565-f27b-47d0-894a-9558ff93e3a3	524e600b-d62d-469d-b697-22ced0fbcc07	holding	8eaa49ef-5084-42d2-9fc8-e9e783ea7698	INSERT	\N	\N	{"id": "8eaa49ef-5084-42d2-9fc8-e9e783ea7698", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "fb5cad1f-b9fd-4b55-9884-a17867f91cf4", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-07-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 2350000.00}	2026-08-27 12:43:02.949748+01
4c3117d7-3ede-478f-b56f-2673d0cfce27	524e600b-d62d-469d-b697-22ced0fbcc07	holding	b1ccec04-4818-46ab-93dc-3f7d3be51081	INSERT	\N	\N	{"id": "b1ccec04-4818-46ab-93dc-3f7d3be51081", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-02-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 900000.00}	2026-08-27 12:43:02.949748+01
d8f33290-cee9-4862-b062-63dfaf222eba	524e600b-d62d-469d-b697-22ced0fbcc07	holding	9c7fdf88-116b-45f7-ac4e-f9808f4db59a	INSERT	\N	\N	{"id": "9c7fdf88-116b-45f7-ac4e-f9808f4db59a", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-05-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 1050000.00}	2026-08-27 12:43:02.949748+01
bfa0eef7-8784-423b-8d5f-6c0795c2601f	524e600b-d62d-469d-b697-22ced0fbcc07	holding	ec20118f-9b9a-4255-82f1-132395a76a5f	INSERT	\N	\N	{"id": "ec20118f-9b9a-4255-82f1-132395a76a5f", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "4d0011a6-e73e-4fb7-be97-fdffccd2448f", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-07-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 1150000.00}	2026-08-27 12:43:02.949748+01
3afc1fdd-d555-453b-a0d6-77a5135c22cf	524e600b-d62d-469d-b697-22ced0fbcc07	holding	afeb4c2a-dd9c-4dd7-9634-1452f872b780	INSERT	\N	\N	{"id": "afeb4c2a-dd9c-4dd7-9634-1452f872b780", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "29763051-6611-4f2a-8795-be3c218293ab", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-02-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 550000.00}	2026-08-27 12:43:02.949748+01
88192058-ed02-4db6-b112-06c715db8264	524e600b-d62d-469d-b697-22ced0fbcc07	holding	6ad53eaa-86ed-4827-b992-1c228106a907	INSERT	\N	\N	{"id": "6ad53eaa-86ed-4827-b992-1c228106a907", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "29763051-6611-4f2a-8795-be3c218293ab", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-05-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 525000.00}	2026-08-27 12:43:02.949748+01
4e5accb4-7be3-48ce-8f1a-01133fecdb64	524e600b-d62d-469d-b697-22ced0fbcc07	holding	135737ef-088d-40e7-8136-d6805f7e2d9d	INSERT	\N	\N	{"id": "135737ef-088d-40e7-8136-d6805f7e2d9d", "source": "seed-historical", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "29763051-6611-4f2a-8795-be3c218293ab", "quantity": null, "account_id": "ef9f2608-21cf-4bfc-bac6-f12680798af0", "as_of_date": "2026-07-27", "created_at": "2026-08-27T12:43:02.949748+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 510000.00}	2026-08-27 12:43:02.949748+01
83ddf066-eb8b-4ea7-ac0f-ce44bebdc751	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	d46763d6-c635-4a74-9629-8ceca2905a73	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "d46763d6-c635-4a74-9629-8ceca2905a73", "name": "Clever", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T13:03:48.826298+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2055-05-28", "event_type": "inheritance", "parameters": {"amount": 500000, "taxRatePct": 40}, "updated_at": "2026-08-27T13:03:48.826298+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 13:03:48.826298+01
151ac4d1-95d1-4d40-b76d-a80ac7c50843	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	d46763d6-c635-4a74-9629-8ceca2905a73	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "d46763d6-c635-4a74-9629-8ceca2905a73", "name": "Clever", "result": null, "status": "draft", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T13:03:48.826298+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2055-05-28", "event_type": "inheritance", "parameters": {"amount": 500000, "taxRatePct": 40}, "updated_at": "2026-08-27T13:03:48.826298+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "d46763d6-c635-4a74-9629-8ceca2905a73", "name": "Clever", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T13:03:48.826298+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2055-05-28", "event_type": "inheritance", "parameters": {"amount": 500000, "taxRatePct": 40}, "updated_at": "2026-08-27T13:03:48.932331+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 13:03:48.932331+01
f9b40bf6-c9aa-45dc-84c0-358a210d646b	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": null, "email": null, "phone": null, "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "pending", "updated_at": "2026-08-26T16:26:55.770432+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": null, "kyc_verified_at": null, "source_of_wealth": null}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-27T14:57:01.621391+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-27 14:57:01.621391+01
61dc6a00-74a9-4cfa-ac84-e05511575a4a	524e600b-d62d-469d-b697-22ced0fbcc07	scenario	d46763d6-c635-4a74-9629-8ceca2905a73	UPDATE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "d46763d6-c635-4a74-9629-8ceca2905a73", "name": "Clever", "result": null, "status": "running", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T13:03:48.826298+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2055-05-28", "event_type": "inheritance", "parameters": {"amount": 500000, "taxRatePct": 40}, "updated_at": "2026-08-27T13:03:48.932331+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "d46763d6-c635-4a74-9629-8ceca2905a73", "name": "Clever", "result": {"delta": 300000, "details": {"params": {"amount": 500000, "taxRatePct": 40}, "baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}}, "narrative": "A inheritance of 500,000 net of assumed tax adds 300,000 to household net worth.", "baselineNetWorth": 3950000, "projectedNetWorth": 4250000}, "status": "complete", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T13:03:48.826298+01:00", "created_by": "0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2", "event_date": "2055-05-28", "event_type": "inheritance", "parameters": {"amount": 500000, "taxRatePct": 40}, "updated_at": "2026-08-27T13:03:48.932331+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 13:03:48.932331+01
135a4259-3aef-4197-86af-c2f0b5bc28bb	524e600b-d62d-469d-b697-22ced0fbcc07	household	262061da-d7ca-4b2f-a435-0745d97dca4a	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "262061da-d7ca-4b2f-a435-0745d97dca4a", "name": "Whitmore Family", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T14:18:24.612194+01:00", "updated_at": "2026-08-27T14:18:24.612194+01:00", "primary_adviser_id": null}	2026-08-27 14:18:24.612194+01
6f60f5ac-ef7b-46de-a6ad-c322a83abb3d	524e600b-d62d-469d-b697-22ced0fbcc07	person	bba896f2-bf19-4fd9-9d45-4877506217d5	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "bba896f2-bf19-4fd9-9d45-4877506217d5", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Whitmore", "created_at": "2026-08-27T14:18:24.801771+01:00", "first_name": "Edward", "updated_at": "2026-08-27T14:18:24.801771+01:00", "date_of_birth": null, "tax_residency": "GB"}	2026-08-27 14:18:24.801771+01
39d6e688-b629-4538-8fc4-25646f7a7e1a	524e600b-d62d-469d-b697-22ced0fbcc07	household_member	3f26ba1b-0f17-41ce-8dd9-49272a8ae4a2	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "3f26ba1b-0f17-41ce-8dd9-49272a8ae4a2", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "person_id": "bba896f2-bf19-4fd9-9d45-4877506217d5", "created_at": "2026-08-27T14:18:24.87661+01:00", "household_id": "262061da-d7ca-4b2f-a435-0745d97dca4a", "relationship": "head"}	2026-08-27 14:18:24.87661+01
fe0d988e-d5c9-45bd-98df-8933b4a2cdc6	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_log	2b757d56-d9a7-42f7-af7e-bb80e0a2b787	INSERT	\N	\N	{"id": "2b757d56-d9a7-42f7-af7e-bb80e0a2b787", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "KYC refresh overdue - last verified over 12 months ago", "metadata": {}, "severity": "breach", "entity_id": null, "rule_code": "KYC_REFRESH_OVERDUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": null, "resolved_by": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 14:19:23.110845+01
3ba5212e-cfc5-4723-962f-3234d2dcd333	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_log	783de73d-3aca-43cd-933a-f94763b285fc	INSERT	\N	\N	{"id": "783de73d-3aca-43cd-933a-f94763b285fc", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "Annual suitability review due within 30 days", "metadata": {}, "severity": "warning", "entity_id": null, "rule_code": "SUITABILITY_REVIEW_DUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": null, "resolved_by": null, "household_id": "262061da-d7ca-4b2f-a435-0745d97dca4a"}	2026-08-27 14:19:23.110845+01
d4e01fac-4f9e-4fbf-a159-b68d3f3d005d	524e600b-d62d-469d-b697-22ced0fbcc07	household	a4f0f87d-b4c5-46c3-a471-966efeb22c50	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "a4f0f87d-b4c5-46c3-a471-966efeb22c50", "name": "Scott", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T14:29:20.219931+01:00", "updated_at": "2026-08-27T14:29:20.219931+01:00", "primary_adviser_id": null}	2026-08-27 14:29:20.219931+01
c70206f3-34ec-45a9-afa3-3793a561862a	524e600b-d62d-469d-b697-22ced0fbcc07	person	df10227b-e170-413e-8171-af63cc6248c2	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "df10227b-e170-413e-8171-af63cc6248c2", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": null, "is_active": true, "last_name": "Scott", "created_at": "2026-08-27T14:29:20.284349+01:00", "first_name": "Mike ", "updated_at": "2026-08-27T14:29:20.284349+01:00", "date_of_birth": null, "tax_residency": "United Kingdom"}	2026-08-27 14:29:20.284349+01
81798a05-bb05-4d33-a3fb-3a6125b6ee05	524e600b-d62d-469d-b697-22ced0fbcc07	household_member	2a22def1-9650-4a8a-9be1-bd9dd2005ec8	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "2a22def1-9650-4a8a-9be1-bd9dd2005ec8", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "person_id": "df10227b-e170-413e-8171-af63cc6248c2", "created_at": "2026-08-27T14:29:20.3348+01:00", "household_id": "a4f0f87d-b4c5-46c3-a471-966efeb22c50", "relationship": "head"}	2026-08-27 14:29:20.3348+01
11edf404-f88b-4e28-bb4d-08d03388a2c4	524e600b-d62d-469d-b697-22ced0fbcc07	person	df10227b-e170-413e-8171-af63cc6248c2	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "df10227b-e170-413e-8171-af63cc6248c2", "city": null, "email": null, "phone": null, "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": null, "is_active": true, "last_name": "Scott", "created_at": "2026-08-27T14:29:20.284349+01:00", "first_name": "Mike ", "kyc_status": "pending", "updated_at": "2026-08-27T14:29:20.284349+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "United Kingdom", "risk_tolerance": null, "kyc_verified_at": null, "source_of_wealth": null}	{"id": "df10227b-e170-413e-8171-af63cc6248c2", "city": null, "email": "alexandra@example.com", "phone": "+44 7700 900123", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": null, "is_active": true, "last_name": "Scott", "created_at": "2026-08-27T14:29:20.284349+01:00", "first_name": "Mike ", "kyc_status": "verified", "updated_at": "2026-08-27T14:46:00.265731+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "United Kingdom", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": null}	2026-08-27 14:46:00.265731+01
b2c87d55-5a81-43cf-bd47-bf1e0ff845c2	524e600b-d62d-469d-b697-22ced0fbcc07	person	df10227b-e170-413e-8171-af63cc6248c2	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "df10227b-e170-413e-8171-af63cc6248c2", "city": null, "email": "alexandra@example.com", "phone": "+44 7700 900123", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": null, "is_active": true, "last_name": "Scott", "created_at": "2026-08-27T14:29:20.284349+01:00", "first_name": "Mike ", "kyc_status": "verified", "updated_at": "2026-08-27T14:46:00.265731+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "United Kingdom", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": null}	{"id": "df10227b-e170-413e-8171-af63cc6248c2", "city": null, "email": null, "phone": null, "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": null, "is_active": true, "last_name": "Scott", "created_at": "2026-08-27T14:29:20.284349+01:00", "first_name": "Mike ", "kyc_status": "pending", "updated_at": "2026-08-27T14:46:14.464307+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "United Kingdom", "risk_tolerance": null, "kyc_verified_at": null, "source_of_wealth": null}	2026-08-27 14:46:14.464307+01
e8a186db-603d-4096-b864-a344aaf6b417	524e600b-d62d-469d-b697-22ced0fbcc07	income	e26fca74-82d2-4e35-aeb3-6388ef3d6c1f	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "e26fca74-82d2-4e35-aeb3-6388ef3d6c1f", "notes": null, "amount": 180000.00, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "end_date": null, "frequency": "annual", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-27T14:57:48.436888+01:00", "start_date": null, "updated_at": "2026-08-27T14:57:48.436888+01:00", "currency_id": "98465946-c6a3-4f47-a265-24e2b4d660c2", "description": "Base salary", "income_type": "employment"}	2026-08-27 14:57:48.436888+01
7be6e2a4-29d7-491e-aa7f-f47f7a7fc0f0	524e600b-d62d-469d-b697-22ced0fbcc07	income	e26fca74-82d2-4e35-aeb3-6388ef3d6c1f	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "e26fca74-82d2-4e35-aeb3-6388ef3d6c1f", "notes": null, "amount": 180000.00, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "end_date": null, "frequency": "annual", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-27T14:57:48.436888+01:00", "start_date": null, "updated_at": "2026-08-27T14:57:48.436888+01:00", "currency_id": "98465946-c6a3-4f47-a265-24e2b4d660c2", "description": "Base salary", "income_type": "employment"}	{"id": "e26fca74-82d2-4e35-aeb3-6388ef3d6c1f", "notes": null, "amount": 180000.00, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "end_date": null, "frequency": "annual", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-27T14:57:48.436888+01:00", "start_date": null, "updated_at": "2026-08-27T14:58:34.29176+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "description": "Base salary", "income_type": "employment"}	2026-08-27 14:58:34.29176+01
ca7b6b2e-fda7-4a8a-a486-03b82254a4ac	524e600b-d62d-469d-b697-22ced0fbcc07	client_note	7c3303eb-f73b-4d78-9f62-1894ac460e4d	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "7c3303eb-f73b-4d78-9f62-1894ac460e4d", "note": "Annual review call held - discussed pension consolidation options.", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "author_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-27T14:59:05.932857+01:00", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-27 14:59:05.932857+01
39943e8b-1531-4aae-b7ae-db2829c5fd1a	524e600b-d62d-469d-b697-22ced0fbcc07	asset	5877c56e-d71f-402a-9945-3aee78ff2d62	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "5877c56e-d71f-402a-9945-3aee78ff2d62", "name": "Family Trust Property", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "metadata": {}, "created_at": "2026-08-27T14:59:32.43536+01:00", "identifier": null, "updated_at": "2026-08-27T14:59:32.43536+01:00", "asset_class": "property", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "is_liability": false, "source_of_funds": "inheritance"}	2026-08-27 14:59:32.43536+01
3ff95ea9-b8b8-4c5d-bbd5-59966d2423e6	524e600b-d62d-469d-b697-22ced0fbcc07	holding	2d104e3d-f4dc-4000-a7bf-66017b3fff98	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "2d104e3d-f4dc-4000-a7bf-66017b3fff98", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "5877c56e-d71f-402a-9945-3aee78ff2d62", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-08-27", "created_at": "2026-08-27T14:59:32.503908+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 1200000.00}	2026-08-27 14:59:32.503908+01
9bf10a7d-fb13-486c-9d87-e2c1d13c520a	524e600b-d62d-469d-b697-22ced0fbcc07	income	c15a632e-dced-496f-ab32-28ab6ce8c034	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "c15a632e-dced-496f-ab32-28ab6ce8c034", "notes": null, "amount": 0.00, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "end_date": null, "frequency": "annual", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-27T15:01:22.58049+01:00", "start_date": null, "updated_at": "2026-08-27T15:01:22.58049+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "description": null, "income_type": "employment"}	2026-08-27 15:01:22.58049+01
06ea6782-f8d3-4fcc-81cb-2aa8db282ade	524e600b-d62d-469d-b697-22ced0fbcc07	income	c38ec47a-99eb-4cb2-8ceb-89e147ae7393	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "c38ec47a-99eb-4cb2-8ceb-89e147ae7393", "notes": null, "amount": 20000.00, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "end_date": null, "frequency": "annual", "person_id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "created_at": "2026-08-27T15:01:53.378806+01:00", "start_date": "2005-05-20", "updated_at": "2026-08-27T15:01:53.378806+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "description": null, "income_type": "self_employment"}	2026-08-27 15:01:53.378806+01
178261be-e4f4-4e4b-92c4-c2bef56634bc	524e600b-d62d-469d-b697-22ced0fbcc07	household	aae8d5b2-befd-4c00-b036-d2ac52f3a834	INSERT	1dd97a4a-2d2d-4f66-a6b4-93edda311e1c	\N	{"id": "aae8d5b2-befd-4c00-b036-d2ac52f3a834", "name": "Test Auto-Assign Household", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T15:50:28.015609+01:00", "updated_at": "2026-08-27T15:50:28.015609+01:00", "primary_adviser_id": "1dd97a4a-2d2d-4f66-a6b4-93edda311e1c"}	2026-08-27 15:50:28.015609+01
5078c9be-1dc2-47df-a811-c8f09f419a2b	524e600b-d62d-469d-b697-22ced0fbcc07	household	aae8d5b2-befd-4c00-b036-d2ac52f3a834	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "aae8d5b2-befd-4c00-b036-d2ac52f3a834", "name": "Test Auto-Assign Household", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "created_at": "2026-08-27T15:50:28.015609+01:00", "updated_at": "2026-08-27T15:50:28.015609+01:00", "primary_adviser_id": "1dd97a4a-2d2d-4f66-a6b4-93edda311e1c"}	\N	2026-08-27 15:50:41.149293+01
6cc529bb-c98c-49a5-87a0-ae1300899312	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_log	783de73d-3aca-43cd-933a-f94763b285fc	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "783de73d-3aca-43cd-933a-f94763b285fc", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "Annual suitability review due within 30 days", "metadata": {}, "severity": "warning", "entity_id": null, "rule_code": "SUITABILITY_REVIEW_DUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": null, "resolved_by": null, "household_id": "262061da-d7ca-4b2f-a435-0745d97dca4a"}	{"id": "783de73d-3aca-43cd-933a-f94763b285fc", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "Annual suitability review due within 30 days", "metadata": {}, "severity": "warning", "entity_id": null, "rule_code": "SUITABILITY_REVIEW_DUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": "2026-08-27T15:56:13.396+01:00", "resolved_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "262061da-d7ca-4b2f-a435-0745d97dca4a"}	2026-08-27 15:56:13.394933+01
1b2ecf34-2855-4c2a-8fbc-eae7e921b97b	524e600b-d62d-469d-b697-22ced0fbcc07	asset	277142a2-9136-4486-a5fc-c423502fe9fa	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "277142a2-9136-4486-a5fc-c423502fe9fa", "name": "PEnsion ", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "metadata": {}, "created_at": "2026-08-27T16:01:10.81197+01:00", "identifier": null, "updated_at": "2026-08-27T16:01:10.81197+01:00", "asset_class": "cash", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "is_liability": false, "source_of_funds": "platform_investment"}	2026-08-27 16:01:10.81197+01
971a32d2-1e6b-4e29-bf3d-a03a914b018e	524e600b-d62d-469d-b697-22ced0fbcc07	holding	e93c754d-0208-4593-924b-601e7e7d327c	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "e93c754d-0208-4593-924b-601e7e7d327c", "source": "manual", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "asset_id": "277142a2-9136-4486-a5fc-c423502fe9fa", "quantity": null, "account_id": "22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc", "as_of_date": "2026-08-27", "created_at": "2026-08-27T16:01:10.888425+01:00", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "market_value": 200000000.00}	2026-08-27 16:01:10.888425+01
6bbfaf85-e8a0-43a3-99c2-e96d58a18ec6	524e600b-d62d-469d-b697-22ced0fbcc07	provider	33dc0080-007c-49c3-abfc-0bbe46548e62	INSERT	\N	\N	{"id": "33dc0080-007c-49c3-abfc-0bbe46548e62", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Prudential", "email_verified": false, "provider_email": "loa@prudential.com", "servicing_email": "servicing@prudential.com", "new_business_email": "newbusiness@prudential.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
a00bd36c-afa7-4eab-9471-1d2244d1ccd6	524e600b-d62d-469d-b697-22ced0fbcc07	fund	d8b1b971-4ff4-431a-8c4a-d43bd3042a94	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "d8b1b971-4ff4-431a-8c4a-d43bd3042a94", "aum": 850000000.00, "ocf": 0.0085, "isin": "GB00DEM0UK01", "name": "WealthMatrix Demo UK Equity Growth", "sedol": "DEM0UK1", "sector": "IA UK All Companies", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "J. Alderton (Demo)", "esg_score": 68.00, "yield_pct": 1.8000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration fund tracking UK large/mid-cap growth names. Not a real fund.", "risk_rating": 5, "inception_date": "2012-03-01", "volatility_pct": 14.2000, "max_drawdown_pct": 22.5000, "manager_tenure_years": 6.50}	2026-08-28 10:02:04.05715+01
fb7104fa-c00e-4976-b137-3145d6940221	524e600b-d62d-469d-b697-22ced0fbcc07	fund	d87dcfc0-4b40-45a4-a468-06ac7e62f27b	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "d87dcfc0-4b40-45a4-a468-06ac7e62f27b", "aum": 1420000000.00, "ocf": 0.0079, "isin": "GB00DEM0GL02", "name": "WealthMatrix Demo Global Equity Income", "sedol": "DEM0GL2", "sector": "IA Global Equity Income", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "R. Okafor (Demo)", "esg_score": 74.00, "yield_pct": 3.2000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration global equity income fund. Not a real fund.", "risk_rating": 4, "inception_date": "2009-11-15", "volatility_pct": 11.8000, "max_drawdown_pct": 18.1000, "manager_tenure_years": 9.20}	2026-08-28 10:02:04.05715+01
3075349c-b534-463f-a561-eeca2f6a23ab	524e600b-d62d-469d-b697-22ced0fbcc07	fund	28639fcd-f97e-462f-afc7-8ae55686e53a	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "28639fcd-f97e-462f-afc7-8ae55686e53a", "aum": 610000000.00, "ocf": 0.0045, "isin": "GB00DEM0CB03", "name": "WealthMatrix Demo Sterling Corporate Bond", "sedol": "DEM0CB3", "sector": "IA Sterling Corporate Bond", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "S. Patel (Demo)", "esg_score": 61.00, "yield_pct": 4.6000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "fixed_income", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration sterling investment-grade bond fund. Not a real fund.", "risk_rating": 3, "inception_date": "2015-06-01", "volatility_pct": 6.4000, "max_drawdown_pct": 9.2000, "manager_tenure_years": 4.10}	2026-08-28 10:02:04.05715+01
484b6fb1-8558-46b5-96ce-97ee50e586f8	524e600b-d62d-469d-b697-22ced0fbcc07	fund	0e4fa6b6-fc2e-423f-84c8-5ccbe5089568	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "0e4fa6b6-fc2e-423f-84c8-5ccbe5089568", "aum": 2100000000.00, "ocf": 0.0012, "isin": "GB00DEM0MM04", "name": "WealthMatrix Demo Money Market GBP", "sedol": "DEM0MM4", "sector": "IA Short Term Money Market", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "T. Nguyen (Demo)", "esg_score": 55.00, "yield_pct": 4.9000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "money_market", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration GBP money market fund. Not a real fund.", "risk_rating": 1, "inception_date": "2018-01-10", "volatility_pct": 0.4000, "max_drawdown_pct": 0.1000, "manager_tenure_years": 3.00}	2026-08-28 10:02:04.05715+01
240352d1-18f6-4fdc-926f-d93dba7a0e12	524e600b-d62d-469d-b697-22ced0fbcc07	fund	8b8ffeaa-74c9-468f-b886-8aad61751ab4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "8b8ffeaa-74c9-468f-b886-8aad61751ab4", "aum": 980000000.00, "ocf": 0.0068, "isin": "GB00DEM0MX05", "name": "WealthMatrix Demo Mixed 40-85 Shares", "sedol": "DEM0MX5", "sector": "IA Mixed Investment 40-85% Shares", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "H. Fairbanks (Demo)", "esg_score": 66.00, "yield_pct": 2.4000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "mixed_asset", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration multi-asset fund. Not a real fund.", "risk_rating": 4, "inception_date": "2011-09-20", "volatility_pct": 10.9000, "max_drawdown_pct": 16.3000, "manager_tenure_years": 7.80}	2026-08-28 10:02:04.05715+01
5942c12a-72c9-4eb6-8dc4-d193291f8695	524e600b-d62d-469d-b697-22ced0fbcc07	fund	30d8a47e-98cf-4df5-97a1-f31baeeeb409	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "30d8a47e-98cf-4df5-97a1-f31baeeeb409", "aum": 1750000000.00, "ocf": 0.0082, "isin": "GB00DEM0NA06", "name": "WealthMatrix Demo North America Equity", "sedol": "DEM0NA6", "sector": "IA North America", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "M. Delgado (Demo)", "esg_score": 59.00, "yield_pct": 1.1000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration US/Canada equity fund. Not a real fund.", "risk_rating": 5, "inception_date": "2013-04-12", "volatility_pct": 15.6000, "max_drawdown_pct": 24.0000, "manager_tenure_years": 5.40}	2026-08-28 10:02:04.05715+01
b5c01c3c-3cbd-431a-ab8f-31604c87f12a	524e600b-d62d-469d-b697-22ced0fbcc07	fund	9bb9b764-3bd9-409a-93b6-4926eaed82c4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "9bb9b764-3bd9-409a-93b6-4926eaed82c4", "aum": 540000000.00, "ocf": 0.0095, "isin": "GB00DEM0EM07", "name": "WealthMatrix Demo Emerging Markets Equity", "sedol": "DEM0EM7", "sector": "IA Global Emerging Markets", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "A. Osei (Demo)", "esg_score": 52.00, "yield_pct": 2.6000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration emerging markets equity fund. Not a real fund.", "risk_rating": 6, "inception_date": "2014-02-18", "volatility_pct": 19.8000, "max_drawdown_pct": 31.4000, "manager_tenure_years": 4.90}	2026-08-28 10:02:04.05715+01
cd607eeb-0ec1-479c-b40e-e8895e9518d1	524e600b-d62d-469d-b697-22ced0fbcc07	fund	4e3b2703-d183-4aaf-ab73-1d817c7780c8	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "4e3b2703-d183-4aaf-ab73-1d817c7780c8", "aum": 720000000.00, "ocf": 0.0110, "isin": "GB00DEM0PR08", "name": "WealthMatrix Demo UK Direct Property", "sedol": "DEM0PR8", "sector": "IA UK Direct Property", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "C. Wren (Demo)", "esg_score": 48.00, "yield_pct": 3.8000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "property", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration direct UK commercial property fund. Not a real fund.", "risk_rating": 4, "inception_date": "2007-05-30", "volatility_pct": 7.2000, "max_drawdown_pct": 12.8000, "manager_tenure_years": 8.60}	2026-08-28 10:02:04.05715+01
1fc81943-de76-4ee7-87c6-015018a2103d	524e600b-d62d-469d-b697-22ced0fbcc07	fund	b967e44c-194c-4fe5-a6cf-ab63df7f8735	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "b967e44c-194c-4fe5-a6cf-ab63df7f8735", "aum": 410000000.00, "ocf": 0.0089, "isin": "GB00DEM0AR09", "name": "WealthMatrix Demo Targeted Absolute Return", "sedol": "DEM0AR9", "sector": "IA Targeted Absolute Return", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "L. Bianchi (Demo)", "esg_score": 57.00, "yield_pct": 1.5000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "alternative", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration absolute-return fund. Not a real fund.", "risk_rating": 3, "inception_date": "2016-08-01", "volatility_pct": 5.9000, "max_drawdown_pct": 8.4000, "manager_tenure_years": 6.00}	2026-08-28 10:02:04.05715+01
07fa95b3-10cb-4c3b-8e1d-98bb1311fa67	524e600b-d62d-469d-b697-22ced0fbcc07	fund	c40064b5-1e60-4fd3-a626-45fce75f3330	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "aum": 850000000.00, "ocf": 0.0085, "isin": "GB00WMD01MO0", "name": "WealthMatrix Demo UK Equity Growth", "sedol": "WMD01MO", "sector": "IA UK All Companies", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "J. Alderton (Demo)", "esg_score": 68.00, "yield_pct": 1.8000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration fund tracking UK large/mid-cap growth names. Not a real fund.", "risk_rating": 5, "inception_date": "2012-03-01", "volatility_pct": 14.2000, "max_drawdown_pct": 22.5000, "manager_tenure_years": 6.50}	2026-08-28 10:03:21.095472+01
3cecb358-3f11-4ebb-9fc7-68af896ca94a	524e600b-d62d-469d-b697-22ced0fbcc07	fund	08c25b5f-3ee5-492c-8bea-bcb6820b3bd4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "08c25b5f-3ee5-492c-8bea-bcb6820b3bd4", "aum": 1420000000.00, "ocf": 0.0079, "isin": "GB00WMD02MO0", "name": "WealthMatrix Demo Global Equity Income", "sedol": "WMD02MO", "sector": "IA Global Equity Income", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "R. Okafor (Demo)", "esg_score": 74.00, "yield_pct": 3.2000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration global equity income fund. Not a real fund.", "risk_rating": 4, "inception_date": "2009-11-15", "volatility_pct": 11.8000, "max_drawdown_pct": 18.1000, "manager_tenure_years": 9.20}	2026-08-28 10:03:21.095472+01
590c64e7-f45c-4ea5-9428-a51efcf86239	524e600b-d62d-469d-b697-22ced0fbcc07	fund	e865a933-3f6a-4ee5-bb87-77ddcde36442	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "e865a933-3f6a-4ee5-bb87-77ddcde36442", "aum": 610000000.00, "ocf": 0.0045, "isin": "GB00WMD03MO0", "name": "WealthMatrix Demo Sterling Corporate Bond", "sedol": "WMD03MO", "sector": "IA Sterling Corporate Bond", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "S. Patel (Demo)", "esg_score": 61.00, "yield_pct": 4.6000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "fixed_income", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration sterling investment-grade bond fund. Not a real fund.", "risk_rating": 3, "inception_date": "2015-06-01", "volatility_pct": 6.4000, "max_drawdown_pct": 9.2000, "manager_tenure_years": 4.10}	2026-08-28 10:03:21.095472+01
f2ce2e13-0b51-4a88-a423-55851a63f4db	524e600b-d62d-469d-b697-22ced0fbcc07	fund	93af7c0f-1688-4c66-ae9c-28b3be65aad4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "93af7c0f-1688-4c66-ae9c-28b3be65aad4", "aum": 2100000000.00, "ocf": 0.0012, "isin": "GB00WMD04MO0", "name": "WealthMatrix Demo Money Market GBP", "sedol": "WMD04MO", "sector": "IA Short Term Money Market", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "T. Nguyen (Demo)", "esg_score": 55.00, "yield_pct": 4.9000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "money_market", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration GBP money market fund. Not a real fund.", "risk_rating": 1, "inception_date": "2018-01-10", "volatility_pct": 0.4000, "max_drawdown_pct": 0.1000, "manager_tenure_years": 3.00}	2026-08-28 10:03:21.095472+01
b5890f0e-57d9-40d8-b05f-13fdce275667	524e600b-d62d-469d-b697-22ced0fbcc07	fund	720ada48-e4c9-4504-9dea-20d2152d4f7c	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "720ada48-e4c9-4504-9dea-20d2152d4f7c", "aum": 980000000.00, "ocf": 0.0068, "isin": "GB00WMD05MO0", "name": "WealthMatrix Demo Mixed 40-85 Shares", "sedol": "WMD05MO", "sector": "IA Mixed Investment 40-85% Shares", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "H. Fairbanks (Demo)", "esg_score": 66.00, "yield_pct": 2.4000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "mixed_asset", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration multi-asset fund. Not a real fund.", "risk_rating": 4, "inception_date": "2011-09-20", "volatility_pct": 10.9000, "max_drawdown_pct": 16.3000, "manager_tenure_years": 7.80}	2026-08-28 10:03:21.095472+01
43c1c8dc-619e-4899-bfc0-2f1b67593194	524e600b-d62d-469d-b697-22ced0fbcc07	fund	a15abd9e-68b0-4942-828f-26a9b054097b	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "a15abd9e-68b0-4942-828f-26a9b054097b", "aum": 1750000000.00, "ocf": 0.0082, "isin": "GB00WMD06MO0", "name": "WealthMatrix Demo North America Equity", "sedol": "WMD06MO", "sector": "IA North America", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "M. Delgado (Demo)", "esg_score": 59.00, "yield_pct": 1.1000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration US/Canada equity fund. Not a real fund.", "risk_rating": 5, "inception_date": "2013-04-12", "volatility_pct": 15.6000, "max_drawdown_pct": 24.0000, "manager_tenure_years": 5.40}	2026-08-28 10:03:21.095472+01
d055d5f6-1b99-4fc4-93f2-3ea1b105bdd5	524e600b-d62d-469d-b697-22ced0fbcc07	fund	34df92fc-50e5-4daf-9dee-b6e972c76eae	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "34df92fc-50e5-4daf-9dee-b6e972c76eae", "aum": 540000000.00, "ocf": 0.0095, "isin": "GB00WMD07MO0", "name": "WealthMatrix Demo Emerging Markets Equity", "sedol": "WMD07MO", "sector": "IA Global Emerging Markets", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "A. Osei (Demo)", "esg_score": 52.00, "yield_pct": 2.6000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration emerging markets equity fund. Not a real fund.", "risk_rating": 6, "inception_date": "2014-02-18", "volatility_pct": 19.8000, "max_drawdown_pct": 31.4000, "manager_tenure_years": 4.90}	2026-08-28 10:03:21.095472+01
19a86280-29a7-434c-8d5d-cd31fec7e1de	524e600b-d62d-469d-b697-22ced0fbcc07	fund	a7c82a4a-ca0a-415c-b40d-ec35a633111e	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "a7c82a4a-ca0a-415c-b40d-ec35a633111e", "aum": 720000000.00, "ocf": 0.0110, "isin": "GB00WMD08MO0", "name": "WealthMatrix Demo UK Direct Property", "sedol": "WMD08MO", "sector": "IA UK Direct Property", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "C. Wren (Demo)", "esg_score": 48.00, "yield_pct": 3.8000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "property", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration direct UK commercial property fund. Not a real fund.", "risk_rating": 4, "inception_date": "2007-05-30", "volatility_pct": 7.2000, "max_drawdown_pct": 12.8000, "manager_tenure_years": 8.60}	2026-08-28 10:03:21.095472+01
5161e4ae-23dc-4668-a6b3-a4a99527cde9	524e600b-d62d-469d-b697-22ced0fbcc07	fund	aa3c4ba0-bc31-4f8c-8c96-68f9626fb26a	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "aa3c4ba0-bc31-4f8c-8c96-68f9626fb26a", "aum": 410000000.00, "ocf": 0.0089, "isin": "GB00WMD09MO0", "name": "WealthMatrix Demo Targeted Absolute Return", "sedol": "WMD09MO", "sector": "IA Targeted Absolute Return", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "L. Bianchi (Demo)", "esg_score": 57.00, "yield_pct": 1.5000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "alternative", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration absolute-return fund. Not a real fund.", "risk_rating": 3, "inception_date": "2016-08-01", "volatility_pct": 5.9000, "max_drawdown_pct": 8.4000, "manager_tenure_years": 6.00}	2026-08-28 10:03:21.095472+01
5a11e945-0729-4444-864b-d103fd695087	524e600b-d62d-469d-b697-22ced0fbcc07	fund	93154242-2a4a-41a5-a87e-8df7a57f07d1	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "93154242-2a4a-41a5-a87e-8df7a57f07d1", "aum": 390000000.00, "ocf": 0.0091, "isin": "GB00WMD10MO0", "name": "WealthMatrix Demo Japan Equity", "sedol": "WMD10MO", "sector": "IA Japan", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "K. Watanabe (Demo)", "esg_score": 63.00, "yield_pct": 2.0000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration Japan equity fund. Not a real fund.", "risk_rating": 5, "inception_date": "2012-11-01", "volatility_pct": 16.4000, "max_drawdown_pct": 23.6000, "manager_tenure_years": 5.10}	2026-08-28 10:03:21.095472+01
c2d645fb-1130-4b8d-84be-934c11e00842	524e600b-d62d-469d-b697-22ced0fbcc07	fund	3e827c9a-bcb1-4b78-8085-957e09ed5577	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "3e827c9a-bcb1-4b78-8085-957e09ed5577", "aum": 330000000.00, "ocf": 0.0071, "isin": "GB00WMD11MO0", "name": "WealthMatrix Demo Volatility Managed Growth", "sedol": "WMD11MO", "sector": "IA Volatility Managed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "P. Novak (Demo)", "esg_score": 60.00, "yield_pct": 1.9000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "mixed_asset", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration volatility-managed multi-asset fund. Not a real fund.", "risk_rating": 5, "inception_date": "2017-03-22", "volatility_pct": 12.5000, "max_drawdown_pct": 19.0000, "manager_tenure_years": 4.40}	2026-08-28 10:03:21.095472+01
d3815931-fc35-46de-ac4d-7213fd286555	524e600b-d62d-469d-b697-22ced0fbcc07	fund	1497c9ed-dced-47f0-8ff1-5d637c85851a	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "1497c9ed-dced-47f0-8ff1-5d637c85851a", "aum": 505000000.00, "ocf": 0.0058, "isin": "GB00WMD12MO0", "name": "WealthMatrix Demo Sterling Strategic Bond", "sedol": "WMD12MO", "sector": "IA Sterling Strategic Bond", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "E. Sandberg (Demo)", "esg_score": 58.00, "yield_pct": 4.1000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "fixed_income", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration strategic bond fund. Not a real fund.", "risk_rating": 3, "inception_date": "2010-07-14", "volatility_pct": 7.1000, "max_drawdown_pct": 10.5000, "manager_tenure_years": 7.00}	2026-08-28 10:03:21.095472+01
db6822fc-1d2b-4bc5-a426-4b8113a5d345	524e600b-d62d-469d-b697-22ced0fbcc07	fund	75d0ca30-e86c-40e5-8afb-357d2bf1afae	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "75d0ca30-e86c-40e5-8afb-357d2bf1afae", "aum": 215000000.00, "ocf": 0.0098, "isin": "GB00WMD13MO0", "name": "WealthMatrix Demo Global Smaller Companies", "sedol": "WMD13MO", "sector": "IA Global", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "D. Marsh (Demo)", "esg_score": 54.00, "yield_pct": 0.9000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration global smaller companies fund. Not a real fund.", "risk_rating": 6, "inception_date": "2019-01-05", "volatility_pct": 18.9000, "max_drawdown_pct": 29.7000, "manager_tenure_years": 3.80}	2026-08-28 10:03:21.095472+01
2c652363-15d6-4495-820f-fcf9699c4d7f	524e600b-d62d-469d-b697-22ced0fbcc07	fund	7d840105-1516-45dc-8ffe-843f53304e32	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "7d840105-1516-45dc-8ffe-843f53304e32", "aum": 880000000.00, "ocf": 0.0035, "isin": "GB00WMD14MO0", "name": "WealthMatrix Demo UK Gilt", "sedol": "WMD14MO", "sector": "IA UK Gilts", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "F. Cole (Demo)", "esg_score": 50.00, "yield_pct": 3.9000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "fixed_income", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration UK gilt fund. Not a real fund.", "risk_rating": 2, "inception_date": "2005-10-01", "volatility_pct": 5.8000, "max_drawdown_pct": 8.9000, "manager_tenure_years": 9.90}	2026-08-28 10:03:21.095472+01
d21ea26d-5fdc-4334-98e7-9489bc6a094b	524e600b-d62d-469d-b697-22ced0fbcc07	fund	e34e3871-b234-4fbe-95aa-767992b47361	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "e34e3871-b234-4fbe-95aa-767992b47361", "aum": 460000000.00, "ocf": 0.0087, "isin": "GB00WMD15MO0", "name": "WealthMatrix Demo Ethical Global Equity", "sedol": "WMD15MO", "sector": "IA Global", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "N. Farrow (Demo)", "esg_score": 88.00, "yield_pct": 1.6000, "created_at": "2026-08-28T10:03:21.095472+01:00", "updated_at": "2026-08-28T10:03:21.095472+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration ESG-focused global equity fund. Not a real fund.", "risk_rating": 4, "inception_date": "2016-05-19", "volatility_pct": 12.9000, "max_drawdown_pct": 20.2000, "manager_tenure_years": 5.90}	2026-08-28 10:03:21.095472+01
fba93cee-712c-47a6-a298-b2e6485f09a3	524e600b-d62d-469d-b697-22ced0fbcc07	provider	000622b6-0015-46c9-9ed5-b9581df8c97d	INSERT	\N	\N	{"id": "000622b6-0015-46c9-9ed5-b9581df8c97d", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Canada Life", "email_verified": false, "provider_email": "loa@canadalife.com", "servicing_email": "servicing@canadalife.com", "new_business_email": "newbusiness@canadalife.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
316469e5-26e7-462d-b498-891edeb527cd	524e600b-d62d-469d-b697-22ced0fbcc07	fund	9bb9b764-3bd9-409a-93b6-4926eaed82c4	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "9bb9b764-3bd9-409a-93b6-4926eaed82c4", "aum": 540000000.00, "ocf": 0.0095, "isin": "GB00DEM0EM07", "name": "WealthMatrix Demo Emerging Markets Equity", "sedol": "DEM0EM7", "sector": "IA Global Emerging Markets", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "A. Osei (Demo)", "esg_score": 52.00, "yield_pct": 2.6000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration emerging markets equity fund. Not a real fund.", "risk_rating": 6, "inception_date": "2014-02-18", "volatility_pct": 19.8000, "max_drawdown_pct": 31.4000, "manager_tenure_years": 4.90}	\N	2026-08-28 10:03:59.398835+01
c18985f3-cf47-44f1-a666-3c2fe6f8f44c	524e600b-d62d-469d-b697-22ced0fbcc07	fund	d87dcfc0-4b40-45a4-a468-06ac7e62f27b	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "d87dcfc0-4b40-45a4-a468-06ac7e62f27b", "aum": 1420000000.00, "ocf": 0.0079, "isin": "GB00DEM0GL02", "name": "WealthMatrix Demo Global Equity Income", "sedol": "DEM0GL2", "sector": "IA Global Equity Income", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "R. Okafor (Demo)", "esg_score": 74.00, "yield_pct": 3.2000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration global equity income fund. Not a real fund.", "risk_rating": 4, "inception_date": "2009-11-15", "volatility_pct": 11.8000, "max_drawdown_pct": 18.1000, "manager_tenure_years": 9.20}	\N	2026-08-28 10:03:59.518104+01
7acdfa3c-2e04-4242-883f-008a2cc1c372	524e600b-d62d-469d-b697-22ced0fbcc07	fund	8b8ffeaa-74c9-468f-b886-8aad61751ab4	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "8b8ffeaa-74c9-468f-b886-8aad61751ab4", "aum": 980000000.00, "ocf": 0.0068, "isin": "GB00DEM0MX05", "name": "WealthMatrix Demo Mixed 40-85 Shares", "sedol": "DEM0MX5", "sector": "IA Mixed Investment 40-85% Shares", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "H. Fairbanks (Demo)", "esg_score": 66.00, "yield_pct": 2.4000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "mixed_asset", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration multi-asset fund. Not a real fund.", "risk_rating": 4, "inception_date": "2011-09-20", "volatility_pct": 10.9000, "max_drawdown_pct": 16.3000, "manager_tenure_years": 7.80}	\N	2026-08-28 10:03:59.617232+01
1cba3ae6-d851-4b58-81f7-3d7def2bb590	524e600b-d62d-469d-b697-22ced0fbcc07	fund	0e4fa6b6-fc2e-423f-84c8-5ccbe5089568	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "0e4fa6b6-fc2e-423f-84c8-5ccbe5089568", "aum": 2100000000.00, "ocf": 0.0012, "isin": "GB00DEM0MM04", "name": "WealthMatrix Demo Money Market GBP", "sedol": "DEM0MM4", "sector": "IA Short Term Money Market", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "T. Nguyen (Demo)", "esg_score": 55.00, "yield_pct": 4.9000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "money_market", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration GBP money market fund. Not a real fund.", "risk_rating": 1, "inception_date": "2018-01-10", "volatility_pct": 0.4000, "max_drawdown_pct": 0.1000, "manager_tenure_years": 3.00}	\N	2026-08-28 10:03:59.698492+01
a6cc7480-a75f-4f3e-a37f-487911e72ba0	524e600b-d62d-469d-b697-22ced0fbcc07	fund	30d8a47e-98cf-4df5-97a1-f31baeeeb409	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "30d8a47e-98cf-4df5-97a1-f31baeeeb409", "aum": 1750000000.00, "ocf": 0.0082, "isin": "GB00DEM0NA06", "name": "WealthMatrix Demo North America Equity", "sedol": "DEM0NA6", "sector": "IA North America", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "M. Delgado (Demo)", "esg_score": 59.00, "yield_pct": 1.1000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration US/Canada equity fund. Not a real fund.", "risk_rating": 5, "inception_date": "2013-04-12", "volatility_pct": 15.6000, "max_drawdown_pct": 24.0000, "manager_tenure_years": 5.40}	\N	2026-08-28 10:03:59.774264+01
25bc9e1f-d9e6-4a3e-9061-772cd2d3d39f	524e600b-d62d-469d-b697-22ced0fbcc07	fund	28639fcd-f97e-462f-afc7-8ae55686e53a	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "28639fcd-f97e-462f-afc7-8ae55686e53a", "aum": 610000000.00, "ocf": 0.0045, "isin": "GB00DEM0CB03", "name": "WealthMatrix Demo Sterling Corporate Bond", "sedol": "DEM0CB3", "sector": "IA Sterling Corporate Bond", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "S. Patel (Demo)", "esg_score": 61.00, "yield_pct": 4.6000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "fixed_income", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration sterling investment-grade bond fund. Not a real fund.", "risk_rating": 3, "inception_date": "2015-06-01", "volatility_pct": 6.4000, "max_drawdown_pct": 9.2000, "manager_tenure_years": 4.10}	\N	2026-08-28 10:03:59.84728+01
699d84fd-8d40-4d16-9711-e74807b10d59	524e600b-d62d-469d-b697-22ced0fbcc07	fund	b967e44c-194c-4fe5-a6cf-ab63df7f8735	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "b967e44c-194c-4fe5-a6cf-ab63df7f8735", "aum": 410000000.00, "ocf": 0.0089, "isin": "GB00DEM0AR09", "name": "WealthMatrix Demo Targeted Absolute Return", "sedol": "DEM0AR9", "sector": "IA Targeted Absolute Return", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "L. Bianchi (Demo)", "esg_score": 57.00, "yield_pct": 1.5000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "alternative", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration absolute-return fund. Not a real fund.", "risk_rating": 3, "inception_date": "2016-08-01", "volatility_pct": 5.9000, "max_drawdown_pct": 8.4000, "manager_tenure_years": 6.00}	\N	2026-08-28 10:03:59.918273+01
8a380bf7-f1e5-4c2d-b921-c10fa8fd584e	524e600b-d62d-469d-b697-22ced0fbcc07	fund	4e3b2703-d183-4aaf-ab73-1d817c7780c8	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "4e3b2703-d183-4aaf-ab73-1d817c7780c8", "aum": 720000000.00, "ocf": 0.0110, "isin": "GB00DEM0PR08", "name": "WealthMatrix Demo UK Direct Property", "sedol": "DEM0PR8", "sector": "IA UK Direct Property", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "C. Wren (Demo)", "esg_score": 48.00, "yield_pct": 3.8000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "property", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration direct UK commercial property fund. Not a real fund.", "risk_rating": 4, "inception_date": "2007-05-30", "volatility_pct": 7.2000, "max_drawdown_pct": 12.8000, "manager_tenure_years": 8.60}	\N	2026-08-28 10:03:59.993962+01
16d02977-c649-47e6-9e33-b46089fbb036	524e600b-d62d-469d-b697-22ced0fbcc07	fund	d8b1b971-4ff4-431a-8c4a-d43bd3042a94	DELETE	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	{"id": "d8b1b971-4ff4-431a-8c4a-d43bd3042a94", "aum": 850000000.00, "ocf": 0.0085, "isin": "GB00DEM0UK01", "name": "WealthMatrix Demo UK Equity Growth", "sedol": "DEM0UK1", "sector": "IA UK All Companies", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "manager": "J. Alderton (Demo)", "esg_score": 68.00, "yield_pct": 1.8000, "created_at": "2026-08-28T10:02:04.05715+01:00", "updated_at": "2026-08-28T10:02:04.05715+01:00", "asset_class": "equity", "currency_id": "e9feca71-ef57-41df-ab3a-7e8cd3c2211d", "data_source": "demo_seed", "description": "Demonstration fund tracking UK large/mid-cap growth names. Not a real fund.", "risk_rating": 5, "inception_date": "2012-03-01", "volatility_pct": 14.2000, "max_drawdown_pct": 22.5000, "manager_tenure_years": 6.50}	\N	2026-08-28 10:04:00.076473+01
2e7e66ee-46a4-4ad2-bc99-586e6e208e38	524e600b-d62d-469d-b697-22ced0fbcc07	fund_performance	6ffb5eda-91ef-4ca5-af12-2880b74c7c23	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "6ffb5eda-91ef-4ca5-af12-2880b74c7c23", "period": "1Y", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.443928+01:00", "return_pct": 8.4000}	2026-08-28 10:05:00.443928+01
28a1b15e-67c6-4dca-990f-125bde927fe6	524e600b-d62d-469d-b697-22ced0fbcc07	fund_performance	c0c6cca3-832c-407f-ad02-f950ce046fa4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "c0c6cca3-832c-407f-ad02-f950ce046fa4", "period": "3Y", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.543798+01:00", "return_pct": 24.1000}	2026-08-28 10:05:00.543798+01
55186c66-882d-450f-9abc-59bfcaaa0b9d	524e600b-d62d-469d-b697-22ced0fbcc07	fund_performance	78645f3c-458a-4c7f-894e-3635d98d9e0f	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "78645f3c-458a-4c7f-894e-3635d98d9e0f", "period": "YTD", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.61837+01:00", "return_pct": 5.2000}	2026-08-28 10:05:00.61837+01
d2586388-e6a5-4d7c-8fa5-c8ba87430f30	524e600b-d62d-469d-b697-22ced0fbcc07	fund_holdings	414894a8-1537-48b6-aed4-ce7e553c4315	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "414894a8-1537-48b6-aed4-ce7e553c4315", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.690793+01:00", "holding_name": "Demo Holding 1 PLC", "holding_weight_pct": 4.800}	2026-08-28 10:05:00.690793+01
e37c54b2-bc7d-4753-a262-6f72a7f7027a	524e600b-d62d-469d-b697-22ced0fbcc07	fund_holdings	a4433af4-79db-4b80-87b7-c07247122c65	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "a4433af4-79db-4b80-87b7-c07247122c65", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.76203+01:00", "holding_name": "Demo Holding 2 PLC", "holding_weight_pct": 3.900}	2026-08-28 10:05:00.76203+01
03042b18-1856-49fa-a496-c9aabd36d085	524e600b-d62d-469d-b697-22ced0fbcc07	fund_allocation	a81da955-0bbf-41a6-9ce8-57fcc93e7ab0	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "a81da955-0bbf-41a6-9ce8-57fcc93e7ab0", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "category": "equity", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.830133+01:00", "weight_pct": 96.500}	2026-08-28 10:05:00.830133+01
6c832549-3ec8-4451-ab64-ad4248cfa8bf	524e600b-d62d-469d-b697-22ced0fbcc07	fund_allocation	52cd8655-95f2-4b7c-b7ae-46b8f3a152f4	INSERT	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	\N	{"id": "52cd8655-95f2-4b7c-b7ae-46b8f3a152f4", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "fund_id": "c40064b5-1e60-4fd3-a626-45fce75f3330", "category": "cash", "as_of_date": "2026-08-28", "created_at": "2026-08-28T10:05:00.901652+01:00", "weight_pct": 3.500}	2026-08-28 10:05:00.901652+01
96ca0a7f-acf3-4989-9c18-8f1731aa2527	524e600b-d62d-469d-b697-22ced0fbcc07	provider	f99aaa0e-ab26-4e1d-a029-3b7927f8c285	INSERT	\N	\N	{"id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Quilter", "email_verified": false, "provider_email": "loa@quilter.com", "servicing_email": "servicing@quilter.com", "new_business_email": "newbusiness@quilter.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
80214b2a-3d7c-4a4b-8608-7dc82ca62109	524e600b-d62d-469d-b697-22ced0fbcc07	provider	22ced913-8afc-43ea-80c1-d0f1decab2d9	INSERT	\N	\N	{"id": "22ced913-8afc-43ea-80c1-d0f1decab2d9", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Aviva", "email_verified": false, "provider_email": "loa@aviva.com", "servicing_email": "servicing@aviva.com", "new_business_email": "newbusiness@aviva.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
e7916ab0-9f11-4489-b98a-7bccbd027afa	524e600b-d62d-469d-b697-22ced0fbcc07	provider	3fe8cc4f-96b0-4305-9378-862e3e8dea94	INSERT	\N	\N	{"id": "3fe8cc4f-96b0-4305-9378-862e3e8dea94", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Royal London", "email_verified": false, "provider_email": "loa@royallondon.com", "servicing_email": "servicing@royallondon.com", "new_business_email": "newbusiness@royallondon.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
4cd62934-6b33-4c5e-b33f-02c6f70101b3	524e600b-d62d-469d-b697-22ced0fbcc07	provider	2a871711-5771-4df7-8459-9cccbb9ccf1b	INSERT	\N	\N	{"id": "2a871711-5771-4df7-8459-9cccbb9ccf1b", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "AJ Bell", "email_verified": false, "provider_email": "loa@ajbell.com", "servicing_email": "servicing@ajbell.com", "new_business_email": "newbusiness@ajbell.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
aa0a63df-cb5f-4475-b794-6b613a8b739b	524e600b-d62d-469d-b697-22ced0fbcc07	provider	d5a61e79-51e8-4055-880e-d178c763e9af	INSERT	\N	\N	{"id": "d5a61e79-51e8-4055-880e-d178c763e9af", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Transact", "email_verified": false, "provider_email": "loa@transact.com", "servicing_email": "servicing@transact.com", "new_business_email": "newbusiness@transact.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
a26b9d84-4b05-45fd-a470-fcdd42da70f6	524e600b-d62d-469d-b697-22ced0fbcc07	provider	47c62856-7546-452f-afcd-678605e0bb93	INSERT	\N	\N	{"id": "47c62856-7546-452f-afcd-678605e0bb93", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Standard Life", "email_verified": false, "provider_email": "loa@standardlife.com", "servicing_email": "servicing@standardlife.com", "new_business_email": "newbusiness@standardlife.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
7c8b58db-7d8b-4509-b8f7-03b906a589f9	524e600b-d62d-469d-b697-22ced0fbcc07	provider	590d65b1-6395-4ad9-b5ea-45f0e3e2f964	INSERT	\N	\N	{"id": "590d65b1-6395-4ad9-b5ea-45f0e3e2f964", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Aegon", "email_verified": false, "provider_email": "loa@aegon.com", "servicing_email": "servicing@aegon.com", "new_business_email": "newbusiness@aegon.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
1c2bfaf0-b22e-40fd-8318-720edece0c48	524e600b-d62d-469d-b697-22ced0fbcc07	provider	b2817f12-a96b-4d6e-ab36-e34701420dfe	INSERT	\N	\N	{"id": "b2817f12-a96b-4d6e-ab36-e34701420dfe", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "LV", "email_verified": false, "provider_email": "loa@lv.com", "servicing_email": "servicing@lv.com", "new_business_email": "newbusiness@lv.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
2b356f28-c7df-46a4-9cd9-3e35159ff031	524e600b-d62d-469d-b697-22ced0fbcc07	provider	083420cb-05f2-44c9-976b-ba9453ea69d7	INSERT	\N	\N	{"id": "083420cb-05f2-44c9-976b-ba9453ea69d7", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "HSBC Life", "email_verified": false, "provider_email": "loa@hsbclife.com", "servicing_email": "servicing@hsbclife.com", "new_business_email": "newbusiness@hsbclife.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
519946fe-aeb4-4c07-b1c6-154e424242be	524e600b-d62d-469d-b697-22ced0fbcc07	provider	8a294eaf-899e-435f-a81d-06627846a4e5	INSERT	\N	\N	{"id": "8a294eaf-899e-435f-a81d-06627846a4e5", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Hargreaves Lansdown", "email_verified": false, "provider_email": "loa@hargreaveslansdown.com", "servicing_email": "servicing@hargreaveslansdown.com", "new_business_email": "newbusiness@hargreaveslansdown.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
63bf0747-aeea-4f37-8e89-9e0da5355c64	524e600b-d62d-469d-b697-22ced0fbcc07	provider	aa3aa19d-87be-48f3-a6a7-413f9fd1b0d5	INSERT	\N	\N	{"id": "aa3aa19d-87be-48f3-a6a7-413f9fd1b0d5", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Fidelity International", "email_verified": false, "provider_email": "loa@fidelityinternational.com", "servicing_email": "servicing@fidelityinternational.com", "new_business_email": "newbusiness@fidelityinternational.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
a1c00696-dbaf-40e7-ac43-7c876e12ca16	524e600b-d62d-469d-b697-22ced0fbcc07	provider	e28b1d02-aff1-4391-9508-a1d48b61aa56	INSERT	\N	\N	{"id": "e28b1d02-aff1-4391-9508-a1d48b61aa56", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Vanguard", "email_verified": false, "provider_email": "loa@vanguard.com", "servicing_email": "servicing@vanguard.com", "new_business_email": "newbusiness@vanguard.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
cbedcba3-f218-44ef-9248-e32edcce1e1e	524e600b-d62d-469d-b697-22ced0fbcc07	provider	1337665a-2519-4e7d-a172-4921e15065a7	INSERT	\N	\N	{"id": "1337665a-2519-4e7d-a172-4921e15065a7", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Phoenix", "email_verified": false, "provider_email": "loa@phoenix.com", "servicing_email": "servicing@phoenix.com", "new_business_email": "newbusiness@phoenix.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
0b621199-1ccf-4827-abab-fbd6a2e449a6	524e600b-d62d-469d-b697-22ced0fbcc07	provider	7a21591c-c0a2-44cd-9561-e664a40c2fa2	INSERT	\N	\N	{"id": "7a21591c-c0a2-44cd-9561-e664a40c2fa2", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Scottish Widows", "email_verified": false, "provider_email": "loa@scottishwidows.com", "servicing_email": "servicing@scottishwidows.com", "new_business_email": "newbusiness@scottishwidows.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
f40f9e08-bdfc-4566-b2d2-dc9576d62232	524e600b-d62d-469d-b697-22ced0fbcc07	provider	afa033d5-d0ef-441c-9e37-995b1c85b266	INSERT	\N	\N	{"id": "afa033d5-d0ef-441c-9e37-995b1c85b266", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Zurich", "email_verified": false, "provider_email": "loa@zurich.com", "servicing_email": "servicing@zurich.com", "new_business_email": "newbusiness@zurich.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
ba66eb22-17f6-41fc-8b9c-c4f4536222d6	524e600b-d62d-469d-b697-22ced0fbcc07	provider	3d403753-e5fa-4d1c-aaf8-c1e5f850c76d	INSERT	\N	\N	{"id": "3d403753-e5fa-4d1c-aaf8-c1e5f850c76d", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Legal & General", "email_verified": false, "provider_email": "loa@legalgeneral.com", "servicing_email": "servicing@legalgeneral.com", "new_business_email": "newbusiness@legalgeneral.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
b5cfdb0d-258d-404a-ad95-c131e024509e	524e600b-d62d-469d-b697-22ced0fbcc07	provider	b7c44e36-90e7-472a-bcfd-b19f8c27673a	INSERT	\N	\N	{"id": "b7c44e36-90e7-472a-bcfd-b19f8c27673a", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Old Mutual", "email_verified": false, "provider_email": "loa@oldmutual.com", "servicing_email": "servicing@oldmutual.com", "new_business_email": "newbusiness@oldmutual.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
03726cc5-3722-455f-932d-45328c6de43f	524e600b-d62d-469d-b697-22ced0fbcc07	provider	914f9ab1-69a8-4acb-9dc5-18045b0c5adb	INSERT	\N	\N	{"id": "914f9ab1-69a8-4acb-9dc5-18045b0c5adb", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "MetLife", "email_verified": false, "provider_email": "loa@metlife.com", "servicing_email": "servicing@metlife.com", "new_business_email": "newbusiness@metlife.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
541fb190-6471-4a6b-8bd7-000f0291066b	524e600b-d62d-469d-b697-22ced0fbcc07	provider	1b559f40-9793-42ce-a04c-a683fc2cb801	INSERT	\N	\N	{"id": "1b559f40-9793-42ce-a04c-a683fc2cb801", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Allianz", "email_verified": false, "provider_email": "loa@allianz.com", "servicing_email": "servicing@allianz.com", "new_business_email": "newbusiness@allianz.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
076fed19-c87e-465a-9879-d04316a2b293	524e600b-d62d-469d-b697-22ced0fbcc07	provider	098fb6c5-1ffc-4d87-97ad-7299b7c677bd	INSERT	\N	\N	{"id": "098fb6c5-1ffc-4d87-97ad-7299b7c677bd", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "AXA", "email_verified": false, "provider_email": "loa@axa.com", "servicing_email": "servicing@axa.com", "new_business_email": "newbusiness@axa.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
19b6ec02-ac6e-4ea5-93ef-b3f59ab7a935	524e600b-d62d-469d-b697-22ced0fbcc07	provider	55b60b24-2178-436a-9b0d-6d419e5bb4be	INSERT	\N	\N	{"id": "55b60b24-2178-436a-9b0d-6d419e5bb4be", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "BNP Paribas", "email_verified": false, "provider_email": "loa@bnpparibas.com", "servicing_email": "servicing@bnpparibas.com", "new_business_email": "newbusiness@bnpparibas.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
47aad391-eb13-4845-b435-ed4e4a3418b6	524e600b-d62d-469d-b697-22ced0fbcc07	provider	ad56c128-dd63-4ec7-87b7-3fb431f609dd	INSERT	\N	\N	{"id": "ad56c128-dd63-4ec7-87b7-3fb431f609dd", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Schroders", "email_verified": false, "provider_email": "loa@schroders.com", "servicing_email": "servicing@schroders.com", "new_business_email": "newbusiness@schroders.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
6c3be61d-c4e5-467f-962d-3e52b12431c9	524e600b-d62d-469d-b697-22ced0fbcc07	provider	f679c6db-abed-4164-a89d-7f45461ed435	INSERT	\N	\N	{"id": "f679c6db-abed-4164-a89d-7f45461ed435", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "JP Morgan", "email_verified": false, "provider_email": "loa@jpmorgan.com", "servicing_email": "servicing@jpmorgan.com", "new_business_email": "newbusiness@jpmorgan.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
aeecb835-e6c1-4fc5-b980-3b1e3278cd89	524e600b-d62d-469d-b697-22ced0fbcc07	provider	4c8f80b8-ac28-4609-8132-9777fe0f7fd2	INSERT	\N	\N	{"id": "4c8f80b8-ac28-4609-8132-9777fe0f7fd2", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "BlackRock", "email_verified": false, "provider_email": "loa@blackrock.com", "servicing_email": "servicing@blackrock.com", "new_business_email": "newbusiness@blackrock.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
3a1ddce5-e2da-44ba-8150-1a4645d59ba2	524e600b-d62d-469d-b697-22ced0fbcc07	provider	78fcdd1c-a6a4-491f-9092-43e027c29538	INSERT	\N	\N	{"id": "78fcdd1c-a6a4-491f-9092-43e027c29538", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "HSBC Asset Management", "email_verified": false, "provider_email": "loa@hsbcassetmanagement.com", "servicing_email": "servicing@hsbcassetmanagement.com", "new_business_email": "newbusiness@hsbcassetmanagement.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
239eb90d-5901-466b-b1eb-ad0b788962e9	524e600b-d62d-469d-b697-22ced0fbcc07	provider	68283d1b-0cf4-4c0e-bb04-980bd159f02b	INSERT	\N	\N	{"id": "68283d1b-0cf4-4c0e-bb04-980bd159f02b", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Baillie Gifford", "email_verified": false, "provider_email": "loa@bailliegifford.com", "servicing_email": "servicing@bailliegifford.com", "new_business_email": "newbusiness@bailliegifford.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
27375b5e-c93a-44bc-8590-de704dd90132	524e600b-d62d-469d-b697-22ced0fbcc07	provider	bafdbfe7-d2ea-4d96-ba02-50d49f3ef93a	INSERT	\N	\N	{"id": "bafdbfe7-d2ea-4d96-ba02-50d49f3ef93a", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "M&G", "email_verified": false, "provider_email": "loa@mg.com", "servicing_email": "servicing@mg.com", "new_business_email": "newbusiness@mg.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
2b6be8e7-f160-42a3-ba3e-f1001fd1c993	524e600b-d62d-469d-b697-22ced0fbcc07	provider	c09600e5-ae40-4384-b345-f46e59a85ee3	INSERT	\N	\N	{"id": "c09600e5-ae40-4384-b345-f46e59a85ee3", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Rathbones", "email_verified": false, "provider_email": "loa@rathbones.com", "servicing_email": "servicing@rathbones.com", "new_business_email": "newbusiness@rathbones.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
30407a97-3c67-49d2-b105-c9d83240fcd3	524e600b-d62d-469d-b697-22ced0fbcc07	provider	f1418831-1b19-4c6b-8824-5a865881b6c6	INSERT	\N	\N	{"id": "f1418831-1b19-4c6b-8824-5a865881b6c6", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Charles Stanley", "email_verified": false, "provider_email": "loa@charlesstanley.com", "servicing_email": "servicing@charlesstanley.com", "new_business_email": "newbusiness@charlesstanley.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
76c32299-f605-4e10-aff0-d0a2adf0d061	524e600b-d62d-469d-b697-22ced0fbcc07	provider	7da8827b-3868-4fce-8569-98be24253ded	INSERT	\N	\N	{"id": "7da8827b-3868-4fce-8569-98be24253ded", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Abrdn", "email_verified": false, "provider_email": "loa@abrdn.com", "servicing_email": "servicing@abrdn.com", "new_business_email": "newbusiness@abrdn.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
6e981320-95b9-48a9-aaac-aa78e777fc03	524e600b-d62d-469d-b697-22ced0fbcc07	provider	9e28b429-df96-4c46-b2b4-95f5a2247a81	INSERT	\N	\N	{"id": "9e28b429-df96-4c46-b2b4-95f5a2247a81", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Nutmeg", "email_verified": false, "provider_email": "loa@nutmeg.com", "servicing_email": "servicing@nutmeg.com", "new_business_email": "newbusiness@nutmeg.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
44b1a61f-e617-47d2-9e1c-18391522a4cc	524e600b-d62d-469d-b697-22ced0fbcc07	provider	32ab9e41-dc2b-4efc-bede-038029904a87	INSERT	\N	\N	{"id": "32ab9e41-dc2b-4efc-bede-038029904a87", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Wealthify", "email_verified": false, "provider_email": "loa@wealthify.com", "servicing_email": "servicing@wealthify.com", "new_business_email": "newbusiness@wealthify.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 11:52:53.544876+01
ac334d1e-4a2c-47c9-96d7-2833c7a3d8c0	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	\N	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": null, "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-27T14:57:01.621391+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T12:01:58.615028+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-28 12:01:58.615028+01
e3b6e97e-f3c3-46e5-a3cf-cf053978504c	524e600b-d62d-469d-b697-22ced0fbcc07	loa_template	a3443855-274e-45dd-b8f9-65715a426706	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "a3443855-274e-45dd-b8f9-65715a426706", "name": "Standard LOA", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "version": 1, "field_map": null, "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "test-loa-template.docx", "is_active": true, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:03:15.665802+01:00", "updated_at": "2026-08-28T12:03:15.665802+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a"}	2026-08-28 12:03:15.665802+01
abd40a2c-7813-4ff5-9c84-31e6f430456c	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	44f29684-6367-49f4-bf46-aa3925481f45	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "44f29684-6367-49f4-bf46-aa3925481f45", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:04:18.61272+01:00", "updated_at": "2026-08-28T12:04:18.61272+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "test-loa-template_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "a3443855-274e-45dd-b8f9-65715a426706"}	2026-08-28 12:04:18.61272+01
af6431d9-17e4-482e-803d-094eabb8c138	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	44f29684-6367-49f4-bf46-aa3925481f45	DELETE	\N	{"id": "44f29684-6367-49f4-bf46-aa3925481f45", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:04:18.61272+01:00", "updated_at": "2026-08-28T12:04:18.61272+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "test-loa-template_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "a3443855-274e-45dd-b8f9-65715a426706"}	\N	2026-08-28 12:05:00.947628+01
50dd6ec3-1d94-4855-9de5-76774fed3e5e	524e600b-d62d-469d-b697-22ced0fbcc07	loa_template	a3443855-274e-45dd-b8f9-65715a426706	DELETE	\N	{"id": "a3443855-274e-45dd-b8f9-65715a426706", "name": "Standard LOA", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "version": 1, "field_map": null, "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "test-loa-template.docx", "is_active": true, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:03:15.665802+01:00", "updated_at": "2026-08-28T12:03:15.665802+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a"}	\N	2026-08-28 12:05:00.955385+01
be99d28b-3e23-4f85-9674-85327734c960	524e600b-d62d-469d-b697-22ced0fbcc07	provider	f99aaa0e-ab26-4e1d-a029-3b7927f8c285	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T11:52:53.544876+01:00", "provider_name": "Quilter", "email_verified": false, "provider_email": "loa@quilter.com", "servicing_email": "servicing@quilter.com", "new_business_email": "newbusiness@quilter.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	{"id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T12:07:30.968264+01:00", "provider_name": "Quilter", "email_verified": true, "provider_email": "loa@quilter.com", "servicing_email": "servicing@quilter.com", "new_business_email": "newbusiness@quilter.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 12:07:30.968264+01
46808f1d-038a-46c1-a344-f4b64aa60ba0	524e600b-d62d-469d-b697-22ced0fbcc07	loa_template	57cfa241-dda2-475e-8cbd-0eac4495783c	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "57cfa241-dda2-475e-8cbd-0eac4495783c", "name": "Standard LOA", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "version": 1, "field_map": null, "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "standard-loa.docx", "is_active": true, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:09:19.44464+01:00", "updated_at": "2026-08-28T12:09:19.44464+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a"}	2026-08-28 12:09:19.44464+01
5def278f-86ab-4f84-9fdf-5c626f52ea91	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	7dea6666-4100-495e-8d88-7da637de4dd1	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "7dea6666-4100-495e-8d88-7da637de4dd1", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:10:27.885462+01:00", "updated_at": "2026-08-28T12:10:27.885462+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "22ced913-8afc-43ea-80c1-d0f1decab2d9", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "standard-loa_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "57cfa241-dda2-475e-8cbd-0eac4495783c"}	2026-08-28 12:10:27.885462+01
2586d0c8-2132-4ed8-80a9-ec89cefea33c	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	084c1bfa-aaf6-4ef3-a79c-03c01be078f3	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "084c1bfa-aaf6-4ef3-a79c-03c01be078f3", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:13:18.522202+01:00", "updated_at": "2026-08-28T12:13:18.522202+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "22ced913-8afc-43ea-80c1-d0f1decab2d9", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "standard-loa_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "57cfa241-dda2-475e-8cbd-0eac4495783c"}	2026-08-28 12:13:18.522202+01
77e607cb-a3c0-45ac-aa02-51a3823bd016	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	7dea6666-4100-495e-8d88-7da637de4dd1	DELETE	\N	{"id": "7dea6666-4100-495e-8d88-7da637de4dd1", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:10:27.885462+01:00", "updated_at": "2026-08-28T12:10:27.885462+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "22ced913-8afc-43ea-80c1-d0f1decab2d9", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "standard-loa_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "57cfa241-dda2-475e-8cbd-0eac4495783c"}	\N	2026-08-28 12:13:38.799882+01
6024b561-1005-4f0c-8172-b21e08da1c9c	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_provider_actions	084c1bfa-aaf6-4ef3-a79c-03c01be078f3	DELETE	\N	{"id": "084c1bfa-aaf6-4ef3-a79c-03c01be078f3", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "sent_at": null, "adviser_id": "3579ddda-bee0-490a-9a68-6a15424a667a", "created_at": "2026-08-28T12:13:18.522202+01:00", "updated_at": "2026-08-28T12:13:18.522202+01:00", "email_error": "Email is not configured on this backend — set SMTP_HOST (and SMTP_PORT/SMTP_USER/SMTP_PASS/SMTP_FROM as needed) in .env and restart the server.", "loa_version": 1, "provider_id": "22ced913-8afc-43ea-80c1-d0f1decab2d9", "email_status": "FAILED", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "documents_sent": [{"fileName": "standard-loa_filled.docx", "documentType": "LOA"}, {"fileName": "fact_find.pdf", "documentType": "FACT_FIND"}, {"fileName": "policy_summary.pdf", "documentType": "POLICY_SUMMARY"}, {"fileName": "adviser_details.pdf", "documentType": "ADVISER_DETAILS"}], "loa_template_id": "57cfa241-dda2-475e-8cbd-0eac4495783c"}	\N	2026-08-28 12:13:38.799882+01
c750ce91-9598-4cea-90a3-f240c2b38b2d	524e600b-d62d-469d-b697-22ced0fbcc07	loa_template	57cfa241-dda2-475e-8cbd-0eac4495783c	DELETE	\N	{"id": "57cfa241-dda2-475e-8cbd-0eac4495783c", "name": "Standard LOA", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "version": 1, "field_map": null, "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "standard-loa.docx", "is_active": true, "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:09:19.44464+01:00", "updated_at": "2026-08-28T12:09:19.44464+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a"}	\N	2026-08-28 12:13:38.8119+01
de9f6bc9-9f06-43fd-8157-9ce12542a78f	524e600b-d62d-469d-b697-22ced0fbcc07	provider	f99aaa0e-ab26-4e1d-a029-3b7927f8c285	UPDATE	\N	{"id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T12:07:30.968264+01:00", "provider_name": "Quilter", "email_verified": true, "provider_email": "loa@quilter.com", "servicing_email": "servicing@quilter.com", "new_business_email": "newbusiness@quilter.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	{"id": "f99aaa0e-ab26-4e1d-a029-3b7927f8c285", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "is_active": true, "created_at": "2026-08-28T11:52:53.544876+01:00", "updated_at": "2026-08-28T12:13:49.986056+01:00", "provider_name": "Quilter", "email_verified": false, "provider_email": "loa@quilter.com", "servicing_email": "servicing@quilter.com", "new_business_email": "newbusiness@quilter.com", "required_documents": ["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]}	2026-08-28 12:13:49.986056+01
84b57955-20e1-48a9-b680-d8765c9a0eee	524e600b-d62d-469d-b697-22ced0fbcc07	client_document	099e26f0-fcfa-4f29-b173-45dcedaf3594	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "099e26f0-fcfa-4f29-b173-45dcedaf3594", "source": "uploaded", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "passport-scan.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:15:17.134307+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "document_type": "ID_PROOF"}	2026-08-28 12:15:17.134307+01
abaddee1-8c72-41eb-bd2a-1105781f9800	524e600b-d62d-469d-b697-22ced0fbcc07	client_document	099e26f0-fcfa-4f29-b173-45dcedaf3594	DELETE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "099e26f0-fcfa-4f29-b173-45dcedaf3594", "source": "uploaded", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "passport-scan.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:15:17.134307+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "document_type": "ID_PROOF"}	\N	2026-08-28 12:15:32.799247+01
8604f585-b96e-4986-b88b-b409db883ec9	524e600b-d62d-469d-b697-22ced0fbcc07	client_document	76d621cc-d789-4ea6-b2ee-b5c94029ea0e	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "76d621cc-d789-4ea6-b2ee-b5c94029ea0e", "source": "uploaded", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "delete-test.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:21:08.972776+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "document_type": "KYC"}	2026-08-28 12:21:08.972776+01
84984afa-7740-452b-99d5-9c8ace835541	524e600b-d62d-469d-b697-22ced0fbcc07	client_document	76d621cc-d789-4ea6-b2ee-b5c94029ea0e	DELETE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "76d621cc-d789-4ea6-b2ee-b5c94029ea0e", "source": "uploaded", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "file_data": "\\\\x504b03040a00000000002c601c5d179800d7b2010000b2010000130000005b436f6e74656e745f54797065735d2e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c547970657320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f636f6e74656e742d7479706573223e0a3c44656661756c7420457874656e73696f6e3d2272656c732220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d7061636b6167652e72656c6174696f6e73686970732b786d6c222f3e0a3c44656661756c7420457874656e73696f6e3d22786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f786d6c222f3e0a3c4f7665727269646520506172744e616d653d222f776f72642f646f63756d656e742e786d6c2220436f6e74656e74547970653d226170706c69636174696f6e2f766e642e6f70656e786d6c666f726d6174732d6f6666696365646f63756d656e742e776f726470726f63657373696e676d6c2e646f63756d656e742e6d61696e2b786d6c222f3e0a3c2f54797065733e504b03040a00000000002c601c5d3fadfefa2c0100002c0100000b0000005f72656c732f2e72656c733c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c52656c6174696f6e736869707320786d6c6e733d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f7061636b6167652f323030362f72656c6174696f6e7368697073223e0a3c52656c6174696f6e736869702049643d22724964312220547970653d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f6f6666696365446f63756d656e742f323030362f72656c6174696f6e73686970732f6f6666696365446f63756d656e7422205461726765743d22776f72642f646f63756d656e742e786d6c222f3e0a3c2f52656c6174696f6e73686970733e504b03040a00000000002c601c5dcc1f791ab9010000b901000011000000776f72642f646f63756d656e742e786d6c3c3f786d6c2076657273696f6e3d22312e302220656e636f64696e673d225554462d3822207374616e64616c6f6e653d22796573223f3e0a3c773a646f63756d656e7420786d6c6e733a773d22687474703a2f2f736368656d61732e6f70656e786d6c666f726d6174732e6f72672f776f726470726f63657373696e676d6c2f323030362f6d61696e223e0a3c773a626f64793e0a3c773a703e3c773a723e3c773a743e436c69656e743a207b7b636c69656e745f6e616d657d7d20444f42207b7b636c69656e745f444f427d7d204e49207b7b636c69656e745f4e497d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e416476697365723a207b7b616476697365725f6e616d657d7d20464341207b7b616476697365725f4643417d7d20456d61696c207b7b616476697365725f656d61696c7d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a703e3c773a723e3c773a743e50726f76696465723a207b7b70726f76696465725f6e616d657d7d3c2f773a743e3c2f773a723e3c2f773a703e0a3c773a7365637450722f3e0a3c2f773a626f64793e0a3c2f773a646f63756d656e743e504b010214000a00000000002c601c5d179800d7b2010000b20100001300000000000000000000000000000000005b436f6e74656e745f54797065735d2e786d6c504b010214000a00000000002c601c5d3fadfefa2c0100002c0100000b00000000000000000000000000e30100005f72656c732f2e72656c73504b010214000a00000000002c601c5dcc1f791ab9010000b9010000110000000000000000000000000038030000776f72642f646f63756d656e742e786d6c504b05060000000003000300b9000000200500000000", "file_name": "delete-test.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "created_at": "2026-08-28T12:21:08.972776+01:00", "uploaded_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "document_type": "KYC"}	\N	2026-08-28 12:21:24.586995+01
784a78ac-9c50-4c44-9eab-203cbb2407a2	524e600b-d62d-469d-b697-22ced0fbcc07	fact_find	da687407-2dda-4e0b-a3af-1112af368145	INSERT	3579ddda-bee0-490a-9a68-6a15424a667a	\N	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 50.00, "updated_at": "2026-08-28T13:51:42.713943+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "balanced", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "C"}, {"questionKey": "market_knowledge", "selectedOption": "C"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "C"}, {"questionKey": "prioritise_preservation", "selectedOption": "C"}, {"questionKey": "horizon_stability", "selectedOption": "C"}, {"questionKey": "income_growth_expectation", "selectedOption": "C"}, {"questionKey": "loss_reaction", "selectedOption": "C"}, {"questionKey": "investment_priority", "selectedOption": "C"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	2026-08-28 13:51:42.713943+01
0951f03a-cea0-4b9e-95ab-18680db7eeb7	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T12:01:58.615028+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:51:42.713943+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-28 13:51:42.713943+01
f8e2c6e9-7749-483f-9b1e-6eacc06614e8	524e600b-d62d-469d-b697-22ced0fbcc07	fact_find	da687407-2dda-4e0b-a3af-1112af368145	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 50.00, "updated_at": "2026-08-28T13:51:42.713943+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "balanced", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "C"}, {"questionKey": "market_knowledge", "selectedOption": "C"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "C"}, {"questionKey": "prioritise_preservation", "selectedOption": "C"}, {"questionKey": "horizon_stability", "selectedOption": "C"}, {"questionKey": "income_growth_expectation", "selectedOption": "C"}, {"questionKey": "loss_reaction", "selectedOption": "C"}, {"questionKey": "investment_priority", "selectedOption": "C"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 87.50, "updated_at": "2026-08-28T13:53:08.840262+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "aggressive", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "E"}, {"questionKey": "market_knowledge", "selectedOption": "E"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "E"}, {"questionKey": "prioritise_preservation", "selectedOption": "E"}, {"questionKey": "horizon_stability", "selectedOption": "E"}, {"questionKey": "income_growth_expectation", "selectedOption": "E"}, {"questionKey": "loss_reaction", "selectedOption": "E"}, {"questionKey": "investment_priority", "selectedOption": "E"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	2026-08-28 13:53:08.840262+01
86af4b4c-be78-47fc-a588-738e688c656b	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:51:42.713943+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:53:08.840262+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "aggressive", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-28 13:53:08.840262+01
b3e5c1f3-f20f-43db-90f0-1faa0797f60b	524e600b-d62d-469d-b697-22ced0fbcc07	fact_find	da687407-2dda-4e0b-a3af-1112af368145	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 87.50, "updated_at": "2026-08-28T13:53:08.840262+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "aggressive", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "E"}, {"questionKey": "market_knowledge", "selectedOption": "E"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "E"}, {"questionKey": "prioritise_preservation", "selectedOption": "E"}, {"questionKey": "horizon_stability", "selectedOption": "E"}, {"questionKey": "income_growth_expectation", "selectedOption": "E"}, {"questionKey": "loss_reaction", "selectedOption": "E"}, {"questionKey": "investment_priority", "selectedOption": "E"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 87.50, "updated_at": "2026-08-28T13:55:39.120538+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": "2026-08-28", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "aggressive", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "E"}, {"questionKey": "market_knowledge", "selectedOption": "E"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "E"}, {"questionKey": "prioritise_preservation", "selectedOption": "E"}, {"questionKey": "horizon_stability", "selectedOption": "E"}, {"questionKey": "income_growth_expectation", "selectedOption": "E"}, {"questionKey": "loss_reaction", "selectedOption": "E"}, {"questionKey": "investment_priority", "selectedOption": "E"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	2026-08-28 13:55:39.120538+01
fd82b025-62ca-4bd2-8cfe-00766d346c3b	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:53:08.840262+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "aggressive", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:55:39.120538+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "aggressive", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-28 13:55:39.120538+01
d675e272-a8e0-425d-a6b7-749bec85f2d5	524e600b-d62d-469d-b697-22ced0fbcc07	fact_find	da687407-2dda-4e0b-a3af-1112af368145	DELETE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "da687407-2dda-4e0b-a3af-1112af368145", "assets": {"notes": "", "pensions": [], "nonPension": []}, "status": "completed", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "insurance": {"notes": "", "whyNot": "", "policies": [], "hasLifeInsurance": false}, "signed_on": null, "created_at": "2026-08-28T13:51:42.713943+01:00", "created_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "risk_score": 87.50, "updated_at": "2026-08-28T13:55:39.120538+01:00", "declaration": {"fullName": "", "infoAccurate": false, "termsAccepted": false, "completionMethod": "face_to_face"}, "liabilities": {"items": [], "notes": ""}, "completed_on": "2026-08-28", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814", "risk_capacity": {"assessmentBasis": "personal", "netWorthExclHome": "", "withdrawalHorizon": "", "monthlyDisposableIncome": ""}, "risk_category": "aggressive", "review_purposes": {"selected": [], "reviewNotes": "", "otherDetails": ""}, "income_expenditure": {"client": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}, "partner": {"notes": "", "sources": [], "taxStatus": "basic_rate", "expenditure": [], "employmentStatus": "employed"}}, "risk_questionnaire": [{"questionKey": "general_risk_appetite", "selectedOption": "E"}, {"questionKey": "market_knowledge", "selectedOption": "E"}, {"questionKey": "accept_losses_for_returns", "selectedOption": "E"}, {"questionKey": "prioritise_preservation", "selectedOption": "E"}, {"questionKey": "horizon_stability", "selectedOption": "E"}, {"questionKey": "income_growth_expectation", "selectedOption": "E"}, {"questionKey": "loss_reaction", "selectedOption": "E"}, {"questionKey": "investment_priority", "selectedOption": "E"}], "investment_questions": {"notes": "", "lumpSumWhen": "", "lumpSumSource": "", "prefersActive": false, "expectsLumpSum": false, "lastReviewDate": "", "prefersPassive": false, "withdrawalType": "", "withdrawalWhen": "", "hasOtherAdvisor": false, "withdrawalAmount": "", "withdrawalIntends": false, "otherAdvisorDetails": "", "specialRequirements": "", "investmentObjectives": "", "reflectsRiskAppetite": "not_sure"}, "retirement_questions": {"reasoning": "", "selfYearsWorked": "", "pensionIntention": "not_sure", "partnerYearsWorked": "", "selfExpectedAmount": "", "selfFullStatePension": true, "partnerExpectedAmount": "", "partnerFullStatePension": true, "minMonthlyIncomeRequirement": ""}, "personal_circumstances": {"isPEP": false, "smoker": false, "hasWill": false, "dependents": [], "partnerDOB": "", "partnerSex": "", "poaDetails": "", "partnerName": "", "healthStatus": "good", "healthExplain": "", "maritalStatus": "single", "poaOverAffairs": false, "partnerOccupation": "", "vulnerabilityNotes": "", "affectsUnderstanding": false, "needsAdditionalSupport": false, "additionalSupportDetails": "", "additionalSupportProvided": "", "spouseCommunicationConsent": false, "affectsUnderstandingDetails": ""}}	\N	2026-08-28 13:56:36.961445+01
5126c7dc-1250-4996-a712-c1fbfbc1cc64	524e600b-d62d-469d-b697-22ced0fbcc07	person	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	UPDATE	\N	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:55:39.120538+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "aggressive", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	{"id": "ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c", "city": "London", "email": "alexandra.sterling@example.com", "phone": "+44 20 7946 0958", "country": null, "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "domicile": "GB", "is_active": true, "last_name": "Sterling", "ni_number": "QQ123456C", "created_at": "2026-08-26T16:26:55.770432+01:00", "first_name": "Alexandra", "kyc_status": "verified", "updated_at": "2026-08-28T13:56:46.483566+01:00", "postal_code": null, "address_line1": null, "address_line2": null, "date_of_birth": null, "tax_residency": "GB", "risk_tolerance": "moderate", "kyc_verified_at": null, "source_of_wealth": "Sale of family business"}	2026-08-28 13:56:46.483566+01
bd33bd33-436a-422e-bf58-d24cd6658a14	524e600b-d62d-469d-b697-22ced0fbcc07	compliance_log	2b757d56-d9a7-42f7-af7e-bb80e0a2b787	UPDATE	3579ddda-bee0-490a-9a68-6a15424a667a	{"id": "2b757d56-d9a7-42f7-af7e-bb80e0a2b787", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "KYC refresh overdue - last verified over 12 months ago", "metadata": {}, "severity": "breach", "entity_id": null, "rule_code": "KYC_REFRESH_OVERDUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": null, "resolved_by": null, "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	{"id": "2b757d56-d9a7-42f7-af7e-bb80e0a2b787", "firm_id": "524e600b-d62d-469d-b697-22ced0fbcc07", "message": "KYC refresh overdue - last verified over 12 months ago", "metadata": {}, "severity": "breach", "entity_id": null, "rule_code": "KYC_REFRESH_OVERDUE", "detected_at": "2026-08-27T14:19:23.110845+01:00", "resolved_at": "2026-08-28T14:19:05.129+01:00", "resolved_by": "3579ddda-bee0-490a-9a68-6a15424a667a", "household_id": "18889b89-2f36-4a30-aa55-d4fef82b3814"}	2026-08-28 14:19:05.12895+01
\.


--
-- Data for Name: client_document; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_document (id, firm_id, household_id, document_type, file_name, mime_type, file_data, source, uploaded_by, created_at) FROM stdin;
\.


--
-- Data for Name: client_note; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.client_note (id, firm_id, household_id, author_id, note, created_at) FROM stdin;
7c3303eb-f73b-4d78-9f62-1894ac460e4d	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	3579ddda-bee0-490a-9a68-6a15424a667a	Annual review call held - discussed pension consolidation options.	2026-08-27 14:59:05.932857+01
\.


--
-- Data for Name: compliance_log; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compliance_log (id, firm_id, household_id, entity_id, severity, rule_code, message, detected_at, resolved_at, resolved_by, metadata) FROM stdin;
783de73d-3aca-43cd-933a-f94763b285fc	524e600b-d62d-469d-b697-22ced0fbcc07	262061da-d7ca-4b2f-a435-0745d97dca4a	\N	warning	SUITABILITY_REVIEW_DUE	Annual suitability review due within 30 days	2026-08-27 14:19:23.110845+01	2026-08-27 15:56:13.396+01	3579ddda-bee0-490a-9a68-6a15424a667a	{}
2b757d56-d9a7-42f7-af7e-bb80e0a2b787	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	\N	breach	KYC_REFRESH_OVERDUE	KYC refresh overdue - last verified over 12 months ago	2026-08-27 14:19:23.110845+01	2026-08-28 14:19:05.129+01	3579ddda-bee0-490a-9a68-6a15424a667a	{}
\.


--
-- Data for Name: compliance_provider_actions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.compliance_provider_actions (id, firm_id, household_id, provider_id, adviser_id, loa_template_id, loa_version, documents_sent, email_status, email_error, sent_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: currency; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.currency (id, code, name, symbol) FROM stdin;
e9feca71-ef57-41df-ab3a-7e8cd3c2211d	GBP	British Pound	£
98465946-c6a3-4f47-a265-24e2b4d660c2	EUR	Euro	€
db6efca6-3f6f-488f-91e0-47fb17487212	USD	US Dollar	$
\.


--
-- Data for Name: entity; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.entity (id, firm_id, name, entity_type, jurisdiction, registration_number, base_currency_id, household_id, is_active, created_at, updated_at) FROM stdin;
a84e17c4-16a0-4b63-b19a-1f42176675d7	524e600b-d62d-469d-b697-22ced0fbcc07	Sterling Holdings Ltd	holding_company	GB	\N	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	18889b89-2f36-4a30-aa55-d4fef82b3814	t	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01
\.


--
-- Data for Name: entity_ownership; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.entity_ownership (id, firm_id, owner_person_id, owner_entity_id, owned_entity_id, ownership_pct, ownership_class, valid_from, valid_to, structure_version_id, created_at, updated_at) FROM stdin;
d99ef9db-bce0-4f61-88ac-9207e3077201	524e600b-d62d-469d-b697-22ced0fbcc07	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	\N	a84e17c4-16a0-4b63-b19a-1f42176675d7	100.0000	ordinary_shares	2020-01-01	\N	\N	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01
\.


--
-- Data for Name: exchange_rate; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.exchange_rate (id, from_currency_id, to_currency_id, rate_date, rate, source, created_at) FROM stdin;
5a39b528-62ae-4f4f-b26d-2e51e1ee7d6f	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	98465946-c6a3-4f47-a265-24e2b4d660c2	2026-08-26	1.1700000000	seed	2026-08-26 16:26:55.770432+01
5de7e5ab-e618-4158-83b9-b302f2444b36	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	db6efca6-3f6f-488f-91e0-47fb17487212	2026-08-26	1.2700000000	seed	2026-08-26 16:26:55.770432+01
\.


--
-- Data for Name: fact_find; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fact_find (id, firm_id, household_id, status, review_purposes, personal_circumstances, income_expenditure, assets, liabilities, insurance, investment_questions, retirement_questions, risk_capacity, risk_questionnaire, risk_score, risk_category, declaration, completed_on, signed_on, created_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: firm; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.firm (id, name, base_currency_id, fca_reference, is_active, created_at, updated_at) FROM stdin;
524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Family Office	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	FCA-DEMO-001	t	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01
\.


--
-- Data for Name: fund; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund (id, firm_id, name, isin, sedol, sector, asset_class, ocf, yield_pct, risk_rating, volatility_pct, max_drawdown_pct, manager, manager_tenure_years, esg_score, currency_id, inception_date, aum, description, data_source, created_at, updated_at) FROM stdin;
c40064b5-1e60-4fd3-a626-45fce75f3330	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo UK Equity Growth	GB00WMD01MO0	WMD01MO	IA UK All Companies	equity	0.0085	1.8000	5	14.2000	22.5000	J. Alderton (Demo)	6.50	68.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2012-03-01	850000000.00	Demonstration fund tracking UK large/mid-cap growth names. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
08c25b5f-3ee5-492c-8bea-bcb6820b3bd4	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Global Equity Income	GB00WMD02MO0	WMD02MO	IA Global Equity Income	equity	0.0079	3.2000	4	11.8000	18.1000	R. Okafor (Demo)	9.20	74.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2009-11-15	1420000000.00	Demonstration global equity income fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
e865a933-3f6a-4ee5-bb87-77ddcde36442	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Sterling Corporate Bond	GB00WMD03MO0	WMD03MO	IA Sterling Corporate Bond	fixed_income	0.0045	4.6000	3	6.4000	9.2000	S. Patel (Demo)	4.10	61.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2015-06-01	610000000.00	Demonstration sterling investment-grade bond fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
93af7c0f-1688-4c66-ae9c-28b3be65aad4	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Money Market GBP	GB00WMD04MO0	WMD04MO	IA Short Term Money Market	money_market	0.0012	4.9000	1	0.4000	0.1000	T. Nguyen (Demo)	3.00	55.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2018-01-10	2100000000.00	Demonstration GBP money market fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
720ada48-e4c9-4504-9dea-20d2152d4f7c	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Mixed 40-85 Shares	GB00WMD05MO0	WMD05MO	IA Mixed Investment 40-85% Shares	mixed_asset	0.0068	2.4000	4	10.9000	16.3000	H. Fairbanks (Demo)	7.80	66.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2011-09-20	980000000.00	Demonstration multi-asset fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
a15abd9e-68b0-4942-828f-26a9b054097b	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo North America Equity	GB00WMD06MO0	WMD06MO	IA North America	equity	0.0082	1.1000	5	15.6000	24.0000	M. Delgado (Demo)	5.40	59.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2013-04-12	1750000000.00	Demonstration US/Canada equity fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
34df92fc-50e5-4daf-9dee-b6e972c76eae	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Emerging Markets Equity	GB00WMD07MO0	WMD07MO	IA Global Emerging Markets	equity	0.0095	2.6000	6	19.8000	31.4000	A. Osei (Demo)	4.90	52.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2014-02-18	540000000.00	Demonstration emerging markets equity fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
a7c82a4a-ca0a-415c-b40d-ec35a633111e	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo UK Direct Property	GB00WMD08MO0	WMD08MO	IA UK Direct Property	property	0.0110	3.8000	4	7.2000	12.8000	C. Wren (Demo)	8.60	48.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2007-05-30	720000000.00	Demonstration direct UK commercial property fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
aa3c4ba0-bc31-4f8c-8c96-68f9626fb26a	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Targeted Absolute Return	GB00WMD09MO0	WMD09MO	IA Targeted Absolute Return	alternative	0.0089	1.5000	3	5.9000	8.4000	L. Bianchi (Demo)	6.00	57.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2016-08-01	410000000.00	Demonstration absolute-return fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
93154242-2a4a-41a5-a87e-8df7a57f07d1	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Japan Equity	GB00WMD10MO0	WMD10MO	IA Japan	equity	0.0091	2.0000	5	16.4000	23.6000	K. Watanabe (Demo)	5.10	63.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2012-11-01	390000000.00	Demonstration Japan equity fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
3e827c9a-bcb1-4b78-8085-957e09ed5577	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Volatility Managed Growth	GB00WMD11MO0	WMD11MO	IA Volatility Managed	mixed_asset	0.0071	1.9000	5	12.5000	19.0000	P. Novak (Demo)	4.40	60.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2017-03-22	330000000.00	Demonstration volatility-managed multi-asset fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
1497c9ed-dced-47f0-8ff1-5d637c85851a	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Sterling Strategic Bond	GB00WMD12MO0	WMD12MO	IA Sterling Strategic Bond	fixed_income	0.0058	4.1000	3	7.1000	10.5000	E. Sandberg (Demo)	7.00	58.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2010-07-14	505000000.00	Demonstration strategic bond fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
75d0ca30-e86c-40e5-8afb-357d2bf1afae	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Global Smaller Companies	GB00WMD13MO0	WMD13MO	IA Global	equity	0.0098	0.9000	6	18.9000	29.7000	D. Marsh (Demo)	3.80	54.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2019-01-05	215000000.00	Demonstration global smaller companies fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
7d840105-1516-45dc-8ffe-843f53304e32	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo UK Gilt	GB00WMD14MO0	WMD14MO	IA UK Gilts	fixed_income	0.0035	3.9000	2	5.8000	8.9000	F. Cole (Demo)	9.90	50.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2005-10-01	880000000.00	Demonstration UK gilt fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
e34e3871-b234-4fbe-95aa-767992b47361	524e600b-d62d-469d-b697-22ced0fbcc07	WealthMatrix Demo Ethical Global Equity	GB00WMD15MO0	WMD15MO	IA Global	equity	0.0087	1.6000	4	12.9000	20.2000	N. Farrow (Demo)	5.90	88.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	2016-05-19	460000000.00	Demonstration ESG-focused global equity fund. Not a real fund.	demo_seed	2026-08-28 10:03:21.095472+01	2026-08-28 10:03:21.095472+01
\.


--
-- Data for Name: fund_allocation; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund_allocation (id, firm_id, fund_id, category, weight_pct, as_of_date, created_at) FROM stdin;
a81da955-0bbf-41a6-9ce8-57fcc93e7ab0	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	equity	96.500	2026-08-28	2026-08-28 10:05:00.830133+01
52cd8655-95f2-4b7c-b7ae-46b8f3a152f4	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	cash	3.500	2026-08-28	2026-08-28 10:05:00.901652+01
\.


--
-- Data for Name: fund_holdings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund_holdings (id, firm_id, fund_id, holding_name, holding_weight_pct, as_of_date, created_at) FROM stdin;
414894a8-1537-48b6-aed4-ce7e553c4315	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	Demo Holding 1 PLC	4.800	2026-08-28	2026-08-28 10:05:00.690793+01
a4433af4-79db-4b80-87b7-c07247122c65	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	Demo Holding 2 PLC	3.900	2026-08-28	2026-08-28 10:05:00.76203+01
\.


--
-- Data for Name: fund_performance; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund_performance (id, firm_id, fund_id, period, return_pct, as_of_date, created_at) FROM stdin;
6ffb5eda-91ef-4ca5-af12-2880b74c7c23	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	1Y	8.4000	2026-08-28	2026-08-28 10:05:00.443928+01
c0c6cca3-832c-407f-ad02-f950ce046fa4	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	3Y	24.1000	2026-08-28	2026-08-28 10:05:00.543798+01
78645f3c-458a-4c7f-894e-3635d98d9e0f	524e600b-d62d-469d-b697-22ced0fbcc07	c40064b5-1e60-4fd3-a626-45fce75f3330	YTD	5.2000	2026-08-28	2026-08-28 10:05:00.61837+01
\.


--
-- Data for Name: fund_screen; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fund_screen (id, firm_id, created_by, name, filters, created_at) FROM stdin;
\.


--
-- Data for Name: holding; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.holding (id, firm_id, account_id, asset_id, as_of_date, quantity, market_value, currency_id, source, created_at) FROM stdin;
c4da0617-f231-4aa4-9739-3c014705859d	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	29763051-6611-4f2a-8795-be3c218293ab	2026-08-26	\N	500000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-26 16:26:55.770432+01
f3a69198-abbb-4424-b5dd-c44098a1924c	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-08-26	\N	1200000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-26 16:26:55.770432+01
72f50133-5cd0-4bd1-ae89-c6c4d2fc56b6	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	fb5cad1f-b9fd-4b55-9884-a17867f91cf4	2026-08-26	1.00000000	2400000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-26 16:26:55.770432+01
71a11291-b6f3-4d05-bdc0-9c38d7cbd128	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-08-26	\N	850000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-26 16:26:55.770432+01
3a752f2f-c5f0-457f-b7a7-5d7f2d45f0bd	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-02-27	\N	700000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
c83e7b15-135f-443e-a47e-78a11737cf30	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-05-27	\N	780000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
88a52f11-56ae-49f2-969e-baee84b92aad	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-07-27	\N	820000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
bba374aa-e600-469a-906f-179189613938	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	fb5cad1f-b9fd-4b55-9884-a17867f91cf4	2026-02-27	\N	2000000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
7a853ed9-665e-496a-8958-22aa696d8a14	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	fb5cad1f-b9fd-4b55-9884-a17867f91cf4	2026-05-27	\N	2200000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
8eaa49ef-5084-42d2-9fc8-e9e783ea7698	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	fb5cad1f-b9fd-4b55-9884-a17867f91cf4	2026-07-27	\N	2350000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
b1ccec04-4818-46ab-93dc-3f7d3be51081	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-02-27	\N	900000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
9c7fdf88-116b-45f7-ac4e-f9808f4db59a	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-05-27	\N	1050000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
ec20118f-9b9a-4255-82f1-132395a76a5f	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	4d0011a6-e73e-4fb7-be97-fdffccd2448f	2026-07-27	\N	1150000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
afeb4c2a-dd9c-4dd7-9634-1452f872b780	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	29763051-6611-4f2a-8795-be3c218293ab	2026-02-27	\N	550000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
6ad53eaa-86ed-4827-b992-1c228106a907	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	29763051-6611-4f2a-8795-be3c218293ab	2026-05-27	\N	525000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
135737ef-088d-40e7-8136-d6805f7e2d9d	524e600b-d62d-469d-b697-22ced0fbcc07	ef9f2608-21cf-4bfc-bac6-f12680798af0	29763051-6611-4f2a-8795-be3c218293ab	2026-07-27	\N	510000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	seed-historical	2026-08-27 12:43:02.949748+01
2d104e3d-f4dc-4000-a7bf-66017b3fff98	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	5877c56e-d71f-402a-9945-3aee78ff2d62	2026-08-27	\N	1200000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-27 14:59:32.503908+01
e93c754d-0208-4593-924b-601e7e7d327c	524e600b-d62d-469d-b697-22ced0fbcc07	22f7ae9d-ed51-4cca-97d6-cdf3ba5717fc	277142a2-9136-4486-a5fc-c423502fe9fa	2026-08-27	\N	200000000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	manual	2026-08-27 16:01:10.888425+01
\.


--
-- Data for Name: household; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.household (id, firm_id, name, primary_adviser_id, created_at, updated_at) FROM stdin;
18889b89-2f36-4a30-aa55-d4fef82b3814	524e600b-d62d-469d-b697-22ced0fbcc07	Sterling Family	\N	2026-08-26 16:26:55.770432+01	2026-08-26 16:26:55.770432+01
262061da-d7ca-4b2f-a435-0745d97dca4a	524e600b-d62d-469d-b697-22ced0fbcc07	Whitmore Family	\N	2026-08-27 14:18:24.612194+01	2026-08-27 14:18:24.612194+01
a4f0f87d-b4c5-46c3-a471-966efeb22c50	524e600b-d62d-469d-b697-22ced0fbcc07	Scott	\N	2026-08-27 14:29:20.219931+01	2026-08-27 14:29:20.219931+01
\.


--
-- Data for Name: household_member; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.household_member (id, firm_id, household_id, person_id, relationship, created_at) FROM stdin;
756c8340-4601-4118-a03c-21e16a30f933	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	head	2026-08-26 16:26:55.770432+01
3f26ba1b-0f17-41ce-8dd9-49272a8ae4a2	524e600b-d62d-469d-b697-22ced0fbcc07	262061da-d7ca-4b2f-a435-0745d97dca4a	bba896f2-bf19-4fd9-9d45-4877506217d5	head	2026-08-27 14:18:24.87661+01
2a22def1-9650-4a8a-9be1-bd9dd2005ec8	524e600b-d62d-469d-b697-22ced0fbcc07	a4f0f87d-b4c5-46c3-a471-966efeb22c50	df10227b-e170-413e-8171-af63cc6248c2	head	2026-08-27 14:29:20.3348+01
\.


--
-- Data for Name: income; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.income (id, firm_id, person_id, income_type, description, amount, currency_id, frequency, start_date, end_date, notes, created_at, updated_at) FROM stdin;
e26fca74-82d2-4e35-aeb3-6388ef3d6c1f	524e600b-d62d-469d-b697-22ced0fbcc07	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	employment	Base salary	180000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	annual	\N	\N	\N	2026-08-27 14:57:48.436888+01	2026-08-27 14:58:34.29176+01
c15a632e-dced-496f-ab32-28ab6ce8c034	524e600b-d62d-469d-b697-22ced0fbcc07	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	employment	\N	0.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	annual	\N	\N	\N	2026-08-27 15:01:22.58049+01	2026-08-27 15:01:22.58049+01
c38ec47a-99eb-4cb2-8ceb-89e147ae7393	524e600b-d62d-469d-b697-22ced0fbcc07	ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	self_employment	\N	20000.00	e9feca71-ef57-41df-ab3a-7e8cd3c2211d	annual	2005-05-20	\N	\N	2026-08-27 15:01:53.378806+01	2026-08-27 15:01:53.378806+01
\.


--
-- Data for Name: loa_template; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loa_template (id, firm_id, name, file_name, mime_type, file_data, field_map, version, is_active, uploaded_by, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: person; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.person (id, firm_id, first_name, last_name, date_of_birth, tax_residency, domicile, is_active, created_at, updated_at, phone, email, address_line1, address_line2, city, postal_code, country, risk_tolerance, kyc_status, kyc_verified_at, source_of_wealth, ni_number) FROM stdin;
bba896f2-bf19-4fd9-9d45-4877506217d5	524e600b-d62d-469d-b697-22ced0fbcc07	Edward	Whitmore	\N	GB	GB	t	2026-08-27 14:18:24.801771+01	2026-08-27 14:18:24.801771+01	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N	\N
df10227b-e170-413e-8171-af63cc6248c2	524e600b-d62d-469d-b697-22ced0fbcc07	Mike 	Scott	\N	United Kingdom	\N	t	2026-08-27 14:29:20.284349+01	2026-08-27 14:46:14.464307+01	\N	\N	\N	\N	\N	\N	\N	\N	pending	\N	\N	\N
ef8b24d9-c2bf-44dd-b9d2-d0ea5593bc9c	524e600b-d62d-469d-b697-22ced0fbcc07	Alexandra	Sterling	\N	GB	GB	t	2026-08-26 16:26:55.770432+01	2026-08-28 13:56:46.483566+01	+44 20 7946 0958	alexandra.sterling@example.com	\N	\N	London	\N	\N	moderate	verified	\N	Sale of family business	QQ123456C
\.


--
-- Data for Name: provider; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.provider (id, firm_id, provider_name, provider_email, servicing_email, new_business_email, email_verified, required_documents, is_active, created_at, updated_at) FROM stdin;
22ced913-8afc-43ea-80c1-d0f1decab2d9	524e600b-d62d-469d-b697-22ced0fbcc07	Aviva	loa@aviva.com	servicing@aviva.com	newbusiness@aviva.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
3fe8cc4f-96b0-4305-9378-862e3e8dea94	524e600b-d62d-469d-b697-22ced0fbcc07	Royal London	loa@royallondon.com	servicing@royallondon.com	newbusiness@royallondon.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
2a871711-5771-4df7-8459-9cccbb9ccf1b	524e600b-d62d-469d-b697-22ced0fbcc07	AJ Bell	loa@ajbell.com	servicing@ajbell.com	newbusiness@ajbell.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
d5a61e79-51e8-4055-880e-d178c763e9af	524e600b-d62d-469d-b697-22ced0fbcc07	Transact	loa@transact.com	servicing@transact.com	newbusiness@transact.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
47c62856-7546-452f-afcd-678605e0bb93	524e600b-d62d-469d-b697-22ced0fbcc07	Standard Life	loa@standardlife.com	servicing@standardlife.com	newbusiness@standardlife.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
33dc0080-007c-49c3-abfc-0bbe46548e62	524e600b-d62d-469d-b697-22ced0fbcc07	Prudential	loa@prudential.com	servicing@prudential.com	newbusiness@prudential.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
000622b6-0015-46c9-9ed5-b9581df8c97d	524e600b-d62d-469d-b697-22ced0fbcc07	Canada Life	loa@canadalife.com	servicing@canadalife.com	newbusiness@canadalife.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
590d65b1-6395-4ad9-b5ea-45f0e3e2f964	524e600b-d62d-469d-b697-22ced0fbcc07	Aegon	loa@aegon.com	servicing@aegon.com	newbusiness@aegon.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
b2817f12-a96b-4d6e-ab36-e34701420dfe	524e600b-d62d-469d-b697-22ced0fbcc07	LV	loa@lv.com	servicing@lv.com	newbusiness@lv.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
083420cb-05f2-44c9-976b-ba9453ea69d7	524e600b-d62d-469d-b697-22ced0fbcc07	HSBC Life	loa@hsbclife.com	servicing@hsbclife.com	newbusiness@hsbclife.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
8a294eaf-899e-435f-a81d-06627846a4e5	524e600b-d62d-469d-b697-22ced0fbcc07	Hargreaves Lansdown	loa@hargreaveslansdown.com	servicing@hargreaveslansdown.com	newbusiness@hargreaveslansdown.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
aa3aa19d-87be-48f3-a6a7-413f9fd1b0d5	524e600b-d62d-469d-b697-22ced0fbcc07	Fidelity International	loa@fidelityinternational.com	servicing@fidelityinternational.com	newbusiness@fidelityinternational.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
e28b1d02-aff1-4391-9508-a1d48b61aa56	524e600b-d62d-469d-b697-22ced0fbcc07	Vanguard	loa@vanguard.com	servicing@vanguard.com	newbusiness@vanguard.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
1337665a-2519-4e7d-a172-4921e15065a7	524e600b-d62d-469d-b697-22ced0fbcc07	Phoenix	loa@phoenix.com	servicing@phoenix.com	newbusiness@phoenix.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
7a21591c-c0a2-44cd-9561-e664a40c2fa2	524e600b-d62d-469d-b697-22ced0fbcc07	Scottish Widows	loa@scottishwidows.com	servicing@scottishwidows.com	newbusiness@scottishwidows.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
afa033d5-d0ef-441c-9e37-995b1c85b266	524e600b-d62d-469d-b697-22ced0fbcc07	Zurich	loa@zurich.com	servicing@zurich.com	newbusiness@zurich.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
3d403753-e5fa-4d1c-aaf8-c1e5f850c76d	524e600b-d62d-469d-b697-22ced0fbcc07	Legal & General	loa@legalgeneral.com	servicing@legalgeneral.com	newbusiness@legalgeneral.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
b7c44e36-90e7-472a-bcfd-b19f8c27673a	524e600b-d62d-469d-b697-22ced0fbcc07	Old Mutual	loa@oldmutual.com	servicing@oldmutual.com	newbusiness@oldmutual.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
914f9ab1-69a8-4acb-9dc5-18045b0c5adb	524e600b-d62d-469d-b697-22ced0fbcc07	MetLife	loa@metlife.com	servicing@metlife.com	newbusiness@metlife.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
1b559f40-9793-42ce-a04c-a683fc2cb801	524e600b-d62d-469d-b697-22ced0fbcc07	Allianz	loa@allianz.com	servicing@allianz.com	newbusiness@allianz.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
098fb6c5-1ffc-4d87-97ad-7299b7c677bd	524e600b-d62d-469d-b697-22ced0fbcc07	AXA	loa@axa.com	servicing@axa.com	newbusiness@axa.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
55b60b24-2178-436a-9b0d-6d419e5bb4be	524e600b-d62d-469d-b697-22ced0fbcc07	BNP Paribas	loa@bnpparibas.com	servicing@bnpparibas.com	newbusiness@bnpparibas.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
ad56c128-dd63-4ec7-87b7-3fb431f609dd	524e600b-d62d-469d-b697-22ced0fbcc07	Schroders	loa@schroders.com	servicing@schroders.com	newbusiness@schroders.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
f679c6db-abed-4164-a89d-7f45461ed435	524e600b-d62d-469d-b697-22ced0fbcc07	JP Morgan	loa@jpmorgan.com	servicing@jpmorgan.com	newbusiness@jpmorgan.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
4c8f80b8-ac28-4609-8132-9777fe0f7fd2	524e600b-d62d-469d-b697-22ced0fbcc07	BlackRock	loa@blackrock.com	servicing@blackrock.com	newbusiness@blackrock.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
78fcdd1c-a6a4-491f-9092-43e027c29538	524e600b-d62d-469d-b697-22ced0fbcc07	HSBC Asset Management	loa@hsbcassetmanagement.com	servicing@hsbcassetmanagement.com	newbusiness@hsbcassetmanagement.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
68283d1b-0cf4-4c0e-bb04-980bd159f02b	524e600b-d62d-469d-b697-22ced0fbcc07	Baillie Gifford	loa@bailliegifford.com	servicing@bailliegifford.com	newbusiness@bailliegifford.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
bafdbfe7-d2ea-4d96-ba02-50d49f3ef93a	524e600b-d62d-469d-b697-22ced0fbcc07	M&G	loa@mg.com	servicing@mg.com	newbusiness@mg.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
c09600e5-ae40-4384-b345-f46e59a85ee3	524e600b-d62d-469d-b697-22ced0fbcc07	Rathbones	loa@rathbones.com	servicing@rathbones.com	newbusiness@rathbones.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
f1418831-1b19-4c6b-8824-5a865881b6c6	524e600b-d62d-469d-b697-22ced0fbcc07	Charles Stanley	loa@charlesstanley.com	servicing@charlesstanley.com	newbusiness@charlesstanley.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
7da8827b-3868-4fce-8569-98be24253ded	524e600b-d62d-469d-b697-22ced0fbcc07	Abrdn	loa@abrdn.com	servicing@abrdn.com	newbusiness@abrdn.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
9e28b429-df96-4c46-b2b4-95f5a2247a81	524e600b-d62d-469d-b697-22ced0fbcc07	Nutmeg	loa@nutmeg.com	servicing@nutmeg.com	newbusiness@nutmeg.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
32ab9e41-dc2b-4efc-bede-038029904a87	524e600b-d62d-469d-b697-22ced0fbcc07	Wealthify	loa@wealthify.com	servicing@wealthify.com	newbusiness@wealthify.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 11:52:53.544876+01
f99aaa0e-ab26-4e1d-a029-3b7927f8c285	524e600b-d62d-469d-b697-22ced0fbcc07	Quilter	loa@quilter.com	servicing@quilter.com	newbusiness@quilter.com	f	["LOA", "Client Fact Find", "KYC", "ID Proof", "Address Proof", "Bank Statements", "Policy Numbers (if available)"]	t	2026-08-28 11:52:53.544876+01	2026-08-28 12:13:49.986056+01
\.


--
-- Data for Name: risk_exposure; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.risk_exposure (id, firm_id, household_id, as_of_date, leverage_ratio, concentration_pct, liquidity_ratio, fx_exposure, computed_at) FROM stdin;
\.


--
-- Data for Name: scenario; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.scenario (id, firm_id, household_id, name, event_type, event_date, parameters, created_by, status, result, created_at, updated_at) FROM stdin;
cf0835f2-ca56-4b3a-8c14-920d02fab02c	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	Clever 	business_sale	2030-05-27	{"salePrice": 500000}	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	complete	{"delta": 400000, "details": {"params": {"salePrice": 500000}, "baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}, "netProceeds": 400000, "removedAttribution": 0}, "narrative": "Selling the business for 500,000 at an assumed 20% CGT rate yields net proceeds of 400,000, replacing the entity's attributed value of 0 in the household's net worth.", "baselineNetWorth": 3950000, "projectedNetWorth": 4350000}	2026-08-27 10:49:59.050416+01	2026-08-27 10:49:59.205887+01
262513ec-4f32-4123-b0d1-14c854f102dc	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	Clever 	divorce	2000-05-27	{"amount": 500000}	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	complete	{"delta": 0, "details": {"baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}, "parameters": {"amount": 500000}}, "narrative": "divorce scenarios require jurisdiction/case-specific rules (e.g. matrimonial asset division, dual-residency tax treaties, covenant-triggered re-leveraging) not yet modelled quantitatively. Baseline net worth is shown unchanged; extend EVENT_HANDLERS with a dedicated calculation for this event type.", "baselineNetWorth": 3950000, "projectedNetWorth": 3950000}	2026-08-27 10:50:50.682693+01	2026-08-27 10:50:50.755361+01
d46763d6-c635-4a74-9629-8ceca2905a73	524e600b-d62d-469d-b697-22ced0fbcc07	18889b89-2f36-4a30-aa55-d4fef82b3814	Clever	inheritance	2055-05-28	{"amount": 500000, "taxRatePct": 40}	0f91bc85-1ac0-4bb4-b49e-6c91d1f873d2	complete	{"delta": 300000, "details": {"params": {"amount": 500000, "taxRatePct": 40}, "baseline": {"asOfDate": "2026-08-27", "householdId": "18889b89-2f36-4a30-aa55-d4fef82b3814", "totalNetWorth": 3950000, "entityBreakdown": [{"entityId": "a84e17c4-16a0-4b63-b19a-1f42176675d7", "entityName": "Sterling Holdings Ltd", "attributedValue": 700000, "entityNetAssetValue": 700000, "effectiveOwnershipPct": 100}], "baseCurrencyCode": "", "personalNetWorth": 3250000, "entityAttributedNetWorth": 700000}}, "narrative": "A inheritance of 500,000 net of assumed tax adds 300,000 to household net worth.", "baselineNetWorth": 3950000, "projectedNetWorth": 4250000}	2026-08-27 13:03:48.826298+01	2026-08-27 13:03:48.932331+01
\.


--
-- Data for Name: structure_version; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.structure_version (id, firm_id, household_id, label, effective_date, approved_by, approved_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: transaction; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.transaction (id, firm_id, account_id, asset_id, transaction_type, transaction_date, quantity, amount, currency_id, description, external_ref, created_at) FROM stdin;
\.


--
-- Name: account account_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);


--
-- Name: adviser_household_assignment adviser_household_assignment_adviser_id_household_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviser_household_assignment
    ADD CONSTRAINT adviser_household_assignment_adviser_id_household_id_key UNIQUE (adviser_id, household_id);


--
-- Name: adviser_household_assignment adviser_household_assignment_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviser_household_assignment
    ADD CONSTRAINT adviser_household_assignment_pkey PRIMARY KEY (id);


--
-- Name: app_user app_user_firm_id_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_firm_id_email_key UNIQUE (firm_id, email);


--
-- Name: app_user app_user_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_pkey PRIMARY KEY (id);


--
-- Name: asset asset_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: client_document client_document_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_document
    ADD CONSTRAINT client_document_pkey PRIMARY KEY (id);


--
-- Name: client_note client_note_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_note
    ADD CONSTRAINT client_note_pkey PRIMARY KEY (id);


--
-- Name: compliance_log compliance_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_log
    ADD CONSTRAINT compliance_log_pkey PRIMARY KEY (id);


--
-- Name: compliance_provider_actions compliance_provider_actions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_pkey PRIMARY KEY (id);


--
-- Name: currency currency_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency
    ADD CONSTRAINT currency_code_key UNIQUE (code);


--
-- Name: currency currency_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.currency
    ADD CONSTRAINT currency_pkey PRIMARY KEY (id);


--
-- Name: entity_ownership entity_ownership_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT entity_ownership_pkey PRIMARY KEY (id);


--
-- Name: entity entity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_pkey PRIMARY KEY (id);


--
-- Name: exchange_rate exchange_rate_from_currency_id_to_currency_id_rate_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_from_currency_id_to_currency_id_rate_date_key UNIQUE (from_currency_id, to_currency_id, rate_date);


--
-- Name: exchange_rate exchange_rate_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_pkey PRIMARY KEY (id);


--
-- Name: fact_find fact_find_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_find
    ADD CONSTRAINT fact_find_pkey PRIMARY KEY (id);


--
-- Name: firm firm_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm
    ADD CONSTRAINT firm_pkey PRIMARY KEY (id);


--
-- Name: fund_allocation fund_allocation_fund_id_category_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_allocation
    ADD CONSTRAINT fund_allocation_fund_id_category_as_of_date_key UNIQUE (fund_id, category, as_of_date);


--
-- Name: fund_allocation fund_allocation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_allocation
    ADD CONSTRAINT fund_allocation_pkey PRIMARY KEY (id);


--
-- Name: fund fund_firm_id_isin_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund
    ADD CONSTRAINT fund_firm_id_isin_key UNIQUE (firm_id, isin);


--
-- Name: fund_holdings fund_holdings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_holdings
    ADD CONSTRAINT fund_holdings_pkey PRIMARY KEY (id);


--
-- Name: fund_performance fund_performance_fund_id_period_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_performance
    ADD CONSTRAINT fund_performance_fund_id_period_as_of_date_key UNIQUE (fund_id, period, as_of_date);


--
-- Name: fund_performance fund_performance_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_performance
    ADD CONSTRAINT fund_performance_pkey PRIMARY KEY (id);


--
-- Name: fund fund_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund
    ADD CONSTRAINT fund_pkey PRIMARY KEY (id);


--
-- Name: fund_screen fund_screen_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_screen
    ADD CONSTRAINT fund_screen_pkey PRIMARY KEY (id);


--
-- Name: holding holding_account_id_asset_id_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_account_id_asset_id_as_of_date_key UNIQUE (account_id, asset_id, as_of_date);


--
-- Name: holding holding_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_pkey PRIMARY KEY (id);


--
-- Name: household_member household_member_household_id_person_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_member
    ADD CONSTRAINT household_member_household_id_person_id_key UNIQUE (household_id, person_id);


--
-- Name: household_member household_member_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_member
    ADD CONSTRAINT household_member_pkey PRIMARY KEY (id);


--
-- Name: household household_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household
    ADD CONSTRAINT household_pkey PRIMARY KEY (id);


--
-- Name: income income_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_pkey PRIMARY KEY (id);


--
-- Name: loa_template loa_template_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_template
    ADD CONSTRAINT loa_template_pkey PRIMARY KEY (id);


--
-- Name: person person_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_pkey PRIMARY KEY (id);


--
-- Name: provider provider_firm_id_provider_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_firm_id_provider_name_key UNIQUE (firm_id, provider_name);


--
-- Name: provider provider_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_pkey PRIMARY KEY (id);


--
-- Name: risk_exposure risk_exposure_household_id_as_of_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_exposure
    ADD CONSTRAINT risk_exposure_household_id_as_of_date_key UNIQUE (household_id, as_of_date);


--
-- Name: risk_exposure risk_exposure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_exposure
    ADD CONSTRAINT risk_exposure_pkey PRIMARY KEY (id);


--
-- Name: scenario scenario_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_pkey PRIMARY KEY (id);


--
-- Name: structure_version structure_version_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_version
    ADD CONSTRAINT structure_version_pkey PRIMARY KEY (id);


--
-- Name: transaction transaction_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_pkey PRIMARY KEY (id);


--
-- Name: idx_account_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_firm ON public.account USING btree (firm_id);


--
-- Name: idx_account_owner_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_owner_entity ON public.account USING btree (owner_entity_id) WHERE (owner_entity_id IS NOT NULL);


--
-- Name: idx_account_owner_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_account_owner_person ON public.account USING btree (owner_person_id) WHERE (owner_person_id IS NOT NULL);


--
-- Name: idx_asset_class; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_class ON public.asset USING btree (asset_class);


--
-- Name: idx_asset_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_asset_firm ON public.asset USING btree (firm_id);


--
-- Name: idx_audit_log_firm_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_firm_date ON public.audit_log USING btree (firm_id, changed_at DESC);


--
-- Name: idx_audit_log_table_row; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_log_table_row ON public.audit_log USING btree (table_name, row_id, changed_at DESC);


--
-- Name: idx_client_document_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_firm ON public.client_document USING btree (firm_id);


--
-- Name: idx_client_document_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_household ON public.client_document USING btree (household_id);


--
-- Name: idx_client_document_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_document_type ON public.client_document USING btree (document_type);


--
-- Name: idx_client_note_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_client_note_household ON public.client_note USING btree (household_id, created_at DESC);


--
-- Name: idx_compliance_log_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_log_household ON public.compliance_log USING btree (household_id, detected_at DESC);


--
-- Name: idx_compliance_log_unresolved; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_log_unresolved ON public.compliance_log USING btree (firm_id) WHERE (resolved_at IS NULL);


--
-- Name: idx_compliance_provider_actions_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_provider_actions_firm ON public.compliance_provider_actions USING btree (firm_id);


--
-- Name: idx_compliance_provider_actions_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_provider_actions_household ON public.compliance_provider_actions USING btree (household_id);


--
-- Name: idx_compliance_provider_actions_provider; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_compliance_provider_actions_provider ON public.compliance_provider_actions USING btree (provider_id);


--
-- Name: idx_entity_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_firm ON public.entity USING btree (firm_id);


--
-- Name: idx_entity_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entity_household ON public.entity USING btree (household_id);


--
-- Name: idx_exchange_rate_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_exchange_rate_lookup ON public.exchange_rate USING btree (from_currency_id, to_currency_id, rate_date DESC);


--
-- Name: idx_fact_find_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_find_firm ON public.fact_find USING btree (firm_id);


--
-- Name: idx_fact_find_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fact_find_household ON public.fact_find USING btree (household_id);


--
-- Name: idx_fund_allocation_fund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_allocation_fund ON public.fund_allocation USING btree (fund_id, as_of_date DESC);


--
-- Name: idx_fund_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_firm ON public.fund USING btree (firm_id);


--
-- Name: idx_fund_holdings_fund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_holdings_fund ON public.fund_holdings USING btree (fund_id, as_of_date DESC);


--
-- Name: idx_fund_isin; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_isin ON public.fund USING btree (isin);


--
-- Name: idx_fund_performance_fund; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_performance_fund ON public.fund_performance USING btree (fund_id);


--
-- Name: idx_fund_risk_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_risk_rating ON public.fund USING btree (risk_rating);


--
-- Name: idx_fund_screen_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_screen_firm ON public.fund_screen USING btree (firm_id);


--
-- Name: idx_fund_sector; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fund_sector ON public.fund USING btree (sector);


--
-- Name: idx_holding_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holding_account_date ON public.holding USING btree (account_id, as_of_date DESC);


--
-- Name: idx_holding_asset_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_holding_asset_date ON public.holding USING btree (asset_id, as_of_date DESC);


--
-- Name: idx_household_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_household_firm ON public.household USING btree (firm_id);


--
-- Name: idx_household_member_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_household_member_household ON public.household_member USING btree (household_id);


--
-- Name: idx_household_member_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_household_member_person ON public.household_member USING btree (person_id);


--
-- Name: idx_income_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_income_firm ON public.income USING btree (firm_id);


--
-- Name: idx_income_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_income_person ON public.income USING btree (person_id);


--
-- Name: idx_loa_template_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_loa_template_firm ON public.loa_template USING btree (firm_id);


--
-- Name: idx_ownership_owned; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_owned ON public.entity_ownership USING btree (owned_entity_id, valid_from, valid_to);


--
-- Name: idx_ownership_owner_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_owner_entity ON public.entity_ownership USING btree (owner_entity_id) WHERE (owner_entity_id IS NOT NULL);


--
-- Name: idx_ownership_owner_person; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_owner_person ON public.entity_ownership USING btree (owner_person_id) WHERE (owner_person_id IS NOT NULL);


--
-- Name: idx_ownership_valid_range; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ownership_valid_range ON public.entity_ownership USING gist (owned_entity_id, valid_range);


--
-- Name: idx_person_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_person_firm ON public.person USING btree (firm_id);


--
-- Name: idx_provider_firm; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_provider_firm ON public.provider USING btree (firm_id);


--
-- Name: idx_risk_exposure_household_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_risk_exposure_household_date ON public.risk_exposure USING btree (household_id, as_of_date DESC);


--
-- Name: idx_scenario_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_scenario_household ON public.scenario USING btree (household_id);


--
-- Name: idx_structure_version_household; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_structure_version_household ON public.structure_version USING btree (household_id, effective_date DESC);


--
-- Name: idx_transaction_account_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_transaction_account_date ON public.transaction USING btree (account_id, transaction_date DESC);


--
-- Name: uq_transaction_external_ref; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_transaction_external_ref ON public.transaction USING btree (account_id, external_ref) WHERE (external_ref IS NOT NULL);


--
-- Name: account trg_audit_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_account AFTER INSERT OR DELETE OR UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: asset trg_audit_asset; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_asset AFTER INSERT OR DELETE OR UPDATE ON public.asset FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: client_document trg_audit_client_document; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_client_document AFTER INSERT OR DELETE OR UPDATE ON public.client_document FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: client_note trg_audit_client_note; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_client_note AFTER INSERT OR DELETE OR UPDATE ON public.client_note FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: compliance_log trg_audit_compliance_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_compliance_log AFTER INSERT OR DELETE OR UPDATE ON public.compliance_log FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: compliance_provider_actions trg_audit_compliance_provider_actions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_compliance_provider_actions AFTER INSERT OR DELETE OR UPDATE ON public.compliance_provider_actions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: entity trg_audit_entity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_entity AFTER INSERT OR DELETE OR UPDATE ON public.entity FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: entity_ownership trg_audit_entity_ownership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_entity_ownership AFTER INSERT OR DELETE OR UPDATE ON public.entity_ownership FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: fact_find trg_audit_fact_find; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fact_find AFTER INSERT OR DELETE OR UPDATE ON public.fact_find FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: fund trg_audit_fund; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fund AFTER INSERT OR DELETE OR UPDATE ON public.fund FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: fund_allocation trg_audit_fund_allocation; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fund_allocation AFTER INSERT OR DELETE OR UPDATE ON public.fund_allocation FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: fund_holdings trg_audit_fund_holdings; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fund_holdings AFTER INSERT OR DELETE OR UPDATE ON public.fund_holdings FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: fund_performance trg_audit_fund_performance; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_fund_performance AFTER INSERT OR DELETE OR UPDATE ON public.fund_performance FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: holding trg_audit_holding; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_holding AFTER INSERT OR DELETE OR UPDATE ON public.holding FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: household trg_audit_household; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_household AFTER INSERT OR DELETE OR UPDATE ON public.household FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: household_member trg_audit_household_member; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_household_member AFTER INSERT OR DELETE OR UPDATE ON public.household_member FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: income trg_audit_income; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_income AFTER INSERT OR DELETE OR UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: loa_template trg_audit_loa_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_loa_template AFTER INSERT OR DELETE OR UPDATE ON public.loa_template FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: person trg_audit_person; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_person AFTER INSERT OR DELETE OR UPDATE ON public.person FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: provider trg_audit_provider; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_provider AFTER INSERT OR DELETE OR UPDATE ON public.provider FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: risk_exposure trg_audit_risk_exposure; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_risk_exposure AFTER INSERT OR DELETE OR UPDATE ON public.risk_exposure FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: scenario trg_audit_scenario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_scenario AFTER INSERT OR DELETE OR UPDATE ON public.scenario FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: structure_version trg_audit_structure_version; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_structure_version AFTER INSERT OR DELETE OR UPDATE ON public.structure_version FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: transaction trg_audit_transaction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_transaction AFTER INSERT OR DELETE OR UPDATE ON public.transaction FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();


--
-- Name: account trg_updated_at_account; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_account BEFORE UPDATE ON public.account FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: app_user trg_updated_at_app_user; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_app_user BEFORE UPDATE ON public.app_user FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: asset trg_updated_at_asset; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_asset BEFORE UPDATE ON public.asset FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: compliance_provider_actions trg_updated_at_compliance_provider_actions; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_compliance_provider_actions BEFORE UPDATE ON public.compliance_provider_actions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entity trg_updated_at_entity; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_entity BEFORE UPDATE ON public.entity FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entity_ownership trg_updated_at_entity_ownership; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_entity_ownership BEFORE UPDATE ON public.entity_ownership FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: fact_find trg_updated_at_fact_find; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_fact_find BEFORE UPDATE ON public.fact_find FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: firm trg_updated_at_firm; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_firm BEFORE UPDATE ON public.firm FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: fund trg_updated_at_fund; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_fund BEFORE UPDATE ON public.fund FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: household trg_updated_at_household; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_household BEFORE UPDATE ON public.household FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: income trg_updated_at_income; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_income BEFORE UPDATE ON public.income FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: loa_template trg_updated_at_loa_template; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_loa_template BEFORE UPDATE ON public.loa_template FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: person trg_updated_at_person; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_person BEFORE UPDATE ON public.person FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: provider trg_updated_at_provider; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_provider BEFORE UPDATE ON public.provider FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: scenario trg_updated_at_scenario; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_updated_at_scenario BEFORE UPDATE ON public.scenario FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: account account_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: account account_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: account account_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_owner_entity_id_fkey FOREIGN KEY (owner_entity_id) REFERENCES public.entity(id);


--
-- Name: account account_owner_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account
    ADD CONSTRAINT account_owner_person_id_fkey FOREIGN KEY (owner_person_id) REFERENCES public.person(id);


--
-- Name: adviser_household_assignment adviser_household_assignment_adviser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviser_household_assignment
    ADD CONSTRAINT adviser_household_assignment_adviser_id_fkey FOREIGN KEY (adviser_id) REFERENCES public.app_user(id) ON DELETE CASCADE;


--
-- Name: adviser_household_assignment adviser_household_assignment_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviser_household_assignment
    ADD CONSTRAINT adviser_household_assignment_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: app_user app_user_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT app_user_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: asset asset_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: asset asset_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.asset
    ADD CONSTRAINT asset_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: audit_log audit_log_changed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES public.app_user(id);


--
-- Name: client_document client_document_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_document
    ADD CONSTRAINT client_document_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: client_document client_document_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_document
    ADD CONSTRAINT client_document_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: client_document client_document_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_document
    ADD CONSTRAINT client_document_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- Name: client_note client_note_author_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_note
    ADD CONSTRAINT client_note_author_id_fkey FOREIGN KEY (author_id) REFERENCES public.app_user(id);


--
-- Name: client_note client_note_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_note
    ADD CONSTRAINT client_note_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: client_note client_note_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.client_note
    ADD CONSTRAINT client_note_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: compliance_log compliance_log_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_log
    ADD CONSTRAINT compliance_log_entity_id_fkey FOREIGN KEY (entity_id) REFERENCES public.entity(id);


--
-- Name: compliance_log compliance_log_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_log
    ADD CONSTRAINT compliance_log_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: compliance_log compliance_log_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_log
    ADD CONSTRAINT compliance_log_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id);


--
-- Name: compliance_log compliance_log_resolved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_log
    ADD CONSTRAINT compliance_log_resolved_by_fkey FOREIGN KEY (resolved_by) REFERENCES public.app_user(id);


--
-- Name: compliance_provider_actions compliance_provider_actions_adviser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_adviser_id_fkey FOREIGN KEY (adviser_id) REFERENCES public.app_user(id);


--
-- Name: compliance_provider_actions compliance_provider_actions_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: compliance_provider_actions compliance_provider_actions_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: compliance_provider_actions compliance_provider_actions_loa_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_loa_template_id_fkey FOREIGN KEY (loa_template_id) REFERENCES public.loa_template(id);


--
-- Name: compliance_provider_actions compliance_provider_actions_provider_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compliance_provider_actions
    ADD CONSTRAINT compliance_provider_actions_provider_id_fkey FOREIGN KEY (provider_id) REFERENCES public.provider(id);


--
-- Name: entity entity_base_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_base_currency_id_fkey FOREIGN KEY (base_currency_id) REFERENCES public.currency(id);


--
-- Name: entity entity_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: entity entity_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity
    ADD CONSTRAINT entity_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id);


--
-- Name: entity_ownership entity_ownership_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT entity_ownership_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: entity_ownership entity_ownership_owned_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT entity_ownership_owned_entity_id_fkey FOREIGN KEY (owned_entity_id) REFERENCES public.entity(id);


--
-- Name: entity_ownership entity_ownership_owner_entity_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT entity_ownership_owner_entity_id_fkey FOREIGN KEY (owner_entity_id) REFERENCES public.entity(id);


--
-- Name: entity_ownership entity_ownership_owner_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT entity_ownership_owner_person_id_fkey FOREIGN KEY (owner_person_id) REFERENCES public.person(id);


--
-- Name: exchange_rate exchange_rate_from_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_from_currency_id_fkey FOREIGN KEY (from_currency_id) REFERENCES public.currency(id);


--
-- Name: exchange_rate exchange_rate_to_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.exchange_rate
    ADD CONSTRAINT exchange_rate_to_currency_id_fkey FOREIGN KEY (to_currency_id) REFERENCES public.currency(id);


--
-- Name: fact_find fact_find_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_find
    ADD CONSTRAINT fact_find_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: fact_find fact_find_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_find
    ADD CONSTRAINT fact_find_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: fact_find fact_find_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fact_find
    ADD CONSTRAINT fact_find_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: adviser_household_assignment fk_aha_household; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adviser_household_assignment
    ADD CONSTRAINT fk_aha_household FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: app_user fk_app_user_person; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_user
    ADD CONSTRAINT fk_app_user_person FOREIGN KEY (person_id) REFERENCES public.person(id);


--
-- Name: firm fk_firm_base_currency; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.firm
    ADD CONSTRAINT fk_firm_base_currency FOREIGN KEY (base_currency_id) REFERENCES public.currency(id);


--
-- Name: entity_ownership fk_ownership_structure_version; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entity_ownership
    ADD CONSTRAINT fk_ownership_structure_version FOREIGN KEY (structure_version_id) REFERENCES public.structure_version(id);


--
-- Name: fund_allocation fund_allocation_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_allocation
    ADD CONSTRAINT fund_allocation_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: fund_allocation fund_allocation_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_allocation
    ADD CONSTRAINT fund_allocation_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.fund(id) ON DELETE CASCADE;


--
-- Name: fund fund_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund
    ADD CONSTRAINT fund_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: fund fund_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund
    ADD CONSTRAINT fund_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: fund_holdings fund_holdings_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_holdings
    ADD CONSTRAINT fund_holdings_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: fund_holdings fund_holdings_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_holdings
    ADD CONSTRAINT fund_holdings_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.fund(id) ON DELETE CASCADE;


--
-- Name: fund_performance fund_performance_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_performance
    ADD CONSTRAINT fund_performance_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: fund_performance fund_performance_fund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_performance
    ADD CONSTRAINT fund_performance_fund_id_fkey FOREIGN KEY (fund_id) REFERENCES public.fund(id) ON DELETE CASCADE;


--
-- Name: fund_screen fund_screen_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_screen
    ADD CONSTRAINT fund_screen_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: fund_screen fund_screen_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fund_screen
    ADD CONSTRAINT fund_screen_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: holding holding_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: holding holding_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id);


--
-- Name: holding holding_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: holding holding_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.holding
    ADD CONSTRAINT holding_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: household household_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household
    ADD CONSTRAINT household_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: household_member household_member_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_member
    ADD CONSTRAINT household_member_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: household_member household_member_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_member
    ADD CONSTRAINT household_member_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: household_member household_member_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household_member
    ADD CONSTRAINT household_member_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: household household_primary_adviser_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.household
    ADD CONSTRAINT household_primary_adviser_id_fkey FOREIGN KEY (primary_adviser_id) REFERENCES public.app_user(id);


--
-- Name: income income_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: income income_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: income income_person_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.income
    ADD CONSTRAINT income_person_id_fkey FOREIGN KEY (person_id) REFERENCES public.person(id) ON DELETE CASCADE;


--
-- Name: loa_template loa_template_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_template
    ADD CONSTRAINT loa_template_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: loa_template loa_template_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loa_template
    ADD CONSTRAINT loa_template_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES public.app_user(id);


--
-- Name: person person_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.person
    ADD CONSTRAINT person_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: provider provider_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.provider
    ADD CONSTRAINT provider_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: risk_exposure risk_exposure_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_exposure
    ADD CONSTRAINT risk_exposure_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: risk_exposure risk_exposure_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_exposure
    ADD CONSTRAINT risk_exposure_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.app_user(id);


--
-- Name: scenario scenario_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: scenario scenario_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scenario
    ADD CONSTRAINT scenario_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: structure_version structure_version_approved_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_version
    ADD CONSTRAINT structure_version_approved_by_fkey FOREIGN KEY (approved_by) REFERENCES public.app_user(id);


--
-- Name: structure_version structure_version_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_version
    ADD CONSTRAINT structure_version_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: structure_version structure_version_household_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.structure_version
    ADD CONSTRAINT structure_version_household_id_fkey FOREIGN KEY (household_id) REFERENCES public.household(id) ON DELETE CASCADE;


--
-- Name: transaction transaction_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.account(id) ON DELETE CASCADE;


--
-- Name: transaction transaction_asset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_asset_id_fkey FOREIGN KEY (asset_id) REFERENCES public.asset(id);


--
-- Name: transaction transaction_currency_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_currency_id_fkey FOREIGN KEY (currency_id) REFERENCES public.currency(id);


--
-- Name: transaction transaction_firm_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.transaction
    ADD CONSTRAINT transaction_firm_id_fkey FOREIGN KEY (firm_id) REFERENCES public.firm(id) ON DELETE CASCADE;


--
-- Name: account; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.account ENABLE ROW LEVEL SECURITY;

--
-- Name: adviser_household_assignment; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.adviser_household_assignment ENABLE ROW LEVEL SECURITY;

--
-- Name: app_user; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

--
-- Name: asset; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.asset ENABLE ROW LEVEL SECURITY;

--
-- Name: audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: client_document; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_document ENABLE ROW LEVEL SECURITY;

--
-- Name: client_note; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.client_note ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_log ENABLE ROW LEVEL SECURITY;

--
-- Name: compliance_provider_actions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.compliance_provider_actions ENABLE ROW LEVEL SECURITY;

--
-- Name: entity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity ENABLE ROW LEVEL SECURITY;

--
-- Name: entity_ownership; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.entity_ownership ENABLE ROW LEVEL SECURITY;

--
-- Name: fact_find; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fact_find ENABLE ROW LEVEL SECURITY;

--
-- Name: fund; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_allocation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_allocation ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_holdings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_holdings ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_performance; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_performance ENABLE ROW LEVEL SECURITY;

--
-- Name: fund_screen; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fund_screen ENABLE ROW LEVEL SECURITY;

--
-- Name: holding; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.holding ENABLE ROW LEVEL SECURITY;

--
-- Name: household; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.household ENABLE ROW LEVEL SECURITY;

--
-- Name: household_member; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.household_member ENABLE ROW LEVEL SECURITY;

--
-- Name: income; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

--
-- Name: loa_template; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.loa_template ENABLE ROW LEVEL SECURITY;

--
-- Name: person; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.person ENABLE ROW LEVEL SECURITY;

--
-- Name: provider; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.provider ENABLE ROW LEVEL SECURITY;

--
-- Name: risk_exposure; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.risk_exposure ENABLE ROW LEVEL SECURITY;

--
-- Name: scenario; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scenario ENABLE ROW LEVEL SECURITY;

--
-- Name: structure_version; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.structure_version ENABLE ROW LEVEL SECURITY;

--
-- Name: account tenant_isolation_account; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_account ON public.account USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: adviser_household_assignment tenant_isolation_adviser_household_assignment; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_adviser_household_assignment ON public.adviser_household_assignment USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: app_user tenant_isolation_app_user; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_app_user ON public.app_user USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: asset tenant_isolation_asset; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_asset ON public.asset USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: audit_log tenant_isolation_audit_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_audit_log ON public.audit_log USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: client_document tenant_isolation_client_document; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_client_document ON public.client_document USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: client_note tenant_isolation_client_note; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_client_note ON public.client_note USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: compliance_log tenant_isolation_compliance_log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_compliance_log ON public.compliance_log USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: compliance_provider_actions tenant_isolation_compliance_provider_actions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_compliance_provider_actions ON public.compliance_provider_actions USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: entity tenant_isolation_entity; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_entity ON public.entity USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: entity_ownership tenant_isolation_entity_ownership; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_entity_ownership ON public.entity_ownership USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fact_find tenant_isolation_fact_find; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fact_find ON public.fact_find USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fund tenant_isolation_fund; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fund ON public.fund USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fund_allocation tenant_isolation_fund_allocation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fund_allocation ON public.fund_allocation USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fund_holdings tenant_isolation_fund_holdings; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fund_holdings ON public.fund_holdings USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fund_performance tenant_isolation_fund_performance; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fund_performance ON public.fund_performance USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: fund_screen tenant_isolation_fund_screen; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_fund_screen ON public.fund_screen USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: holding tenant_isolation_holding; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_holding ON public.holding USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: household tenant_isolation_household; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_household ON public.household USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: household_member tenant_isolation_household_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_household_member ON public.household_member USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: income tenant_isolation_income; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_income ON public.income USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: loa_template tenant_isolation_loa_template; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_loa_template ON public.loa_template USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: person tenant_isolation_person; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_person ON public.person USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: provider tenant_isolation_provider; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_provider ON public.provider USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: risk_exposure tenant_isolation_risk_exposure; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_risk_exposure ON public.risk_exposure USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: scenario tenant_isolation_scenario; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_scenario ON public.scenario USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: structure_version tenant_isolation_structure_version; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_structure_version ON public.structure_version USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: transaction tenant_isolation_transaction; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tenant_isolation_transaction ON public.transaction USING ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid)) WITH CHECK ((firm_id = (NULLIF(current_setting('app.current_firm_id'::text, true), ''::text))::uuid));


--
-- Name: transaction; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.transaction ENABLE ROW LEVEL SECURITY;

--
-- PostgreSQL database dump complete
--

\unrestrict 7OwUqtcg9f8XkdTFN17C2OtWfavx1uhU1DvomBVsm3uJW49JYQmC5bQFBcseVSo

