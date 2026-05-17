---
description: "Scaffold a complete frontend feature module for the Invoice Management System — page, components, service, hook, and store"
---

Create a complete frontend feature module for: `$FEATURE_NAME`

## What to Generate

1. **TypeScript types** in `frontend/src/features/$FEATURE_NAME/types/index.ts`
   - Import and re-export from `shared/` where possible
   - Add frontend-only types (form state, UI state, filter state)

2. **API Service** in `frontend/src/features/$FEATURE_NAME/services/$FEATURE_NAME.service.ts`
   - Axios-based functions: `getAll`, `getById`, `create`, `update`, `remove`
   - Accept filter/pagination params on list calls
   - Use the base `apiClient` axios instance from `services/api.ts`

3. **TanStack Query hooks** in `frontend/src/features/$FEATURE_NAME/hooks/use$FeatureName.ts`
   - `use$FeatureNameList(filters)` — `useQuery` with pagination
   - `use$FeatureNameById(id)` — single item query
   - `useCreate$FeatureName()` — `useMutation` with cache invalidation
   - `useUpdate$FeatureName()` — `useMutation` with optimistic update
   - `useDelete$FeatureName()` — `useMutation` with confirmation

4. **Zustand store** in `frontend/src/features/$FEATURE_NAME/store/$FEATURE_NAME.store.ts`
   - UI-only state: `isFormOpen`, `selectedId`, `filters`, `activeTab`
   - Actions to open/close modals and set filters

5. **Components** in `frontend/src/features/$FEATURE_NAME/components/`
   - `$FeatureNameList.tsx` — Table/list view with pagination, search, sort
   - `$FeatureNameForm.tsx` — Create/edit form with React Hook Form + Zod
   - `$FeatureNameCard.tsx` — Card view for grid layout (optional)

6. **Page** in `frontend/src/features/$FEATURE_NAME/pages/$FeatureNamePage.tsx`
   - Wires together all components
   - Handles URL search params for filters/pagination
   - Includes loading skeleton and error state

7. **Route registration** in `frontend/src/router.tsx`:
   ```tsx
   { path: '/$FEATURE_NAME', element: <$FeatureNamePage /> }
   ```

## Standards to Follow
- No `any` types — use types from `shared/` or define explicit interfaces
- TanStack Query for all server state — no `useState` + `useEffect` for data
- Zustand only for UI state (modals, filters, sidebar)
- shadcn/ui components as the UI base
- TailwindCSS for all styling
- Error boundaries around page components
- Accessible: use semantic HTML, ARIA labels on interactive elements
