// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Custom Auth Hooks (PostgreSQL / NextAuth)
// React hooks for authentication and authorization
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MemberRole } from '@/types';
import { familiesApi } from '@/lib/api';

// ─────────────────────────────────────────────────────────────────────────────────
// PERMISSION HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to check if user has a specific role in a family
 */
export function useHasRole(familyId: string | null, roles: MemberRole[]) {
    const { user } = useAuth();
    const [hasRole, setHasRole] = useState(false);
    const [loading, setLoading] = useState(true);
    const rolesKey = [...roles].sort().join('|');
    const normalizedRoles = useMemo(
        () => (rolesKey ? (rolesKey.split('|') as MemberRole[]) : []),
        [rolesKey]
    );

    useEffect(() => {
        async function checkRole() {
            if (!user?.uid || !familyId) {
                setHasRole(false);
                setLoading(false);
                return;
            }

            try {
                const { role } = await familiesApi.getUserRole(familyId);

                if (role) {
                    setHasRole(normalizedRoles.includes(role));
                } else {
                    // Fallback: check if user is the family owner directly
                    const family = await familiesApi.getFamily(familyId);

                    if (family && family.ownerId === user.uid && normalizedRoles.includes('owner')) {
                        setHasRole(true);
                    } else {
                        setHasRole(false);
                    }
                }
            } catch (err) {
                console.error('Error checking role:', err);
                setHasRole(false);
            } finally {
                setLoading(false);
            }
        }

        void checkRole();
    }, [user?.uid, familyId, normalizedRoles]);

    return { hasRole, loading };
}

/**
 * Hook to check if user can edit in a family
 */
export function useCanEdit(familyId: string | null) {
    const { hasRole, loading: roleLoading } = useHasRole(familyId, ['owner', 'admin', 'editor']);
    const { isSuperAdmin, loading: superLoading } = useIsSuperAdmin();
    return { hasRole: hasRole || isSuperAdmin, loading: roleLoading || superLoading };
}

/**
 * Hook to check if user is admin or owner
 */
export function useIsAdmin(familyId: string | null) {
    const { hasRole, loading: roleLoading } = useHasRole(familyId, ['owner', 'admin']);
    const { isSuperAdmin, loading: superLoading } = useIsSuperAdmin();
    return { hasRole: hasRole || isSuperAdmin, loading: roleLoading || superLoading };
}

/**
 * Hook to check if user is family owner
 */
export function useIsOwner(familyId: string | null) {
    return useHasRole(familyId, ['owner']);
}

/**
 * Hook to check if user is a super admin
 */
export function useIsSuperAdmin() {
    const { user } = useAuth();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchSuperAdminRole() {
            if (!user?.uid) {
                setIsSuperAdmin(false);
                setLoading(false);
                return;
            }

            try {
                const response = await fetch('/api/user/superadmin');
                if (!response.ok) {
                    setIsSuperAdmin(false);
                    return;
                }
                const data = await response.json();
                setIsSuperAdmin(Boolean(data.isSuperAdmin));
            } catch {
                setIsSuperAdmin(false);
            } finally {
                setLoading(false);
            }
        }

        setLoading(true);
        void fetchSuperAdminRole();
    }, [user?.uid]);

    return { isSuperAdmin, loading };
}

/**
 * Hook to check if user is member of a family
 */
export function useIsMember(familyId: string | null) {
    const { user } = useAuth();
    const [isMember, setIsMember] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function checkMembership() {
            if (!user || !familyId) {
                setIsMember(false);
                setLoading(false);
                return;
            }

            try {
                const { isMember: result } = await familiesApi.isFamilyMember(familyId);
                setIsMember(result);
            } catch {
                setIsMember(false);
            } finally {
                setLoading(false);
            }
        }

        checkMembership();
    }, [user, familyId]);

    return { isMember, loading };
}

// ─────────────────────────────────────────────────────────────────────────────────
// USER ROLE HOOK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get user's role in a family
 */
export function useUserRole(familyId: string | null) {
    const { user } = useAuth();
    const [role, setRole] = useState<MemberRole | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchRole() {
            if (!user || !familyId) {
                setRole(null);
                setLoading(false);
                return;
            }

            try {
                const { role: userRole } = await familiesApi.getUserRole(familyId);
                setRole(userRole);
            } catch {
                setRole(null);
            } finally {
                setLoading(false);
            }
        }

        fetchRole();
    }, [user, familyId]);

    return { role, loading };
}

// ─────────────────────────────────────────────────────────────────────────────────
// AUTH STATE HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to ensure user is authenticated (redirect logic can be added)
 */
export function useRequireAuth() {
    const { user, loading, isAuthenticated } = useAuth();

    return {
        user,
        loading,
        isAuthenticated,
        needsAuth: !loading && !isAuthenticated,
    };
}

/**
 * Hook to ensure user is NOT authenticated (for login/register pages)
 */
export function useRequireGuest() {
    const { user, loading, isAuthenticated } = useAuth();

    return {
        user,
        loading,
        isAuthenticated,
        needsRedirect: !loading && isAuthenticated,
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERMISSION HELPERS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Role permission matrix
 */
export const PERMISSIONS = {
    VIEW_TREE: ['superadmin', 'owner', 'admin', 'editor', 'viewer'],
    VIEW_ALL_FAMILIES: ['superadmin'],
    CREATE_PERSON: ['superadmin', 'owner', 'admin', 'editor'],
    EDIT_PERSON: ['superadmin', 'owner', 'admin', 'editor'],
    DELETE_PERSON: ['superadmin', 'owner', 'admin'],
    MANAGE_RELATIONSHIPS: ['superadmin', 'owner', 'admin', 'editor'],
    INVITE_MEMBERS: ['superadmin', 'owner', 'admin'],
    REMOVE_MEMBERS: ['superadmin', 'owner', 'admin'],
    EDIT_FAMILY_SETTINGS: ['superadmin', 'owner'],
    DELETE_FAMILY: ['superadmin', 'owner'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

/**
 * Hook to check if user has a specific permission
 */
export function useHasPermission(familyId: string | null, permission: Permission) {
    const roles = [...PERMISSIONS[permission]] as MemberRole[];
    return useHasRole(familyId, roles);
}

/**
 * Get all permissions for a role
 */
export function getPermissionsForRole(role: MemberRole): Permission[] {
    const permissions: Permission[] = [];

    for (const [permission, roles] of Object.entries(PERMISSIONS)) {
        if ((roles as readonly MemberRole[]).includes(role)) {
            permissions.push(permission as Permission);
        }
    }

    return permissions;
}

/**
 * Check if a role has a permission
 */
export function roleHasPermission(role: MemberRole, permission: Permission): boolean {
    return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}
