// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Client-side API helper
// All frontend components should use this instead of importing services directly
// ═══════════════════════════════════════════════════════════════════════════════

import type {
    Person,
    Family,
    FamilyMember,
    Relationship,
    Invitation,
    CreatePersonInput,
    CreateFamilyInput,
    CreateRelationshipInput,
    MarriageDetails,
    MemberRole,
    LontaraName,
} from '@/types';
import type { CreateInvitationInput } from '@/lib/services/invitations';

// ─────────────────────────────────────────────────────────────────────────────────
// BASE HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `API error: ${res.status}`);
    }

    return res.json();
}

async function fetchVoid(url: string, options?: RequestInit): Promise<void> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(body.error || `API error: ${res.status}`);
    }
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILIES
// ─────────────────────────────────────────────────────────────────────────────────

export const familiesApi = {
    /** Get all families for the current user */
    getUserFamilies: () =>
        fetchJson<Family[]>('/api/families'),

    /** Create a new family */
    createFamily: (input: CreateFamilyInput) =>
        fetchJson<Family>('/api/families', {
            method: 'POST',
            body: JSON.stringify(input),
        }),

    /** Get a family by ID */
    getFamily: (familyId: string) =>
        fetchJson<Family>(`/api/families/${familyId}`),

    /** Update a family */
    updateFamily: (familyId: string, updates: Partial<Pick<Family, 'name' | 'displayName'>> & { settings?: Partial<Family['settings']> }) =>
        fetchVoid(`/api/families/${familyId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        }),

    /** Delete a family */
    deleteFamily: (familyId: string) =>
        fetchVoid(`/api/families/${familyId}`, { method: 'DELETE' }),

    /** Get family members */
    getFamilyMembers: (familyId: string) =>
        fetchJson<FamilyMember[]>(`/api/families/${familyId}/members`),

    /** Update member role */
    updateMemberRole: (familyId: string, userId: string, newRole: MemberRole) =>
        fetchVoid(`/api/families/${familyId}/members/${userId}`, {
            method: 'PATCH',
            body: JSON.stringify({ role: newRole }),
        }),

    /** Remove a family member */
    removeFamilyMember: (familyId: string, userId: string) =>
        fetchVoid(`/api/families/${familyId}/members/${userId}`, { method: 'DELETE' }),

    /** Get user's role in a family */
    getUserRole: (familyId: string) =>
        fetchJson<{ role: MemberRole | null }>(`/api/families/${familyId}/role`),

    /** Check if current user is a member */
    isFamilyMember: (familyId: string) =>
        fetchJson<{ isMember: boolean }>(`/api/families/${familyId}/membership`),
};

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONS
// ─────────────────────────────────────────────────────────────────────────────────

export const personsApi = {
    /** Get all persons in a family */
    getAllPersons: (familyId: string) =>
        fetchJson<Person[]>(`/api/families/${familyId}/persons`),

    /** Get persons as a Map */
    getPersonsMap: async (familyId: string): Promise<Map<string, Person>> => {
        const persons = await fetchJson<Person[]>(`/api/families/${familyId}/persons`);
        return new Map(persons.map(p => [p.personId, p]));
    },

    /** Create a new person */
    createPerson: (familyId: string, input: CreatePersonInput) =>
        fetchJson<Person>(`/api/families/${familyId}/persons`, {
            method: 'POST',
            body: JSON.stringify(input),
        }),

    /** Update a person */
    updatePerson: (familyId: string, personId: string, updates: Partial<CreatePersonInput>) =>
        fetchVoid(`/api/families/${familyId}/persons/${personId}`, {
            method: 'PATCH',
            body: JSON.stringify(updates),
        }),

    /** Delete a person */
    deletePerson: (familyId: string, personId: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${personId}`, { method: 'DELETE' }),

    /** Update person position */
    updatePersonPosition: (familyId: string, personId: string, position: { x: number; y: number; fixed?: boolean }) =>
        fetchVoid(`/api/families/${familyId}/persons/${personId}/position`, {
            method: 'PATCH',
            body: JSON.stringify(position),
        }),

    /** Update all person positions in batch */
    updateAllPersonPositions: (familyId: string, positions: Record<string, { x: number; y: number }>) =>
        fetchVoid(`/api/families/${familyId}/persons/positions`, {
            method: 'PUT',
            body: JSON.stringify({ positions }),
        }),

    /** Upload person photo */
    uploadPersonPhoto: async (familyId: string, personId: string, file: File): Promise<{ photoUrl: string; thumbnailUrl: string }> => {
        const formData = new FormData();
        formData.append('file', file);
        const res = await fetch(`/api/families/${familyId}/persons/${personId}/photo`, {
            method: 'POST',
            body: formData,
        });
        if (!res.ok) {
            const body = await res.json().catch(() => ({ error: res.statusText }));
            throw new Error(body.error || 'Upload failed');
        }
        return res.json();
    },

    /** Delete person photo */
    deletePersonPhoto: (familyId: string, personId: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${personId}/photo`, { method: 'DELETE' }),

    /** Add spouse relationship */
    addSpouse: (familyId: string, person1Id: string, person2Id: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${person1Id}/spouse`, {
            method: 'POST',
            body: JSON.stringify({ person2Id }),
        }),

    /** Remove spouse relationship */
    removeSpouse: (familyId: string, person1Id: string, person2Id: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${person1Id}/spouse`, {
            method: 'DELETE',
            body: JSON.stringify({ person2Id }),
        }),

    /** Add parent-child relationship */
    addParentChild: (familyId: string, parentId: string, childId: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${parentId}/children`, {
            method: 'POST',
            body: JSON.stringify({ childId }),
        }),

    /** Remove parent-child relationship */
    removeParentChild: (familyId: string, parentId: string, childId: string) =>
        fetchVoid(`/api/families/${familyId}/persons/${parentId}/children`, {
            method: 'DELETE',
            body: JSON.stringify({ childId }),
        }),

    /** Regenerate all Lontara names */
    regenerateAllLontaraNames: (familyId: string) =>
        fetchJson<{ count: number }>(`/api/families/${familyId}/persons/regenerate-lontara`, {
            method: 'POST',
        }),

    /** Set custom Lontara name */
    setCustomLontaraName: (familyId: string, personId: string, customName: Partial<LontaraName>) =>
        fetchVoid(`/api/families/${familyId}/persons/${personId}/lontara`, {
            method: 'PATCH',
            body: JSON.stringify(customName),
        }),
};

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS
// ─────────────────────────────────────────────────────────────────────────────────

export const relationshipsApi = {
    /** Get all relationships in a family */
    getAllRelationships: (familyId: string) =>
        fetchJson<Relationship[]>(`/api/families/${familyId}/relationships`),

    /** Create a relationship */
    createRelationship: (familyId: string, input: CreateRelationshipInput) =>
        fetchJson<Relationship>(`/api/families/${familyId}/relationships`, {
            method: 'POST',
            body: JSON.stringify(input),
        }),

    /** Update marriage details */
    updateMarriageDetails: (familyId: string, relationshipId: string, details: Partial<MarriageDetails>) =>
        fetchVoid(`/api/families/${familyId}/relationships/${relationshipId}`, {
            method: 'PATCH',
            body: JSON.stringify(details),
        }),

    /** Delete a relationship */
    deleteRelationship: (familyId: string, relationshipId: string) =>
        fetchVoid(`/api/families/${familyId}/relationships/${relationshipId}`, { method: 'DELETE' }),
};

// ─────────────────────────────────────────────────────────────────────────────────
// INVITATIONS
// ─────────────────────────────────────────────────────────────────────────────────

export const invitationsApi = {
    /** Create invitation */
    createInvitation: (input: CreateInvitationInput) =>
        fetchJson<Invitation>('/api/invitations', {
            method: 'POST',
            body: JSON.stringify(input),
        }),

    /** Get invitation by ID */
    getInvitation: (id: string) =>
        fetchJson<Invitation>(`/api/invitations/${id}`),

    /** Get invitations for a family */
    getInvitationsForFamily: (familyId: string) =>
        fetchJson<Invitation[]>(`/api/invitations/family/${familyId}`),

    /** Accept invitation */
    acceptInvitation: (id: string, data: { userId: string; displayName: string; email: string; photoUrl?: string }) =>
        fetchVoid(`/api/invitations/${id}/accept`, {
            method: 'POST',
            body: JSON.stringify(data),
        }),

    /** Decline invitation */
    declineInvitation: (id: string) =>
        fetchVoid(`/api/invitations/${id}/decline`, { method: 'POST' }),

    /** Revoke invitation */
    revokeInvitation: (id: string) =>
        fetchVoid(`/api/invitations/${id}`, { method: 'DELETE' }),

    /** Resend invitation */
    resendInvitation: (id: string) =>
        fetchVoid(`/api/invitations/${id}/resend`, { method: 'POST' }),

    /** Check if email already invited */
    isEmailAlreadyInvited: (familyId: string, email: string) =>
        fetchJson<{ isInvited: boolean }>('/api/invitations/check', {
            method: 'POST',
            body: JSON.stringify({ familyId, email }),
        }),
};

// ─────────────────────────────────────────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────────────────────────────────────────

export const userApi = {
    /** Check if user is superadmin */
    isSuperAdmin: () =>
        fetchJson<{ isSuperAdmin: boolean }>('/api/user/superadmin'),
};
