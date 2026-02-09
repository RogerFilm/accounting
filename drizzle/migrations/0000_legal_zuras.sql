CREATE TABLE "companies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"invoice_registration_number" text,
	"fiscal_year_end_month" integer DEFAULT 3 NOT NULL,
	"tax_method" text DEFAULT 'standard' NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fiscal_years" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"parent_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_categories" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"rate" integer NOT NULL,
	"type" text NOT NULL,
	"is_reduced" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "tax_categories_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"fiscal_year_id" text NOT NULL,
	"date" text NOT NULL,
	"description" text,
	"client_name" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_entry_id" text NOT NULL,
	"side" text NOT NULL,
	"account_id" text NOT NULL,
	"amount" integer NOT NULL,
	"tax_category_id" text,
	"tax_amount" integer DEFAULT 0,
	"description" text,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"hashed_password" text NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT 'accountant' NOT NULL,
	"company_id" text NOT NULL,
	"created_at" text NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "clients" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"name_kana" text,
	"postal_code" text,
	"address" text,
	"phone" text,
	"email" text,
	"contact_person" text,
	"invoice_registration_number" text,
	"notes" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"unit_price" integer NOT NULL,
	"tax_rate" integer DEFAULT 10 NOT NULL,
	"is_reduced_tax" boolean DEFAULT false NOT NULL,
	"amount" integer NOT NULL,
	"tax_amount" integer NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"document_type" text NOT NULL,
	"document_number" text NOT NULL,
	"client_id" text NOT NULL,
	"issue_date" text NOT NULL,
	"due_date" text,
	"subject" text,
	"notes" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"subtotal" integer DEFAULT 0 NOT NULL,
	"tax_amount" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"journal_entry_id" text,
	"virtual_account_id" text,
	"source_document_id" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "numbering_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"document_type" text NOT NULL,
	"prefix" text NOT NULL,
	"next_number" integer DEFAULT 1 NOT NULL,
	"digit_count" integer DEFAULT 4 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_import_history" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"hash" text NOT NULL,
	"journal_entry_id" text NOT NULL,
	"imported_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_import_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"pattern" text NOT NULL,
	"account_id" text NOT NULL,
	"tax_category_id" text,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"file_name" text NOT NULL,
	"file_path" text NOT NULL,
	"file_size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"ocr_text" text,
	"ocr_confidence" real,
	"ocr_provider" text,
	"store_name" text,
	"date" text,
	"total_amount" integer,
	"tax_amount" integer,
	"items" text,
	"suggested_account_id" text,
	"suggested_tax_category_id" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"journal_entry_id" text,
	"created_by" text NOT NULL,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"acquisition_date" text NOT NULL,
	"acquisition_cost" integer NOT NULL,
	"useful_life" integer NOT NULL,
	"depreciation_method" text NOT NULL,
	"residual_value" integer DEFAULT 1 NOT NULL,
	"account_id" text NOT NULL,
	"depreciation_account_id" text NOT NULL,
	"disposal_date" text,
	"memo" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "virtual_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"company_id" text NOT NULL,
	"va_number" text NOT NULL,
	"va_account_name" text,
	"va_type" text NOT NULL,
	"invoice_id" text,
	"client_id" text,
	"status" text DEFAULT 'active' NOT NULL,
	"expiry_date" text,
	"va_id" text,
	"va_contract_auth_key" text,
	"gmo_raw_response" text,
	"created_at" text NOT NULL,
	"updated_at" text NOT NULL
);
