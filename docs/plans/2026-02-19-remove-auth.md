# Remove Auth & Social Features Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Strip all authentication (JWT, OAuth, NextAuth), login/signup pages, and follower/following social features so the app works as a free, no-login-required tool.

**Architecture:** Sessions remain in-memory (UUID-keyed), but ownership checks are dropped since there are no users. The dashboard becomes publicly accessible. The landing page CTA navigates directly to `/dashboard`.

**Tech Stack:** FastAPI, Next.js 16 (App Router), Zustand, TypeScript, Tailwind

---

## Task 1: Strip auth from backend/main.py

**Files:**
- Modify: `backend/main.py`

**Step 1: Remove the auth import block (lines 45–61)**

Replace:
```python
from auth import (
    create_access_token,
    create_user,
    follow_user,
    get_current_user,
    get_followers,
    get_following,
    get_or_create_oauth_user,
    get_profile,
    get_public_profile,
    get_user_by_email,
    init_db,
    search_users,
    unfollow_user,
    update_profile,
    verify_password,
)
```

With nothing (delete entirely).

Also remove `Depends` from the fastapi import on line 26:
```python
from fastapi import FastAPI, File, HTTPException, UploadFile
```

**Step 2: Remove `_session_owners` dict and simplify `_get_df()`**

Remove line 105:
```python
_session_owners: dict[str, int] = {}   # session_id → user_id
```

Replace `_get_df()` (lines 112–121):
```python
def _get_df(session_id: str) -> pd.DataFrame:
    df = _sessions.get(session_id)
    if df is None:
        raise HTTPException(
            status_code=404,
            detail=f"Session '{session_id}' not found. Please upload a file first.",
        )
    return df
```

**Step 3: Simplify the lifespan function (lines 75–80)**

Replace:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    logger.info("Database initialised. predictpy backend starting up.")
    yield
    logger.info("predictpy backend shutting down.")
```
With:
```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("predictpy backend starting up.")
    yield
    logger.info("predictpy backend shutting down.")
```

**Step 4: Remove auth/profile/social request models and endpoints**

Delete these Pydantic models (lines 132–203):
- `OAuthRequest`
- `RegisterRequest`
- `LoginRequest`
- `ProfileUpdateRequest`

Delete these endpoint blocks entirely:
- Section comment + `/health` DB check (replace health with simple version — see below)
- `POST /auth/oauth` (lines 224–237)
- `POST /auth/register` (lines 240–252)
- `POST /auth/login` (lines 255–268)
- `GET /profile` (lines 275–281)
- `PUT /profile` (lines 284–301)
- `GET /users/search` (lines 308–316)
- `GET /users/{username}` (lines 319–328)
- `POST /users/{username}/follow` (lines 331–340)
- `DELETE /users/{username}/follow` (lines 343–352)
- `GET /users/{username}/followers` (lines 355–358)
- `GET /users/{username}/following` (lines 361–364)

Replace the `/health` endpoint with a version that doesn't check the DB:
```python
@app.get("/health")
def health_check() -> dict:
    return {"status": "ok", "version": "2.0.0"}
```

**Step 5: Strip `Depends(get_current_user)` from all dataset endpoints**

For each of these endpoints, remove the `current_user: dict = Depends(get_current_user)` parameter:
- `POST /upload`
- `POST /suggest-target`
- `POST /analyze`
- `POST /scatter`
- `POST /distribution`
- `POST /correlation-matrix`
- `POST /engineer-feature`
- `POST /drop-feature`
- `POST /train`
- `DELETE /session/{session_id}`

In `/upload`, remove:
```python
_session_owners[session_id] = current_user["id"]
```
And simplify the logger line — remove `current_user["id"]` references:
```python
logger.info(
    "File uploaded: %s (%d rows, %d cols, %.1f KB)",
    file.filename, df.shape[0], df.shape[1], len(contents) / 1024,
)
```

**Step 6: Update all `_get_df()` calls to drop the user_id argument**

Replace every occurrence of `_get_df(body.session_id, current_user["id"])` or `_get_df(session_id, current_user["id"])` with `_get_df(body.session_id)` or `_get_df(session_id)`.

**Step 7: Update the docstring at the top of main.py**

Replace the docstring to remove auth endpoint references.

**Step 8: Verify the backend starts**

```bash
cd "Project -1/backend"
python -m uvicorn main:app --reload --port 8000
```

Expected: Server starts with no import errors. Visit `http://localhost:8000/docs` — should show only dataset endpoints + `/health` + `/models`.

**Step 9: Commit**

```bash
git add backend/main.py
git commit -m "feat: remove auth and social endpoints from backend"
```

---

## Task 2: Delete backend/auth.py and update requirements.txt

**Files:**
- Delete: `backend/auth.py`
- Modify: `backend/requirements.txt`

**Step 1: Delete auth.py**

```bash
rm "Project -1/backend/auth.py"
```

**Step 2: Remove auth packages from requirements.txt**

Remove these two lines from `backend/requirements.txt`:
```
python-jose[cryptography]==3.3.0
bcrypt==4.2.1
```

**Step 3: Verify backend still starts cleanly**

```bash
cd "Project -1/backend"
python -m uvicorn main:app --reload --port 8000
```

Expected: Starts without errors. No references to auth remain.

**Step 4: Commit**

```bash
git add backend/auth.py backend/requirements.txt
git commit -m "chore: delete auth.py and remove auth deps from requirements"
```

---

## Task 3: Delete all frontend auth/social files

**Files to delete:**
- `frontend/auth.ts`
- `frontend/lib/auth.ts`
- `frontend/app/api/auth/[...nextauth]/route.ts`
- `frontend/app/api/auth/backend-token/route.ts`
- `frontend/app/login/page.tsx`
- `frontend/app/signup/page.tsx`
- `frontend/app/profile/page.tsx`
- `frontend/app/user/[username]/page.tsx`
- `frontend/components/UserSearch.tsx`
- `frontend/components/SessionProviderWrapper.tsx`
- `frontend/components/Avatar.tsx`

**Step 1: Delete all files**

```bash
rm "Project -1/frontend/auth.ts"
rm "Project -1/frontend/lib/auth.ts"
rm "Project -1/frontend/app/api/auth/[...nextauth]/route.ts"
rm "Project -1/frontend/app/api/auth/backend-token/route.ts"
rm "Project -1/frontend/app/login/page.tsx"
rm "Project -1/frontend/app/signup/page.tsx"
rm "Project -1/frontend/app/profile/page.tsx"
rm -rf "Project -1/frontend/app/user"
rm "Project -1/frontend/components/UserSearch.tsx"
rm "Project -1/frontend/components/SessionProviderWrapper.tsx"
rm "Project -1/frontend/components/Avatar.tsx"
```

**Step 2: Commit**

```bash
git add -A
git commit -m "chore: delete auth/social pages and components"
```

---

## Task 4: Modify frontend/lib/api.ts — strip auth

**Files:**
- Modify: `frontend/lib/api.ts`

**Step 1: Remove auth import and auth-related type imports**

Replace the top of the file:
```typescript
import { clearAuth, getToken } from "./auth"
import type {
  AnalyzeResponse,
  CorrelationMatrixResponse,
  DistributionResponse,
  EngineerFeatureRequest,
  EngineerFeatureResponse,
  ProfileUpdateRequest,
  PublicProfile,
  ScatterResponse,
  SuggestTargetResponse,
  TrainRequest,
  TrainResponse,
  UploadResponse,
  UserProfile,
  UserSearchResult,
} from "./types"
```

With:
```typescript
import type {
  AnalyzeResponse,
  CorrelationMatrixResponse,
  DistributionResponse,
  EngineerFeatureRequest,
  EngineerFeatureResponse,
  ScatterResponse,
  SuggestTargetResponse,
  TrainRequest,
  TrainResponse,
  UploadResponse,
} from "./types"
```

**Step 2: Replace the `request<T>()` function — no auth, no 401 redirect**

Replace lines 21–55 with:
```typescript
async function request<T>(path: string, options: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, options)

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body?.detail ?? message
    } catch {
      // ignore parse error
    }
    throw new Error(message)
  }

  return res.json() as Promise<T>
}
```

**Step 3: Delete the Auth section (register + login functions)**

Delete lines 57–81:
```typescript
// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function register(email: string, password: string): Promise<void> { ... }
export async function login(...) { ... }
```

**Step 4: Delete the Profile and Social sections**

Delete lines 185–231 (everything from `// Profile` comment to the end of the file).

**Step 5: Verify no TypeScript errors**

```bash
cd "Project -1/frontend"
npx tsc --noEmit
```

Expected: No errors related to removed auth types.

**Step 6: Commit**

```bash
git add frontend/lib/api.ts
git commit -m "feat: strip auth from api client"
```

---

## Task 5: Modify frontend/lib/types.ts — remove user types

**Files:**
- Modify: `frontend/lib/types.ts`

**Step 1: Delete the User Profile Types section (lines 1–55)**

Remove everything from the top of the file up to and including:
```typescript
export interface ProfileUpdateRequest {
  username?: string
  ...
}
```

The file should now start at the `// Dataset Profile Types` comment.

**Step 2: Verify no TS errors**

```bash
cd "Project -1/frontend"
npx tsc --noEmit
```

**Step 3: Commit**

```bash
git add frontend/lib/types.ts
git commit -m "chore: remove user/profile/social types"
```

---

## Task 6: Modify frontend/app/layout.tsx — remove SessionProvider

**Files:**
- Modify: `frontend/app/layout.tsx`

**Step 1: Remove the import**

Delete line 3:
```typescript
import SessionProviderWrapper from "@/components/SessionProviderWrapper";
```

**Step 2: Unwrap children from SessionProviderWrapper**

Replace:
```typescript
<SessionProviderWrapper>{children}</SessionProviderWrapper>
```
With:
```typescript
{children}
```

**Step 3: Commit**

```bash
git add frontend/app/layout.tsx
git commit -m "chore: remove SessionProviderWrapper from root layout"
```

---

## Task 7: Modify frontend/app/page.tsx — remove auth from landing

**Files:**
- Modify: `frontend/app/page.tsx`

**Step 1: Remove auth imports and dead icons**

Remove:
- `import { getToken } from "@/lib/auth"`
- `LogIn` from the lucide-react import (no longer used)

**Step 2: Replace the auth-conditional nav with a single "Open App" button**

Replace the entire `<nav>` block (lines 26–52) with:
```tsx
<nav className="fixed top-0 right-0 z-50 p-5 flex items-center gap-3">
  <Link
    href="/dashboard"
    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-all"
  >
    Open App
    <ArrowRight className="w-3.5 h-3.5" />
  </Link>
</nav>
```

**Step 3: Simplify the upload button**

Replace `handleUploadClick` function and the button's `onClick` handler:

Remove the `handleUploadClick` function entirely (lines 13–19).
Remove `const isAuthed = ...` (line 21).
Remove `const router = useRouter()` (line 11).

Change the upload button's `onClick`:
```tsx
onClick={() => router.push("/dashboard")}
```
to:
```tsx
onClick={() => { window.location.href = "/dashboard" }}
```
Or since we're removing `router`, just use an `<a>` tag or `Link` wrapping the button. Simplest: replace the `<button onClick={handleUploadClick}>` with a `<Link href="/dashboard">` styled as the same button-like card.

Actually the cleanest approach — replace the outer `<button onClick={...}>` with a `<Link href="/dashboard">` and apply the same className. Import `Link` is already imported.

**Step 4: Remove unused imports**

Remove `useRouter` from the import if no longer needed.
Remove `Upload` icon if still there (it is used inside the button card — keep it).

**Step 5: Verify TS + dev server**

```bash
cd "Project -1/frontend"
npx tsc --noEmit
```

**Step 6: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: make landing page open app without auth check"
```

---

## Task 8: Modify frontend/app/dashboard/page.tsx — remove auth guard, user header

**Files:**
- Modify: `frontend/app/dashboard/page.tsx`

**Step 1: Remove auth-related imports**

Remove:
```typescript
import { Avatar } from "@/components/Avatar"
import UserSearch from "@/components/UserSearch"
import { deleteSession, getProfile } from "@/lib/api"
import { clearAuth, getEmail, getToken } from "@/lib/auth"
```

Keep these imports:
```typescript
import { deleteSession } from "@/lib/api"  // ← NOT needed anymore; remove this too
```

Actually, `deleteSession` was only called in `handleLogout`. Remove it entirely.

The only API import needed is nothing from profile/social. The other components (FileUpload, etc.) call the API directly via their own hooks.

Update the `@/lib/api` import to remove `deleteSession` and `getProfile`:
```typescript
// Remove the entire "import { deleteSession, getProfile } from "@/lib/api"" line
```

Also remove from lucide-react: `LogOut`, `Search` (no longer used).

**Step 2: Remove state variables**

Remove:
```typescript
const [username, setUsername]     = useState<string | null>(null)
const [avatarId, setAvatarId]     = useState(1)
const [searchOpen, setSearchOpen] = useState(false)
```

**Step 3: Remove the auth guard useEffect (lines 59–73)**

Delete the entire block:
```typescript
// Auth guard — redirect to /login if no token; also fetch avatar + username
useEffect(() => {
  if (!getToken()) {
    router.push("/login")
  } else {
    getProfile()
      .then((p) => { ... })
      .catch(() => { setUsername(getEmail()) })
  }
}, [router])
```

If `useEffect` is no longer needed at all (nothing else uses it), remove the import. Check if `useEffect` is used elsewhere in the file — it isn't, so remove it from the React import.

**Step 4: Remove handleLogout function (lines 91–98)**

Delete:
```typescript
const handleLogout = async () => {
  if (sessionId) {
    try { await deleteSession(sessionId) } catch { /* best-effort */ }
  }
  clearAuth()
  reset()
  router.push("/")
}
```

**Step 5: Remove router if no longer used**

Check if `router` is used anywhere else in the component after removing the auth guard and logout. If not (it isn't), remove:
```typescript
const router = useRouter()
```
And remove `useRouter` from the import.

Also remove `Link` import if no longer used (it was used for the profile avatar link — which we're removing).

**Step 6: Simplify the header**

Replace the right side of the header (`<div className="flex items-center gap-4">`) — remove:
- Search button
- The `border-l` section containing: username display, avatar link, logout button

Keep only:
- `{sessionId && <StepIndicator />}`
- The Reset button (`{sessionId && <button onClick={reset}>Reset</button>}`)

New right side of header:
```tsx
<div className="flex items-center gap-4">
  {sessionId && <StepIndicator />}
  {sessionId && (
    <button
      onClick={reset}
      className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
    >
      <RotateCcw className="w-3.5 h-3.5" />
      Reset
    </button>
  )}
</div>
```

**Step 7: Remove UserSearch modal at the bottom**

Delete:
```tsx
{/* User search modal */}
<AnimatePresence>
  {searchOpen && <UserSearch onClose={() => setSearchOpen(false)} />}
</AnimatePresence>
```

If `AnimatePresence` is no longer used elsewhere in this file, remove the import. (It is only used for the UserSearch modal, so remove it.)

**Step 8: Clean up unused imports at top**

After all changes, the import block should look like:
```typescript
"use client"

import { useState } from "react"
import { RotateCcw, ChevronRight, ChevronLeft, Sparkles } from "lucide-react"
import PredictpyLogo from "@/components/PredictpyLogo"
import FileUpload from "@/components/FileUpload"
import DatasetPreview from "@/components/DatasetPreview"
import TargetSelector from "@/components/TargetSelector"
import FeatureRanking from "@/components/FeatureRanking"
import ScatterGrid from "@/components/ScatterGrid"
import CorrelationHeatmap from "@/components/CorrelationHeatmap"
import Histogram from "@/components/Histogram"
import StepIndicator from "@/components/StepIndicator"
import ModelTrainer from "@/components/ModelTrainer"
import ModelResults from "@/components/ModelResults"
import { useStore } from "@/store/useStore"
```

Note: `useState` may still be needed... check the component. After removing username/avatarId/searchOpen, there are no more `useState` calls. Remove it.

**Step 9: Verify TS + build**

```bash
cd "Project -1/frontend"
npx tsc --noEmit
```

**Step 10: Commit**

```bash
git add frontend/app/dashboard/page.tsx
git commit -m "feat: remove auth guard, logout, and user header from dashboard"
```

---

## Task 9: Remove next-auth from frontend/package.json

**Files:**
- Modify: `frontend/package.json`

**Step 1: Remove next-auth dependency**

Remove `"next-auth": "^5.0.0-beta.30"` from the `dependencies` section.

**Step 2: Uninstall and reinstall**

```bash
cd "Project -1/frontend"
npm uninstall next-auth
```

**Step 3: Verify dev server starts**

```bash
npm run dev
```

Expected: Dev server starts at `http://localhost:3000` with no import errors in the console.

Test the full flow:
1. Navigate to `http://localhost:3000` — landing page loads
2. Click "Open App" — goes to `/dashboard`
3. Upload a CSV — gets session_id, proceeds to preview
4. Step through: Preview → Target → Features → Charts → Model

**Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: remove next-auth dependency"
```

---

## Task 10: Final cleanup — verify no stale references

**Step 1: Search for leftover auth references**

```bash
grep -r "getToken\|clearAuth\|setAuth\|getEmail\|next-auth\|NextAuth\|SessionProvider\|useSession\|signIn\|signOut\|/login\|/signup\|/profile" "Project -1/frontend/app" "Project -1/frontend/components" "Project -1/frontend/lib" --include="*.tsx" --include="*.ts" -l
```

Expected: No files found (or only files that legitimately mention these in comments/strings).

**Step 2: Search for auth references in backend**

```bash
grep -r "from auth\|init_db\|get_current_user\|Depends" "Project -1/backend/main.py"
```

Expected: No results.

**Step 3: If any stray references exist**, fix them individually.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup of stale auth references"
```
