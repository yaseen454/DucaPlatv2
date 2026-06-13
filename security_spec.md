# Security Specification & Adversarial TDD Spec

## Data Invariants
1. **User Ownership**: No user can read, create, modify, or delete another user's profile document (`/users/{userId}`).
2. **Subcollection Isolation**: All saved calculator configurations under `/users/{userId}/savedItems/{itemId}` are strictly scoped to the owner (`userId == request.auth.uid`). No cross-tenant reads or writes are allowed.
3. **Immutable History Fields**: In any saved items, fields like `id` and `source` are immutable.
4. **Input Size Bounds**: Saved names cannot exceed 100 characters in length.
5. **No Spoofing Roles**: No admin-privilege bypass.
6. **No Backdated Updates**: If updating, server timestamp verification is enforced.

---

## The "Dirty Dozen" Malicious Payloads

The following payloads represent attacker attempts to breach the system. All must return `PERMISSION_DENIED`:

### 1. The Cross-Identity Profile Hack
- **Target Path**: `/users/attacker_uid`
- **Attempt**: Attacker logs in under `attacker_uid` but attempts to write to `/users/victim_user_123` to overwrite user info.
- **Payload**:
  ```json
  {
    "uid": "victim_user_123",
    "email": "victim@gmail.com",
    "displayName": "Stolen Identity"
  }
  ```

### 2. The Unverified Email Escalation
- **Target Path**: `/users/unverified_user_123`
- **Attempt**: User has an unverified email address but attempts to perform writes requiring verification.
- **Payload**:
  ```json
  {
    "uid": "unverified_user_123",
    "email": "malicious@gmail.com"
  }
  ```

### 3. Cross-Tenant Subcollection Access
- **Target Path**: `/users/victim_user_123/savedItems/item_999`
- **Attempt**: Attacker attempts to list or read another user's saved items.
- **Expected Outcome**: Instant `PERMISSION_DENIED`.

### 4. Shadow Schema Injection (Ghost Fields)
- **Target Path**: `/users/attacker_uid/savedItems/item_1`
- **Attempt**: Attacker saves a set with schema-injection keys like `isAdmin: true` or `bypassed: true`.
- **Payload**:
  ```json
  {
    "id": "item_1",
    "name": "Standard Save",
    "source": "manual",
    "counts": { "gold": 1 },
    "totalDucats": 100,
    "totalItems": 1,
    "hasAdminOverride": true,
    "isModerator": true
  }
  ```

### 5. Rogue Metadata Injection (Invalid Fields)
- **Target Path**: `/users/attacker_uid/savedItems/item_1`
- **Attempt**: Inserting values that violate property restrictions (e.g. `totalDucats` is a Negative Number).
- **Payload**:
  ```json
  {
    "id": "item_1",
    "name": "Exploit Name",
    "source": "manual",
    "counts": { "gold": -500 },
    "totalDucats": -50000,
    "totalItems": -500
  }
  ```

### 6. Path Poisoning Attack
- **Target Path**: `/users/attacker_uid/savedItems/INVALID_CHAR%%$$**&&##_PATH`
- **Attempt**: Ingest massive non-alphanumeric unicode string as Document ID to exhaust indices.
- **Expected Outcome**: Blocked by `isValidId(itemId)` rule.

### 7. Name Size Exhaustion (Denial-of-Wallet)
- **Target Path**: `/users/attacker_uid/savedItems/item_1`
- **Attempt**: Overload database storage limits with a 10MB string as the configuration's name.
- **Payload**:
  ```json
  {
    "id": "item_1",
    "name": "[A repeating string of 100,000 characters...]",
    "source": "manual",
    "counts": { "gold": 1 },
    "totalDucats": 100,
    "totalItems": 1
  }
  ```

### 8. Self-Assigned Role Privilege Escalation
- **Target Path**: `/users/attacker_uid`
- **Attempt**: Forcing role/security flag changes on profile setup to achieve admin status.
- **Payload**:
  ```json
  {
    "uid": "attacker_uid",
    "isAdmin": true,
    "role": "super_admin"
  }
  ```

### 9. Mutating Immutable Fields (Chronological Forgery)
- **Target Path**: `/users/attacker_uid/savedItems/item_1`
- **Attempt**: Updating of `id` and `source` after creation.
- **Expected Outcome**: `PERMISSION_DENIED` on update since `id` and `source` cannot be mutated.

### 10. Temporal Spoofing (Backdated Submissions)
- **Target Path**: `/users/attacker_uid/savedItems/item_1`
- **Attempt**: Client inputs a manual/outdated custom date in the payload's `createdAt` field.
- **Payload**:
  ```json
  {
    "id": "item_1",
    "name": "Backdated",
    "source": "manual",
    "counts": { "gold": 1 },
    "totalDucats": 100,
    "totalItems": 1,
    "createdAt": "1994-06-13T11:00:00Z"
  }
  ```

### 11. Read Scrape Sweep / Blanket Query Leak
- **Target Path**: All profile lists
- **Attempt**: Scan all user docs using a basic authenticated connection.
- **Expected Outcome**: Blocked. Reads are explicitly bound to resource fields.

### 12. Deleting Relational Anchor Documents
- **Target Path**: `/users/victim_user_123`
- **Attempt**: Client-side wipe.
- **Expected Outcome**: Only owner can write/delete their own profile, with strict verification checks.
