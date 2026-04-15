// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - PostgreSQL Database Schema (Drizzle ORM)
// Combines WIJA 3 multitenant model + WIJA-OGI GEDCOM fields
// ═══════════════════════════════════════════════════════════════════════════════

import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    boolean,
    integer,
    real,
    jsonb,
    uniqueIndex,
    index,
} from 'drizzle-orm/pg-core';

// ─────────────────────────────────────────────────────────────────────────────────
// USERS & AUTH (NextAuth.js compatible)
// ─────────────────────────────────────────────────────────────────────────────────

export const users = pgTable('users', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }),
    email: varchar('email', { length: 255 }).notNull().unique(),
    emailVerified: timestamp('email_verified', { mode: 'date' }),
    image: varchar('image', { length: 500 }),
    passwordHash: varchar('password_hash', { length: 255 }),

    // Preferences
    preferredScript: varchar('preferred_script', { length: 10 }).default('both'),
    preferredTheme: varchar('preferred_theme', { length: 10 }).default('klasik'),
    preferredLanguage: varchar('preferred_language', { length: 5 }).default('id'),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

export const accounts = pgTable('accounts', {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: varchar('type', { length: 255 }).notNull(),
    provider: varchar('provider', { length: 255 }).notNull(),
    providerAccountId: varchar('provider_account_id', { length: 255 }).notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: integer('expires_at'),
    tokenType: varchar('token_type', { length: 255 }),
    scope: varchar('scope', { length: 255 }),
    idToken: text('id_token'),
    sessionState: varchar('session_state', { length: 255 }),
});

export const sessions = pgTable('sessions', {
    id: uuid('id').defaultRandom().primaryKey(),
    sessionToken: varchar('session_token', { length: 255 }).notNull().unique(),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable('verification_tokens', {
    identifier: varchar('identifier', { length: 255 }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// TREES (= "Families" in WIJA 3 / tenants)
// ─────────────────────────────────────────────────────────────────────────────────

export const trees = pgTable('trees', {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    displayName: varchar('display_name', { length: 255 }),
    slug: varchar('slug', { length: 255 }).unique(),
    ownerId: uuid('owner_id').references(() => users.id),
    rootAncestorId: uuid('root_ancestor_id'),

    // Settings
    scriptMode: varchar('script_mode', { length: 10 }).default('both'),
    theme: varchar('theme', { length: 10 }).default('klasik'),
    language: varchar('language', { length: 5 }).default('id'),

    // Subscription
    plan: varchar('plan', { length: 20 }).default('free'),
    planStatus: varchar('plan_status', { length: 20 }).default('active'),

    // Stats (cached, updated on mutations)
    memberCount: integer('member_count').default(0),
    personCount: integer('person_count').default(0),
    relationshipCount: integer('relationship_count').default(0),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// TREE MEMBERS (Role-based access per tree)
// ─────────────────────────────────────────────────────────────────────────────────

export const treeMembers = pgTable('tree_members', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),

    displayName: varchar('display_name', { length: 255 }),
    linkedPersonId: uuid('linked_person_id'),

    joinedAt: timestamp('joined_at').defaultNow(),
    invitedBy: uuid('invited_by'),
    lastActiveAt: timestamp('last_active_at').defaultNow(),
}, (table) => [
    uniqueIndex('tree_members_tree_user_idx').on(table.treeId, table.userId),
]);

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONS (INDI records + Lontara fields)
// ─────────────────────────────────────────────────────────────────────────────────

export const persons = pgTable('persons', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    gedcomId: varchar('gedcom_id', { length: 50 }),

    // Names (Latin)
    firstName: varchar('first_name', { length: 255 }).notNull(),
    middleName: varchar('middle_name', { length: 255 }),
    lastName: varchar('last_name', { length: 255 }).notNull(),
    fullName: varchar('full_name', { length: 500 }),

    // Names (Lontara - auto-transliterated)
    lontaraFirstName: text('lontara_first_name'),
    lontaraMiddleName: text('lontara_middle_name'),
    lontaraLastName: text('lontara_last_name'),

    // Names (Lontara - manual override)
    lontaraFirstNameCustom: text('lontara_first_name_custom'),
    lontaraMiddleNameCustom: text('lontara_middle_name_custom'),
    lontaraLastNameCustom: text('lontara_last_name_custom'),

    // Demographics
    gender: varchar('gender', { length: 10 }).notNull().default('unknown'),
    birthDate: varchar('birth_date', { length: 20 }),
    birthPlace: varchar('birth_place', { length: 500 }),
    birthPlaceLontara: text('birth_place_lontara'),
    birthOrder: integer('birth_order'),
    deathDate: varchar('death_date', { length: 20 }),
    deathPlace: varchar('death_place', { length: 500 }),
    deathPlaceLontara: text('death_place_lontara'),
    isLiving: boolean('is_living').default(true),
    occupation: varchar('occupation', { length: 255 }),
    title: varchar('title', { length: 50 }),             // Nobility: datu, arung, karaeng, opu, andi
    reignTitle: varchar('reign_title', { length: 255 }),  // e.g. "Raja Bone X"
    biography: text('biography'),

    // Relationships (denormalized for quick access)
    spouseIds: jsonb('spouse_ids').$type<string[]>().default([]),
    parentIds: jsonb('parent_ids').$type<string[]>().default([]),
    childIds: jsonb('child_ids').$type<string[]>().default([]),
    siblingIds: jsonb('sibling_ids').$type<string[]>().default([]),

    isRootAncestor: boolean('is_root_ancestor').default(false),

    // Visualization position
    positionX: real('position_x').default(0),
    positionY: real('position_y').default(0),
    positionFixed: boolean('position_fixed').default(false),

    // Media
    photoUrl: varchar('photo_url', { length: 500 }),
    thumbnailUrl: varchar('thumbnail_url', { length: 500 }),

    // Audit
    createdBy: uuid('created_by'),
    updatedBy: uuid('updated_by'),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('persons_tree_idx').on(table.treeId),
]);

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS (Spouse & Parent-Child)
// ─────────────────────────────────────────────────────────────────────────────────

export const relationships = pgTable('relationships', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    gedcomFamilyId: varchar('gedcom_family_id', { length: 50 }),

    type: varchar('type', { length: 20 }).notNull(), // 'spouse' | 'parent-child'
    person1Id: uuid('person1_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),
    person2Id: uuid('person2_id').notNull().references(() => persons.id, { onDelete: 'cascade' }),

    // Marriage details (for spouse type)
    marriageDate: varchar('marriage_date', { length: 20 }),
    marriagePlace: varchar('marriage_place', { length: 500 }),
    marriagePlaceLontara: text('marriage_place_lontara'),
    marriageStatus: varchar('marriage_status', { length: 20 }), // 'married' | 'divorced' | 'widowed'
    marriageOrder: integer('marriage_order'),

    // Parent-child details
    biologicalParent: boolean('biological_parent').default(true),

    // Divorce
    divorceDate: varchar('divorce_date', { length: 20 }),

    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
    index('relationships_tree_idx').on(table.treeId),
    index('relationships_person1_idx').on(table.person1Id),
    index('relationships_person2_idx').on(table.person2Id),
]);

// ─────────────────────────────────────────────────────────────────────────────────
// GEDCOM: Sources (SOUR records)
// ─────────────────────────────────────────────────────────────────────────────────

export const sources = pgTable('sources', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    gedcomId: varchar('gedcom_id', { length: 50 }),
    title: text('title').notNull(),
    author: text('author'),
    publisher: text('publisher'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// GEDCOM: Media (OBJE records)
// ─────────────────────────────────────────────────────────────────────────────────

export const media = pgTable('media', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    gedcomId: varchar('gedcom_id', { length: 50 }),
    personId: uuid('person_id').references(() => persons.id, { onDelete: 'set null' }),
    filePath: varchar('file_path', { length: 500 }),
    fileType: varchar('file_type', { length: 50 }),
    title: varchar('title', { length: 255 }),
    s3Key: varchar('s3_key', { length: 500 }),
    createdAt: timestamp('created_at').defaultNow(),
});

// ─────────────────────────────────────────────────────────────────────────────────
// INVITATIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const invitations = pgTable('invitations', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
    treeName: varchar('tree_name', { length: 255 }),

    email: varchar('email', { length: 255 }).notNull(),
    role: varchar('role', { length: 20 }).notNull().default('viewer'),

    invitedBy: uuid('invited_by').references(() => users.id),
    invitedByName: varchar('invited_by_name', { length: 255 }),

    status: varchar('status', { length: 20 }).notNull().default('pending'),
    expiresAt: timestamp('expires_at'),

    createdAt: timestamp('created_at').defaultNow(),
    respondedAt: timestamp('responded_at'),
});

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────────

export const activities = pgTable('activities', {
    id: uuid('id').defaultRandom().primaryKey(),
    treeId: uuid('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),

    action: varchar('action', { length: 50 }).notNull(),
    description: text('description'),

    targetId: uuid('target_id'),
    targetType: varchar('target_type', { length: 20 }),

    performedBy: uuid('performed_by').references(() => users.id),
    performedByName: varchar('performed_by_name', { length: 255 }),

    createdAt: timestamp('created_at').defaultNow(),
}, (table) => [
    index('activities_tree_idx').on(table.treeId),
]);

// ─────────────────────────────────────────────────────────────────────────────────
// TYPE EXPORTS (inferred from schema)
// ─────────────────────────────────────────────────────────────────────────────────

export type DbUser = typeof users.$inferSelect;
export type DbTree = typeof trees.$inferSelect;
export type DbTreeMember = typeof treeMembers.$inferSelect;
export type DbPerson = typeof persons.$inferSelect;
export type DbRelationship = typeof relationships.$inferSelect;
export type DbSource = typeof sources.$inferSelect;
export type DbMedia = typeof media.$inferSelect;
export type DbInvitation = typeof invitations.$inferSelect;
export type DbActivity = typeof activities.$inferSelect;

export type NewUser = typeof users.$inferInsert;
export type NewTree = typeof trees.$inferInsert;
export type NewTreeMember = typeof treeMembers.$inferInsert;
export type NewPerson = typeof persons.$inferInsert;
export type NewRelationship = typeof relationships.$inferInsert;
export type NewSource = typeof sources.$inferInsert;
export type NewMedia = typeof media.$inferInsert;
export type NewInvitation = typeof invitations.$inferInsert;
export type NewActivity = typeof activities.$inferInsert;
