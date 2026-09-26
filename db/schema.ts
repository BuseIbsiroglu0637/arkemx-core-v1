import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customerProfiles = sqliteTable("customer_profiles", {
  email: text("email").primaryKey(),
  displayName: text("display_name").notNull(),
  company: text("company").notNull().default(""),
  phone: text("phone").notNull().default(""),
  preferredLanguage: text("preferred_language").notNull().default("tr"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const customerProjects = sqliteTable("customer_projects", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  name: text("name").notNull(),
  phase: text("phase").notNull().default("Başlangıç"),
  revision: text("revision").notNull().default("R00"),
  status: text("status").notNull().default("Taslak"),
  payload: text("payload").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [
  index("customer_projects_owner_idx").on(table.ownerEmail),
  uniqueIndex("customer_projects_owner_id_idx").on(table.ownerEmail, table.id),
]);

export const customerMeetings = sqliteTable("customer_meetings", {
  id: text("id").primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  projectId: text("project_id").notNull().default(""),
  subject: text("subject").notNull(),
  meetingAt: text("meeting_at").notNull(),
  channel: text("channel").notNull().default("Teknik görüşme"),
  status: text("status").notNull().default("Planlandı"),
  notes: text("notes").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("customer_meetings_owner_idx").on(table.ownerEmail)]);

export const customerActivities = sqliteTable("customer_activities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  ownerEmail: text("owner_email").notNull(),
  eventType: text("event_type").notNull(),
  title: text("title").notNull(),
  detail: text("detail").notNull().default(""),
  createdAt: text("created_at").notNull(),
}, (table) => [index("customer_activities_owner_idx").on(table.ownerEmail)]);

export const projectEvidenceItems = sqliteTable("project_evidence_items", {
  id: text("id").primaryKey(),
  projectSlug: text("project_slug").notNull(),
  targetType: text("target_type").notNull(),
  targetKey: text("target_key").notNull(),
  claimValue: text("claim_value").notNull().default(""),
  sourceLabel: text("source_label").notNull(),
  internalNote: text("internal_note").notNull().default(""),
  status: text("status").notNull().default("received"),
  fileKey: text("file_key"),
  fileName: text("file_name"),
  contentType: text("content_type"),
  fileSize: integer("file_size"),
  fileSha256: text("file_sha256"),
  createdBy: text("created_by").notNull(),
  reviewedBy: text("reviewed_by"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
  reviewedAt: text("reviewed_at"),
  publishedAt: text("published_at"),
  transitionToken: text("transition_token").notNull().default(""),
}, (table) => [
  index("project_evidence_project_idx").on(table.projectSlug),
  index("project_evidence_status_idx").on(table.status),
  index("project_evidence_project_target_idx").on(table.projectSlug, table.targetType, table.targetKey),
  uniqueIndex("project_evidence_single_published_idx")
    .on(table.projectSlug, table.targetType, table.targetKey)
    .where(sql`${table.status} = 'published' AND ${table.targetType} IN ('fact', 'stage', 'capability')`),
]);

export const projectEvidenceEvents = sqliteTable("project_evidence_events", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  evidenceId: text("evidence_id").notNull(),
  actorEmail: text("actor_email").notNull(),
  fromStatus: text("from_status").notNull().default(""),
  toStatus: text("to_status").notNull(),
  note: text("note").notNull().default(""),
  createdAt: text("created_at").notNull(),
  transitionToken: text("transition_token").notNull().default(""),
}, (table) => [
  index("project_evidence_events_item_idx").on(table.evidenceId),
  uniqueIndex("project_evidence_events_transition_idx").on(table.transitionToken),
]);

export const projectIntakes = sqliteTable("project_intakes", {
  id: text("id").primaryKey(),
  referenceCode: text("reference_code").notNull(),
  name: text("name").notNull(),
  company: text("company").notNull().default(""),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  location: text("location").notNull(),
  buildingType: text("building_type").notNull(),
  area: text("area").notNull().default(""),
  stage: text("stage").notNull(),
  requestType: text("request_type").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("received"),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("project_intakes_reference_idx").on(table.referenceCode),
  index("project_intakes_created_idx").on(table.createdAt),
  index("project_intakes_status_idx").on(table.status),
]);

export const projectIntakeFiles = sqliteTable("project_intake_files", {
  id: text("id").primaryKey(),
  intakeId: text("intake_id").notNull(),
  objectKey: text("object_key").notNull(),
  fileName: text("file_name").notNull(),
  contentType: text("content_type").notNull(),
  fileSize: integer("file_size").notNull(),
  fileSha256: text("file_sha256").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [
  uniqueIndex("project_intake_files_object_idx").on(table.objectKey),
  index("project_intake_files_intake_idx").on(table.intakeId),
]);
