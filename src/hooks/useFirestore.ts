// ═══════════════════════════════════════════════════════════════════════════════
// WIJA 3 - Data Hooks (React Query)
// React hooks for data fetching using @tanstack/react-query
// ═══════════════════════════════════════════════════════════════════════════════

import { useMemo, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Family, Person, Relationship } from '@/types';
import { familiesApi, personsApi, relationshipsApi } from '@/lib/api';
import { calculateAllGenerationsFromMap, findRootAncestor, getGenerationStats } from '@/lib/generation/calculator';
import { useAuth } from '@/contexts/AuthContext';

const REFETCH_INTERVAL = 3_000; // 3 seconds for "realtime" hooks

// ─────────────────────────────────────────────────────────────────────────────────
// QUERY KEYS (centralized for cache invalidation)
// ─────────────────────────────────────────────────────────────────────────────────

export const queryKeys = {
    families: {
        all: ['families'] as const,
        user: (userId: string) => ['families', 'user', userId] as const,
        detail: (familyId: string) => ['families', familyId] as const,
    },
    persons: {
        all: (familyId: string) => ['persons', familyId] as const,
    },
    relationships: {
        all: (familyId: string) => ['relationships', familyId] as const,
    },
};

// ─────────────────────────────────────────────────────────────────────────────────
// INVALIDATION HOOK (call after mutations for instant UI updates)
// ─────────────────────────────────────────────────────────────────────────────────

export function useInvalidate() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return {
        invalidatePersons: useCallback((familyId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.persons.all(familyId) });
        }, [queryClient]),

        invalidateRelationships: useCallback((familyId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.relationships.all(familyId) });
        }, [queryClient]),

        invalidateFamily: useCallback((familyId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(familyId) });
        }, [queryClient]),

        invalidateFamilies: useCallback(() => {
            queryClient.invalidateQueries({ queryKey: queryKeys.families.all });
            if (user?.uid) {
                queryClient.invalidateQueries({ queryKey: queryKeys.families.user(user.uid) });
            }
        }, [queryClient, user?.uid]),

        invalidateAll: useCallback((familyId: string) => {
            queryClient.invalidateQueries({ queryKey: queryKeys.persons.all(familyId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.relationships.all(familyId) });
            queryClient.invalidateQueries({ queryKey: queryKeys.families.detail(familyId) });
        }, [queryClient]),
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// FAMILY HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch a single family
 */
export function useFamily(familyId: string | null) {
    const { data: family = null, isLoading: loading, error } = useQuery({
        queryKey: queryKeys.families.detail(familyId || ''),
        queryFn: () => familiesApi.getFamily(familyId!),
        enabled: !!familyId,
    });

    return { family, loading, error: error as Error | null };
}

/**
 * Hook to fetch user's families
 */
export function useUserFamilies() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    const { data: families = [], isLoading: loading, error } = useQuery({
        queryKey: queryKeys.families.user(user?.uid || ''),
        queryFn: async () => {
            const data = await familiesApi.getUserFamilies();
            // Sort by updatedAt descending
            return data.sort((a: Family, b: Family) => {
                const aTime = a.updatedAt instanceof Date ? a.updatedAt.getTime() : new Date(a.updatedAt).getTime();
                const bTime = b.updatedAt instanceof Date ? b.updatedAt.getTime() : new Date(b.updatedAt).getTime();
                return bTime - aTime;
            });
        },
        enabled: !!user,
    });

    const refresh = useCallback(() => {
        queryClient.invalidateQueries({ queryKey: queryKeys.families.user(user?.uid || '') });
    }, [queryClient, user?.uid]);

    return { families, loading, error: error as Error | null, refresh, isSuperAdmin: false };
}

// ─────────────────────────────────────────────────────────────────────────────────
// PERSONS HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all persons in a family
 */
export function usePersons(familyId: string | null) {
    const { data: persons = [], isLoading: loading, error } = useQuery({
        queryKey: queryKeys.persons.all(familyId || ''),
        queryFn: () => personsApi.getAllPersons(familyId!),
        enabled: !!familyId,
    });

    return { persons, loading, error: error as Error | null };
}

/**
 * Hook to fetch persons with background refetch (replaces polling)
 */
export function usePersonsRealtime(familyId: string | null) {
    const { data: persons = [], isLoading: loading, error } = useQuery({
        queryKey: queryKeys.persons.all(familyId || ''),
        queryFn: () => personsApi.getAllPersons(familyId!),
        enabled: !!familyId,
        refetchInterval: REFETCH_INTERVAL,
    });

    return { persons, loading, error: error as Error | null };
}

// ─────────────────────────────────────────────────────────────────────────────────
// RELATIONSHIPS HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to fetch all relationships in a family
 */
export function useRelationships(familyId: string | null) {
    const { data: relationships = [], isLoading: loading, error } = useQuery({
        queryKey: queryKeys.relationships.all(familyId || ''),
        queryFn: () => relationshipsApi.getAllRelationships(familyId!),
        enabled: !!familyId,
    });

    return { relationships, loading, error: error as Error | null };
}

/**
 * Hook to fetch relationships with background refetch (replaces polling)
 */
export function useRelationshipsRealtime(familyId: string | null) {
    const { data: relationships = [], isLoading: loading, error } = useQuery({
        queryKey: queryKeys.relationships.all(familyId || ''),
        queryFn: () => relationshipsApi.getAllRelationships(familyId!),
        enabled: !!familyId,
        refetchInterval: REFETCH_INTERVAL,
    });

    return { relationships, loading, error: error as Error | null };
}

// ─────────────────────────────────────────────────────────────────────────────────
// COMBINED FAMILY TREE HOOK
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get complete family tree data with generations
 */
export function useFamilyTree(familyId: string | null) {
    const { family, loading: familyLoading, error: familyError } = useFamily(familyId);
    const { persons, loading: personsLoading, error: personsError } = usePersonsRealtime(familyId);
    const { relationships, loading: relLoading, error: relError } = useRelationshipsRealtime(familyId);

    const loading = familyLoading || personsLoading || relLoading;
    const error = familyError || personsError || relError;

    // Build persons map for generation calculation
    const personsMap = useMemo(() => {
        const map = new Map<string, Person>();
        persons.forEach((p) => map.set(p.personId, p));
        return map;
    }, [persons]);

    // Find root ancestor
    const rootAncestor = useMemo(() => {
        return findRootAncestor(persons);
    }, [persons]);

    // P1 FIX: Calculate generations for all persons in single BFS pass — O(n) instead of O(n²)
    const personGenerations = useMemo(() => {
        if (!rootAncestor) return new Map<string, number>();
        return calculateAllGenerationsFromMap(rootAncestor.personId, personsMap);
    }, [persons, rootAncestor, personsMap]);

    // Calculate stats
    const stats = useMemo(() => {
        if (!rootAncestor) {
            return {
                totalGenerations: 0,
                personsByGeneration: {} as Record<number, number>,
                disconnectedCount: 0,
            };
        }
        return getGenerationStats(persons, rootAncestor.personId);
    }, [persons, rootAncestor]);

    return {
        family,
        persons,
        relationships,
        personsMap,
        rootAncestor,
        personGenerations,
        stats,
        loading,
        error,
    };
}

// ─────────────────────────────────────────────────────────────────────────────────
// UTILITY HOOKS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Hook to get generation for a specific person
 */
export function usePersonGeneration(familyId: string | null, personId: string | null) {
    const { personGenerations, rootAncestor, loading } = useFamilyTree(familyId);

    const generation = useMemo(() => {
        if (!personId || !rootAncestor) return -1;
        return personGenerations.get(personId) ?? -1;
    }, [personId, personGenerations, rootAncestor]);

    return { generation, loading };
}
