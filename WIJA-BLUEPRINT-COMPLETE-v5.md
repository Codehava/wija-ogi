# 📘 WIJA - BLUEPRINT LENGKAP v5.0

## Warisan Jejak Keluarga - Family Tree Application

> Aplikasi Pohon Keluarga Digital dengan Arsitektur Multitenant, Aksara Latin & Aksara Lontara (Auto-Transliterasi)

---

# 📑 DAFTAR ISI

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [App Flow](#5-app-flow)
6. [Features](#6-features)
7. [UI/UX Design](#7-uiux-design)
8. [Authentication](#8-authentication)
9. [Multitenant](#9-multitenant)
10. [Export System](#10-export-system)
11. [Aksara Lontara](#11-aksara-lontara)
12. [Deployment](#12-deployment)
13. [Development Guidelines](#13-development-guidelines)

---

# 1. EXECUTIVE SUMMARY

## 🌟 Ringkasan Eksekutif

**WIJA** (Warisan Jejak Keluarga) adalah aplikasi Pohon Keluarga Digital modern dengan:
- Arsitektur **multitenant** (setiap keluarga = 1 tenant)
- Mendukung hingga **30-40 generasi** (kalkulasi dinamis)
- **Dual aksara**: Latin & Lontara dengan auto-transliterasi
- **Real-time collaboration** antar anggota keluarga

## ⚠️ PERUBAHAN UTAMA v5.0

| Perubahan | Sebelum | Sesudah |
|-----------|---------|---------|
| Field `generation` | Disimpan di database | **DIHAPUS** - dikalkulasi runtime |
| Transliterasi | Manual | **AUTO** dari Latin ke Lontara |
| Huruf Asing | Tidak didukung | **11+ huruf** dengan pendekatan fonologis |

## 🎯 Vision & Mission

### Vision
Menjadi platform terdepan untuk preservasi dan dokumentasi sejarah keluarga di Indonesia dengan teknologi modern dan penghormatan terhadap budaya lokal.

### Mission
- Memudahkan keluarga mendokumentasikan silsilah hingga puluhan generasi
- Melestarikan aksara tradisional melalui teknologi digital
- Menyediakan platform kolaborasi keluarga yang aman dan real-time

## 💎 Keunggulan Utama

| Feature | Description | Technology |
|---------|-------------|------------|
| 🏠 **Multitenant** | Setiap keluarga punya workspace terpisah | PostgreSQL Collections |
| 🔄 **Dynamic Generation** | Generasi dihitung dari relationships | BFS Algorithm |
| 📜 **Dual Aksara** | Latin & Lontara auto-transliteration | Unicode + Custom Engine |
| 🌐 **Foreign Letters** | F, V, Z, X, dll dengan pendekatan fonologis | Phonetic Mapping |
| 🔥 **Real-time Sync** | Perubahan langsung terlihat semua user | PostgreSQL Real-time |
| 📱 **Mobile Ready** | Responsive design & PWA support | Next.js + TailwindCSS |

## 🔥 Tech Stack

### Frontend
```
Next.js 15        - React framework, SSR, App Router
React 18          - UI library dengan hooks
TypeScript 5      - Type safety
TailwindCSS 3     - Utility-first CSS
shadcn/ui         - Component library
D3.js 7           - Tree visualization
React Flow 11     - Canvas & node management
Zustand 4         - Client state management
TanStack Query 5  - Server state & caching
```

### Backend (PostgreSQL + NextAuth)
```
PostgreSQL + NextAuth Auth     - Email/Password, Google, Facebook OAuth
Cloud PostgreSQL   - NoSQL database, real-time sync
PostgreSQL + NextAuth Storage  - Photos, PDFs, assets
Cloud Functions   - Serverless backend
PostgreSQL + NextAuth Hosting  - CDN, SSL, custom domain
```

### Aksara Support
```
Noto Sans Buginese - Font Lontara (Unicode)
Custom Engine      - Transliterasi Latin → Lontara
Unicode Block      - U+1A00 - U+1A1F (Buginese)
```

---

# 2. SYSTEM ARCHITECTURE

## 📐 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                          CLIENT LAYER                          │
├────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────┐  │
│  │   Web Browser    │  │   Mobile App     │  │  Desktop    │  │
│  │   (Next.js PWA)  │  │ (React Native)   │  │   (Tauri)   │  │
│  └──────────────────┘  └──────────────────┘  └─────────────┘  │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                           │
├────────────────────────────────────────────────────────────────┤
│  Next.js 15 + React 18 + TypeScript                           │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │  Transliteration Engine  │  Generation Calculator       │  │
│  │  (Latin → Lontara)       │  (BFS from relationships)    │  │
│  └─────────────────────────────────────────────────────────┘  │
│  Zustand (State) + TanStack Query (Server State)              │
└────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────┐
│                     DATABASE & AUTH SERVICES                          │
├────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐   │
│  │   PostgreSQL + NextAuth      │  │   PostgreSQL     │  │   Storage    │   │
│  │  Authentication │  │    Database     │  │   (Files)    │   │
│  └─────────────────┘  └─────────────────┘  └──────────────┘   │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │              Cloud Functions (Serverless)                │ │
│  │  • PDF Export    • Email Triggers    • Data Processing   │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

## 🎯 Architecture Principles

1. **Serverless First** - PostgreSQL + NextAuth untuk mengurangi server management
2. **Real-time by Default** - PostgreSQL real-time listeners
3. **No Stored Generation** - Kalkulasi dinamis dari relationships
4. **Auto-Transliteration** - Latin ke Lontara secara otomatis
5. **Security by Design** - Row-level security per family

---

# 3. DATABASE SCHEMA

## ⚠️ PERUBAHAN PENTING: Field Generation DIHAPUS

```diff
interface Person {
- generation: number;           // DIHAPUS
- generationName?: string;      // DIHAPUS
+ isRootAncestor: boolean;      // BARU - untuk kalkulasi dinamis
}
```

## 📊 Collection Structure

```
PostgreSQL
│
├── families/                    # Tenant root
│   └── {familyId}/
│       ├── members/             # Family members (users)
│       ├── persons/             # Family tree nodes
│       ├── relationships/       # Spouse & parent-child
│       ├── activities/          # Activity logs
│       └── exports/             # PDF exports
│
├── users/                       # Global user profiles
│
├── invitations/                 # Pending invitations
│
└── subscriptions/               # Billing
```

## 1️⃣ Family Document

```typescript
interface Family {
  familyId: string;
  name: string;                  // "Keluarga Budiman"
  displayName: string;           // "Budiman Family Tree"
  slug: string;                  // "keluarga-budiman"
  
  ownerId: string;
  rootAncestorId?: string;       // Starting point for generation calc
  
  subscription: {
    plan: 'free' | 'basic' | 'premium' | 'enterprise';
    status: 'active' | 'cancelled' | 'expired' | 'trial';
  };
  
  settings: {
    script: 'latin' | 'lontara' | 'both';
    theme: 'light' | 'dark' | 'auto';
    language: 'id' | 'en';
  };
  
  // Stats (NO generationCount - calculated dynamically)
  stats: {
    memberCount: number;
    personCount: number;
    relationshipCount: number;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 2️⃣ Person Document (UPDATED - NO GENERATION FIELD)

```typescript
interface Person {
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
  latinName: {
    first: string;
    middle?: string;
    last: string;
  };
  
  lontaraName: {
    first: string;               // AUTO dari latinName
    middle?: string;
    last: string;
  };
  
  // Optional manual override
  lontaraNameCustom?: {
    first?: string;
    middle?: string;
    last?: string;
  };
  
  // ══════════════════════════════════════════════════════════
  // DEMOGRAPHICS
  // ══════════════════════════════════════════════════════════
  
  gender: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;            // YYYY-MM-DD
  birthPlace?: string;
  deathDate?: string;
  deathPlace?: string;
  isLiving: boolean;
  
  // ══════════════════════════════════════════════════════════
  // RELATIONSHIPS (Replaces static generation)
  // ══════════════════════════════════════════════════════════
  
  relationships: {
    spouseIds: string[];
    parentIds: string[];         // Max 2
    childIds: string[];
    siblingIds: string[];        // Computed
  };
  
  isRootAncestor: boolean;       // Flag for generation calc
  
  // ══════════════════════════════════════════════════════════
  // VISUALIZATION
  // ══════════════════════════════════════════════════════════
  
  position: {
    x: number;
    y: number;
    fixed: boolean;
  };
  
  // Audit
  createdBy: string;
  createdAt: Timestamp;
  updatedBy: string;
  updatedAt: Timestamp;
}
```

## 3️⃣ Relationship Document

```typescript
interface Relationship {
  relationshipId: string;
  familyId: string;
  
  type: 'spouse' | 'parent-child';
  
  person1Id: string;             // Parent or spouse
  person2Id: string;             // Child or spouse
  
  marriage?: {
    date?: string;
    place?: string;
    placeLontara?: string;       // Auto-transliterated
    status: 'married' | 'divorced' | 'widowed';
  };
  
  parentChild?: {
    biologicalParent: boolean;
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

## 🔄 Dynamic Generation Calculation

```typescript
/**
 * Calculate generation at RUNTIME (not stored)
 */
function calculateGeneration(
  personId: string,
  rootId: string,
  personsMap: Map<string, Person>
): number {
  const visited = new Set<string>();
  const queue = [{ id: rootId, gen: 1 }];
  
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    
    if (id === personId) return gen;
    
    const person = personsMap.get(id);
    if (!person) continue;
    
    // Add children (next generation)
    for (const childId of person.relationships.childIds) {
      if (!visited.has(childId)) {
        queue.push({ id: childId, gen: gen + 1 });
      }
    }
  }
  
  return -1; // Not connected
}

/**
 * Generation labels (Indonesian)
 */
function getGenerationLabel(gen: number): string {
  const labels: Record<number, string> = {
    1: 'Leluhur',
    2: 'Anak',
    3: 'Cucu',
    4: 'Cicit',
    5: 'Canggah',
    6: 'Wareng',
    7: 'Udeg-udeg',
    8: 'Gantung Siwur'
  };
  return labels[gen] || `Generasi ke-${gen}`;
}
```

---

# 4. API ROUTES

## 📡 REST API Endpoints

### Families

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/families` | List user's families |
| POST | `/api/families` | Create new family |
| GET | `/api/families/:id` | Get family details |
| PATCH | `/api/families/:id` | Update family |
| DELETE | `/api/families/:id` | Delete family |

### Persons

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/families/:id/persons` | List all persons |
| POST | `/api/families/:id/persons` | Create person |
| GET | `/api/families/:id/persons/:pid` | Get person |
| PATCH | `/api/families/:id/persons/:pid` | Update person |
| DELETE | `/api/families/:id/persons/:pid` | Delete person |

### Transliteration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transliterate` | Transliterate Latin to Lontara |
| GET | `/api/transliterate/reference` | Get character reference |

## 🔥 Cloud Functions

```typescript
// Person creation with auto-transliteration
export const onPersonCreate = functions.firestore
  .document('families/{familyId}/persons/{personId}')
  .onCreate(async (snap, context) => {
    const person = snap.data();
    
    // Auto-transliterate names
    const lontaraName = {
      first: transliterateLatin(person.latinName.first).lontara,
      middle: person.latinName.middle 
        ? transliterateLatin(person.latinName.middle).lontara 
        : undefined,
      last: transliterateLatin(person.latinName.last).lontara
    };
    
    await snap.ref.update({ lontaraName });
  });

// Export PDF with aksara support
export const exportPDF = functions.https.onCall(async (data, context) => {
  const { familyId, options } = data;
  
  // Generate PDF with Lontara font support
  const pdf = await generateFamilyTreePDF(familyId, {
    script: options.script, // 'latin' | 'lontara' | 'both'
    includePhotos: options.includePhotos,
  });
  
  // Upload to Storage
  const url = await uploadToStorage(pdf, familyId);
  
  return { downloadUrl: url };
});
```

---

# 5. APP FLOW

## 📱 User Journey

```
┌─────────────────────────────────────────────────────────────┐
│                     Landing Page                             │
│  "Buat Pohon Keluarga Gratis"                               │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
     ┌─────────────────┐
     │  Sign Up / Login│ ──► PostgreSQL + NextAuth Auth
     └────────┬────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────────┐
│                 Family Selection                             │
│  • Create New Family                                         │
│  • Join via Invitation                                       │
│  • Select Existing Family                                    │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Dashboard                                 │
│  ┌────────────┬─────────────┬─────────────┬──────────────┐ │
│  │ 🌳 Tree    │ 👥 Members  │ ✍️ Translit │ 📊 Stats    │ │
│  └────────────┴─────────────┴─────────────┴──────────────┘ │
│                                                              │
│  [Interactive Family Tree Canvas with Dual Script]          │
└─────────────────────────────────────────────────────────────┘
```

## 🔄 Add Person Flow

```
1. Click "Add Person"
   │
   ▼
2. Fill Form (Latin names)
   ├─ First Name *
   ├─ Last Name *
   ├─ Gender *
   ├─ Birth Date
   └─ Birth Place
   │
   ▼
3. Auto-Transliteration
   ├─ latinName.first → lontaraName.first
   ├─ latinName.last → lontaraName.last
   └─ Show preview in modal
   │
   ▼
4. Save to PostgreSQL
   ├─ Create person document
   ├─ Update relationships
   └─ Trigger Cloud Function for additional processing
   │
   ▼
5. Tree Updates
   ├─ Calculate generation dynamically
   ├─ Position node on canvas
   └─ Draw connection lines
```

---

# 6. FEATURES

## 🌟 Core Features

### 1. Family Tree Visualization
- **Interactive Canvas** dengan D3.js / React Flow
- **Drag & Drop** untuk positioning nodes
- **Zoom & Pan** dengan gesture support
- **Dual Script Display** (Latin / Lontara / Both)

### 2. Person Management
- **CRUD Operations** untuk anggota keluarga
- **Auto-Transliteration** nama ke Lontara
- **Photo Management** dengan thumbnail
- **Biography** dalam Latin dan Lontara

### 3. Relationship Management
- **Spouse Connection** dengan marriage details
- **Parent-Child Links** dengan biological flag
- **Visual Connection Lines** pada canvas

### 4. Generation System (DYNAMIC)
- **No Stored Field** - dihitung dari relationships
- **BFS Algorithm** dari root ancestor
- **Indonesian Labels** (Leluhur, Anak, Cucu, etc.)

### 5. Aksara Lontara
- **Auto-Transliteration Engine**
- **Virtual Keyboard** untuk input langsung
- **Foreign Letter Support** (F, V, Z, X, etc.)
- **Reference Guide** dalam app

### 6. Export System
- **PDF Export** dengan aksara support
- **Image Export** (PNG, SVG)
- **Custom Templates**

## 📊 Feature Matrix by Plan

| Feature | Free | Basic | Premium |
|---------|------|-------|---------|
| Persons | 100 | 500 | Unlimited |
| Photos per person | 3 | 5 | 10 |
| Storage | 1 GB | 5 GB | 50 GB |
| PDF Exports/month | 5 | 20 | Unlimited |
| Real-time Sync | ✅ | ✅ | ✅ |
| Lontara Support | ✅ | ✅ | ✅ |
| Custom Templates | ❌ | ✅ | ✅ |
| API Access | ❌ | ❌ | ✅ |

---

# 7. UI/UX DESIGN

## 🎨 Design Philosophy

1. **Clarity Over Complexity** - Interface bersih dan mudah dipahami
2. **Cultural Respect** - Desain menghormati tradisi keluarga Indonesia
3. **Accessibility First** - Dapat diakses semua kalangan usia
4. **Dual Script Native** - Lontara bukan afterthought

## 🎯 Color System

```css
/* Brand Colors */
--wija-primary: #FAB034;         /* Amber/Gold */
--wija-secondary: #F89F1F;
--wija-accent: #E68A0F;

/* Gender Colors */
--node-male: #3B82F6;            /* Blue */
--node-female: #EC4899;          /* Pink */

/* Script Colors */
--lontara-text: #92400E;         /* Amber-800 */
--lontara-bg: #FEF3C7;           /* Amber-100 */
```

## 📱 Component Library

### Tree Node

```tsx
<TreeNode
  person={person}
  scriptMode="both"              // 'latin' | 'lontara' | 'both'
  generation={calculatedGen}     // Computed, not stored
  selected={isSelected}
  onClick={handleSelect}
/>
```

### Dual Script Display

```tsx
<DualScriptDisplay
  latinText="Budiman"
  displayMode="both"
  size="lg"
/>
// Output:
// Budiman
// ᨅᨘᨉᨗᨆᨊ
```

### Lontara Input

```tsx
<LontaraInput
  value={name}
  onChange={(latin, lontara) => {
    setLatinName(latin);
    setLontaraName(lontara);   // Auto-generated
  }}
  showPreview={true}
  showKeyboard={true}
/>
```

---

# 8. AUTHENTICATION

## 🔐 PostgreSQL + NextAuth Auth Implementation

### Supported Methods
- Email/Password with verification
- Google OAuth 2.0
- Facebook Login
- Apple Sign In (iOS)

### Custom Claims

```typescript
interface UserClaims {
  familyId: string;
  role: 'owner' | 'admin' | 'editor' | 'viewer';
  permissions: string[];
}
```

### Role Permissions

| Permission | Owner | Admin | Editor | Viewer |
|------------|-------|-------|--------|--------|
| View tree | ✅ | ✅ | ✅ | ✅ |
| Create person | ✅ | ✅ | ✅ | ❌ |
| Edit person | ✅ | ✅ | ✅ | ❌ |
| Delete person | ✅ | ✅ | ❌ | ❌ |
| Manage relationships | ✅ | ✅ | ✅ | ❌ |
| Invite members | ✅ | ✅ | ❌ | ❌ |
| Remove members | ✅ | ✅ | ❌ | ❌ |
| Edit family settings | ✅ | ❌ | ❌ | ❌ |
| Delete family | ✅ | ❌ | ❌ | ❌ |

---

# 9. MULTITENANT

## 🏠 Tenant Model

```
Tenant = Family
  ├── Isolated data in subcollections
  ├── Separate storage folders
  ├── Independent subscriptions
  └── Role-based access per family
```

## 🔐 Security Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    function isFamilyMember(familyId) {
      return request.auth != null && 
        exists(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid));
    }
    
    function canEdit(familyId) {
      let role = get(/databases/$(database)/documents/families/$(familyId)/members/$(request.auth.uid)).data.role;
      return role in ['owner', 'admin', 'editor'];
    }
    
    match /families/{familyId} {
      allow read: if isFamilyMember(familyId);
      allow create: if request.auth != null;
      
      match /persons/{personId} {
        allow read: if isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
      
      match /relationships/{relId} {
        allow read: if isFamilyMember(familyId);
        allow write: if canEdit(familyId);
      }
    }
  }
}
```

---

# 10. EXPORT SYSTEM

## 📄 PDF Export

```typescript
interface ExportOptions {
  scope: 'full' | 'from_ancestor' | 'subtree';
  rootPersonId?: string;
  
  scriptOptions: {
    script: 'latin' | 'lontara' | 'both';
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
```

## 🖼️ Image Export

- PNG (raster)
- SVG (vector)
- High-resolution support

---

# 11. AKSARA LONTARA

## 📜 Overview

**Aksara Lontara** (ᨒᨚᨈᨑ) adalah sistem penulisan tradisional suku Bugis, Makassar, dan Mandar di Sulawesi Selatan.

## 🔤 Aksara Dasar

### Konsonan (23 Aksara)

| Latin | Lontara | Latin | Lontara | Latin | Lontara |
|-------|---------|-------|---------|-------|---------|
| ka | ᨀ | ga | ᨁ | nga | ᨂ |
| ngka | ᨃ | pa | ᨄ | ba | ᨅ |
| ma | ᨆ | mpa | ᨇ | ta | ᨈ |
| da | ᨉ | na | ᨊ | nra | ᨋ |
| ca | ᨌ | ja | ᨍ | nya | ᨎ |
| nca | ᨏ | ya | ᨐ | ra | ᨑ |
| la | ᨒ | wa | ᨓ | sa | ᨔ |
| a | ᨕ | ha | ᨖ | | |

### Vokal Mandiri

| Latin | Lontara |
|-------|---------|
| a | ᨕ |
| i | ᨕᨗ |
| u | ᨕᨘ |
| e | ᨕᨙ |
| o | ᨕᨚ |

### Tanda Vokal (Diacritics)

| Vokal | Tanda | Posisi |
|-------|-------|--------|
| i | ᨗ | Atas |
| u | ᨘ | Bawah |
| e | ᨙ | Depan |
| o | ᨚ | Belakang |
| a | - | Inherent |

## 🌐 Huruf Asing (Foreign Letters)

Aksara Lontara tidak memiliki huruf untuk beberapa bunyi asing. WIJA menggunakan **pendekatan fonologis**:

| Latin | Lontara | Substitusi | Penjelasan |
|-------|---------|------------|------------|
| **F** | ᨄ (PA) | /f/ → /p/ | Labiodental → Bilabial |
| **V** | ᨅ (BA) | /v/ → /b/ | Labiodental bersuara → Bilabial |
| **Z** | ᨍ (JA) | /z/ → /j/ | Frikatif → Afrikat |
| **X** | ᨀᨔ | /ks/ | Gabungan KA + SA |
| **Q** | ᨀ (KA) | /q/ → /k/ | Uvular → Velar |
| **KH** | ᨖ (HA) | /x/ → /h/ | Velar frikatif → Glotal |
| **GH** | ᨁ (GA) | /ɣ/ → /g/ | Velar frikatif bersuara |
| **TH** | ᨈ (TA) | /θ/ → /t/ | Dental frikatif |
| **DH** | ᨉ (DA) | /ð/ → /d/ | Dental bersuara |
| **SY** | ᨔ (SA) | /ʃ/ → /s/ | Postalveolar |
| **TS** | ᨌ (CA) | /ts/ → /c/ | Afrikat |

### Diagram Substitusi

```
LABIODENTAL → BILABIAL
┌─────┐      ┌─────┐
│  F  │ ───► │  P  │  ᨄ
│  V  │ ───► │  B  │  ᨅ
└─────┘      └─────┘

ALVEOLAR → AFRIKAT
┌─────┐      ┌─────┐
│  Z  │ ───► │  J  │  ᨍ
└─────┘      └─────┘

CLUSTER → GABUNGAN
┌─────┐      ┌──────────┐
│  X  │ ───► │  K + S   │  ᨀᨔ
└─────┘      └──────────┘
```

## ⚙️ Transliteration Engine

```typescript
const LONTARA_CONFIG = {
  consonantBase: {
    'k': 'ᨀ', 'g': 'ᨁ', 'ng': 'ᨂ',
    'p': 'ᨄ', 'b': 'ᨅ', 'm': 'ᨆ',
    't': 'ᨈ', 'd': 'ᨉ', 'n': 'ᨊ',
    'c': 'ᨌ', 'j': 'ᨍ', 'ny': 'ᨎ',
    'y': 'ᨐ', 'r': 'ᨑ', 'l': 'ᨒ', 
    'w': 'ᨓ', 's': 'ᨔ', 'h': 'ᨖ'
  },
  
  vowelMarkers: {
    'i': 'ᨗ', 'u': 'ᨘ', 'e': 'ᨙ', 'o': 'ᨚ'
  },
  
  foreignLetters: {
    'f': { lontara: 'ᨄ', base: 'p' },
    'v': { lontara: 'ᨅ', base: 'b' },
    'z': { lontara: 'ᨍ', base: 'j' },
    'x': { lontara: 'ᨀᨔ', base: 'ks' },
    'q': { lontara: 'ᨀ', base: 'k' },
    // ... more
  }
};

function transliterate(text: string): TransliterationResult {
  // 1. Parse input character by character
  // 2. Match clusters, digraphs, foreign letters
  // 3. Apply consonant + vowel marker rules
  // 4. Return Lontara output + details
}
```

### Contoh Transliterasi

| Latin | Lontara | Keterangan |
|-------|---------|------------|
| Budiman | ᨅᨘᨉᨗᨆᨊ | Nama biasa |
| Sulawesi | ᨔᨘᨒᨓᨙᨔᨗ | Nama tempat |
| Festival | ᨄᨙᨔᨈᨗᨅᨒ | F → P |
| Vaksin | ᨅᨀᨔᨗᨊ | V → B |
| Zaman | ᨍᨆᨊ | Z → J |

---

# 12. DEPLOYMENT

## 🚀 Environment Setup

```
Development:  wija-dev.web.app
Staging:      staging.wija.app
Production:   wija.app
```

## 📦 CI/CD Pipeline

```
GitHub Repository
    │
    ├─ main branch
    │   └─► Deploy to Production
    │
    ├─ develop branch
    │   └─► Deploy to Staging
    │
    └─ feature/* branches
        └─► Run tests only
```

## 🔧 Build Commands

```bash
# Install dependencies
pnpm install

# Development
pnpm dev

# Build
pnpm build

# Deploy
firebase deploy

# Deploy functions only
firebase deploy --only functions
```

---

# 13. DEVELOPMENT GUIDELINES

## 📁 Project Structure

```
src/
├── app/                          # Next.js App Router
├── components/
│   ├── ui/                       # Base components
│   ├── tree/                     # Tree visualization
│   ├── person/                   # Person components
│   └── aksara/                   # Lontara components
├── lib/
│   ├── firebase/                 # PostgreSQL + NextAuth config
│   ├── transliteration/          # Transliteration engine
│   └── generation/               # Generation calculator
├── hooks/
├── stores/                       # Zustand
├── types/
└── styles/
```

## ✅ Coding Standards

### DO ✅
```typescript
// Calculate generation at runtime
const generation = calculateGeneration(personId, rootId, personsMap);

// Auto-transliterate names
const { lontara } = transliterateLatin(person.firstName);

// Use hooks for memoization
const translitResult = useMemo(
  () => transliterateLatin(text),
  [text]
);
```

### DON'T ❌
```typescript
// NEVER store generation in database
await setDoc(personRef, {
  generation: 3,  // ❌ WRONG
});

// NEVER skip transliteration
person.lontaraName = ''; // ❌ WRONG - should auto-generate
```

## 🧪 Testing Checklist

- [ ] Transliteration: basic syllables
- [ ] Transliteration: foreign letters (F, V, Z, X, etc.)
- [ ] Generation calculation: linear tree
- [ ] Generation calculation: multiple spouses
- [ ] Generation calculation: disconnected nodes
- [ ] Dual script display: all modes
- [ ] PDF export: with Lontara font

---

# 📋 APPENDIX

## A. Migration Script (Remove Generation Field)

```typescript
async function migrateRemoveGeneration() {
  const families = await db.collection('families').get();
  
  for (const family of families.docs) {
    const persons = await family.ref.collection('persons').get();
    const batch = db.batch();
    
    for (const person of persons.docs) {
      const data = person.data();
      const isRoot = !data.relationships?.parentIds?.length;
      
      batch.update(person.ref, {
        generation: FieldValue.delete(),
        generationName: FieldValue.delete(),
        isRootAncestor: isRoot
      });
    }
    
    await batch.commit();
  }
}
```

## B. Font Installation

```css
/* Import from Google Fonts */
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Buginese&display=swap');

.font-lontara {
  font-family: 'Noto Sans Buginese', serif;
}
```

## C. Unicode Reference

```
Buginese Block: U+1A00 - U+1A1F

U+1A00  ᨀ  KA
U+1A01  ᨁ  GA
U+1A02  ᨂ  NGA
U+1A03  ᨃ  NGKA
U+1A04  ᨄ  PA
U+1A05  ᨅ  BA
U+1A06  ᨆ  MA
U+1A07  ᨇ  MPA
U+1A08  ᨈ  TA
U+1A09  ᨉ  DA
U+1A0A  ᨊ  NA
U+1A0B  ᨋ  NRA
U+1A0C  ᨌ  CA
U+1A0D  ᨍ  JA
U+1A0E  ᨎ  NYA
U+1A0F  ᨏ  NCA
U+1A10  ᨐ  YA
U+1A11  ᨑ  RA
U+1A12  ᨒ  LA
U+1A13  ᨓ  WA
U+1A14  ᨔ  SA
U+1A15  ᨕ  A
U+1A16  ᨖ  HA
U+1A17  ᨗ  VOWEL I
U+1A18  ᨘ  VOWEL U
U+1A19  ᨙ  VOWEL E
U+1A1A  ᨚ  VOWEL O
U+1A1E  ᨞  PALLAWA (period)
U+1A1F  ᨟  END OF SECTION
```

---

**Document Version:** 5.0  
**Last Updated:** Desember 2025  
**Status:** ✅ Complete Blueprint

**Breaking Changes v5.0:**
- ❌ Removed `generation` field from Person
- ❌ Removed `generationName` field from Person
- ❌ Removed `generationCount` from Family stats
- ✅ Added `isRootAncestor` flag
- ✅ Added auto-transliteration engine
- ✅ Added foreign letter support (11+ letters)
- ✅ Added dynamic generation calculation

---

*Blueprint ini adalah living document yang akan terus diperbarui seiring development*

