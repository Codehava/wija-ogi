// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Type Definitions
// Based on WIJA Blueprint v5.0 — Updated for PostgreSQL
// ═══════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────────
// CORE TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export type Gender = 'male' | 'female' | 'other' | 'unknown';
export type MemberRole = 'superadmin' | 'owner' | 'admin' | 'editor' | 'viewer';
export type SubscriptionPlan = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'cancelled' | 'expired' | 'trial';
export type ScriptMode = 'latin' | 'lontara' | 'both';
export type ThemeMode = 'klasik' | 'nusantara';
export type Language = 'id' | 'en';
export type RelationshipType = 'spouse' | 'parent-child';
export type MarriageStatus = 'married' | 'divorced' | 'widowed';
export type NobilityTitle = 'datu' | 'arung' | 'karaeng' | 'opu' | 'andi' | 'other';

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY / TREE DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────────

export interface Family {
    familyId: string;
    name: string;                    // "Keluarga Budiman"
    displayName: string;             // "Budiman Family Tree"
    slug: string;                    // "keluarga-budiman"

    ownerId: string;
    rootAncestorId?: string;         // Starting point for generation calc

    subscription: {
        plan: SubscriptionPlan;
        status: SubscriptionStatus;
    };

    settings: {
        script: ScriptMode;
        theme: ThemeMode;
        language: Language;
    };

    // Stats (NO generationCount - calculated dynamically)
    stats: {
        memberCount: number;
        personCount: number;
        relationshipCount: number;
    };

    createdAt: Date | string;
    updatedAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERSON DOCUMENT (NO GENERATION FIELD - Calculated at runtime)
// ─────────────────────────────────────────────────────────────────────────────────

export interface LatinName {
    first: string;
    middle?: string;
    last: string;
}

export interface LontaraName {
    first: string;               // AUTO from latinName
    middle?: string;
    last: string;
}

export interface Position {
    x: number;
    y: number;
    fixed: boolean;
}

export interface PersonRelationships {
    spouseIds: string[];
    parentIds: string[];         // Max 2
    childIds: string[];
    siblingIds: string[];        // Computed
}

export interface Person {
    personId: string;
    familyId: string;

    // ══════════════════════════════════════════════════════════
    // DUAL NAME SUPPORT
    // ══════════════════════════════════════════════════════════

    firstName: string;
    middleName?: string;
    lastName: string;
    fullName: string;              // Computed

    // Auto-transliterated Lontara
    latinName: LatinName;
    lontaraName: LontaraName;

    // Optional manual override
    lontaraNameCustom?: Partial<LontaraName>;

    // ══════════════════════════════════════════════════════════
    // DEMOGRAPHICS
    // ══════════════════════════════════════════════════════════

    gender: Gender;
    birthDate?: string;            // YYYY-MM-DD
    birthPlace?: string;
    birthOrder?: number;           // Anak ke-XX (1, 2, 3...)
    deathDate?: string;
    deathPlace?: string;
    isLiving: boolean;
    occupation?: string;
    title?: NobilityTitle;           // Nobility title: datu, arung, karaeng, opu, andi
    reignTitle?: string;             // e.g. "Raja Bone X", "Arung Matoa Wajo ke-15"
    biography?: string;

    // ══════════════════════════════════════════════════════════
    // RELATIONSHIPS (Replaces static generation)
    // ══════════════════════════════════════════════════════════

    relationships: PersonRelationships;
    isRootAncestor: boolean;       // Flag for generation calc

    // ══════════════════════════════════════════════════════════
    // VISUALIZATION
    // ══════════════════════════════════════════════════════════

    position: Position;
    photoUrl?: string;
    thumbnailUrl?: string;

    // GEDCOM
    gedcomId?: string;

    // Audit
    createdBy: string;
    createdAt: Date | string;
    updatedBy: string;
    updatedAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIP DOCUMENT
// ─────────────────────────────────────────────────────────────────────────────────

export interface MarriageDetails {
    date?: string;
    place?: string;
    placeLontara?: string;       // Auto-transliterated
    status: MarriageStatus;
    marriageOrder?: number;      // 1 = first wife, 2 = second wife, etc. (for polygamy)
}

export interface ParentChildDetails {
    biologicalParent: boolean;
}

export interface Relationship {
    relationshipId: string;
    familyId: string;

    type: RelationshipType;

    person1Id: string;             // Parent or spouse
    person2Id: string;             // Child or spouse

    marriage?: MarriageDetails;
    parentChild?: ParentChildDetails;

    createdAt: Date | string;
    updatedAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY MEMBER (User access to family)
// ─────────────────────────────────────────────────────────────────────────────────

export interface FamilyMember {
    memberId: string;
    userId: string;
    familyId: string;
    role: MemberRole;

    displayName: string;
    email: string;
    photoUrl?: string;

    linkedPersonId?: string;       // If linked to a Person in the tree

    joinedAt: Date | string;
    invitedBy: string;
    lastActiveAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER PROFILE (Global)
// ─────────────────────────────────────────────────────────────────────────────────

export interface UserProfile {
    userId: string;
    email: string;
    displayName: string;
    photoUrl?: string;

    // Preferences
    preferredScript: ScriptMode;
    preferredTheme: ThemeMode;
    preferredLanguage: Language;

    // Family memberships
    familyIds: string[];
    primaryFamilyId?: string;

    createdAt: Date | string;
    updatedAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INVITATION
// ─────────────────────────────────────────────────────────────────────────────────

export interface Invitation {
    invitationId: string;
    familyId: string;
    familyName: string;

    email: string;
    role: MemberRole;

    invitedBy: string;
    invitedByName: string;

    status: 'pending' | 'accepted' | 'declined' | 'expired';
    expiresAt: Date | string;

    createdAt: Date | string;
    respondedAt?: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// ACTIVITY LOG
// ─────────────────────────────────────────────────────────────────────────────────

export type ActivityAction =
    | 'person_created'
    | 'person_updated'
    | 'person_deleted'
    | 'relationship_created'
    | 'relationship_deleted'
    | 'member_invited'
    | 'member_joined'
    | 'member_removed'
    | 'family_updated'
    | 'export_created'
    | 'gedcom_imported'
    | 'gedcom_exported';

export interface Activity {
    activityId: string;
    familyId: string;

    action: ActivityAction;
    description: string;

    targetId?: string;
    targetType?: 'person' | 'relationship' | 'member' | 'family' | 'gedcom';

    performedBy: string;
    performedByName: string;

    createdAt: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// TRANSLITERATION TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface TransliterationDetail {
    latin: string;
    lontara: string;
    type: 'consonant' | 'vowel' | 'cluster' | 'foreign' | 'punctuation' | 'number';
    note?: string;
}

export interface TransliterationResult {
    lontara: string;
    details: TransliterationDetail[];
}

// ─────────────────────────────────────────────────────────────────────────────────
// EXPORT TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface ExportOptions {
    scope: 'full' | 'from_ancestor' | 'subtree';
    rootPersonId?: string;

    scriptOptions: {
        script: ScriptMode;
        lontaraPosition: 'below' | 'beside';
    };

    content: {
        includePhotos: boolean;
        includeDates: boolean;
        includeBiographies: boolean;
    };

    format: {
        paperSize: 'A4' | 'A3' | 'Letter';
        orientation: 'landscape' | 'portrait';
        quality: 'standard' | 'high';
    };
}

export interface ExportRecord {
    exportId: string;
    familyId: string;

    options: ExportOptions;
    status: 'pending' | 'processing' | 'completed' | 'failed';

    downloadUrl?: string;
    expiresAt?: Date | string;

    requestedBy: string;
    createdAt: Date | string;
    completedAt?: Date | string;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INPUT/FORM TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface CreatePersonInput {
    firstName: string;
    middleName?: string | null;
    lastName: string;
    gender: Gender;
    birthDate?: string;
    birthPlace?: string | null;
    birthOrder?: number;           // Anak ke-XX (1, 2, 3...)
    deathDate?: string;
    deathPlace?: string | null;
    isLiving: boolean;
    occupation?: string | null;
    title?: NobilityTitle | null;
    reignTitle?: string | null;
    biography?: string | null;
    isRootAncestor?: boolean;
    photoUrl?: string | null;
    thumbnailUrl?: string | null;
}

export interface CreateFamilyInput {
    name: string;
    displayName?: string;
    settings?: Partial<Family['settings']>;
}

export interface CreateRelationshipInput {
    type: RelationshipType;
    person1Id: string;
    person2Id: string;
    marriage?: MarriageDetails;
    parentChild?: ParentChildDetails;
}

// ─────────────────────────────────────────────────────────────────────────────────
// GEDCOM TYPES
// ─────────────────────────────────────────────────────────────────────────────────

export interface GedcomImportResult {
    treeId: string;
    personsCount: number;
    familiesCount: number;
    sourcesCount: number;
    errors: string[];
}

export interface GedcomExportOptions {
    version: '5.5.1' | '7.0';
    includeNotes: boolean;
    includeSources: boolean;
}
