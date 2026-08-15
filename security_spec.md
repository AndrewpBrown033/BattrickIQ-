# Security Specification (TDD) for BattrickIQ Firestore Rules

This document specifies the data invariants, security barriers, and verification payloads for securing BattrickIQ's Firestore database instance.

## 1. Data Invariants

1. **User Identity Invariant**: A manager can ONLY read, write, or listen to their own user document located at `/users/{userId}` where `{userId}` matches their authenticated `request.auth.uid`.
2. **PII and Ledger Privacy**: No manager can read or query other managers' private financial ledger, squad rating histories, or pitch settings.
3. **Custom Auth Isolation**: A user's plaintext credentials in `users_auth/{email}` must never be readable by anyone else, and creation of credentials must be restricted.
4. **Admin Escalation Block**: Regular managers are strictly forbidden from writing or modifying their own `role` fields in `users_auth` or impersonating another user's team data.
5. **Temporal Integrity**: All sync operations must record accurate system-generated timestamps.

---

## 2. The "Dirty Dozen" Payloads

Here are 12 specific malicious or malformed payloads designed to attempt to breach security lines, which MUST be successfully blocked (`PERMISSION_DENIED`) by the security rules:

### Collection: `users`

1. **Payload 01: Unauthorized Read (Eavesdropping)**
   - *Description*: Authenticated User `bt_manager123` attempts to fetch the profile / ledger of `bt_manager456`.
   - *Target Path*: `/users/bt_manager456`
   - *Method*: `get`
   - *Expected Outcome*: `PERMISSION_DENIED`

2. **Payload 02: Shadow Field Injection (Privilege Escalation)**
   - *Description*: User `bt_manager123` attempts to write a user document to their own profile, injecting a phantom admin permission or subscription flag.
   - *Target Path*: `/users/bt_manager123`
   - *Method*: `create`
   - *Payload*: `{ "email": "manager@bt.com", "teamName": "My Club", "isAdmin": true, "vipStatus": "unlimited" }`
   - *Expected Outcome*: `PERMISSION_DENIED` (due to exact schema size/key rules)

3. **Payload 03: Identity Spoofing on Create**
   - *Description*: Authenticated User `bt_manager123` attempts to create a document under `/users/bt_manager123` but sets the internal `email` field to the admin's email.
   - *Target Path*: `/users/bt_manager123`
   - *Method*: `create`
   - *Payload*: `{ "email": "andrewpbrown33@gmail.com", "teamName": "Fake Team" }`
   - *Expected Outcome*: `PERMISSION_DENIED` (User's auth email must match document email if field is defined)

4. **Payload 04: Rogue ID Poisoning**
   - *Description*: User attempts to write a document using an exceptionally long junk ID string to waste resource allocations.
   - *Target Path*: `/users/very_long_junk_string_garbage_characters_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa`
   - *Method*: `create`
   - *Expected Outcome*: `PERMISSION_DENIED`

5. **Payload 05: Unauthenticated Write**
   - *Description*: An unauthenticated guest client attempts to create a team profile.
   - *Target Path*: `/users/bt_guest`
   - *Method*: `create`
   - *Expected Outcome*: `PERMISSION_DENIED`

6. **Payload 06: Query Scraping / Blanket List**
   - *Description*: A manager attempts to query/list all documents in the `users` collection without specifying an owner constraint.
   - *Target Path*: `/users`
   - *Method*: `list`
   - *Expected Outcome*: `PERMISSION_DENIED`

### Collection: `users_auth`

7. **Payload 07: Plaintext Password Scraping**
   - *Description*: User `attacker@gmail.com` attempts to read the auth credentials of `andrewpbrown33@gmail.com` to compromise passwords.
   - *Target Path*: `/users_auth/andrewpbrown33@gmail.com`
   - *Method*: `get`
   - *Expected Outcome*: `PERMISSION_DENIED` (Reads are restricted to owner matching the verified login)

8. **Payload 08: Self-Assigned Role Escalation**
   - *Description*: User `regular@gmail.com` tries to update their own credentials document to change their role to `admin`.
   - *Target Path*: `/users_auth/regular@gmail.com`
   - *Method*: `update`
   - *Payload*: `{ "role": "admin" }`
   - *Expected Outcome*: `PERMISSION_DENIED`

9. **Payload 09: Duplicate Registration (Email Takeover)**
   - *Description*: User `attacker@gmail.com` attempts to overwrite an existing credential document for `victim@gmail.com`.
   - *Target Path*: `/users_auth/victim@gmail.com`
   - *Method*: `create`
   - *Expected Outcome*: `PERMISSION_DENIED` (Writes must enforce that the email matches request.auth or matches registration flow keys)

10. **Payload 10: Value Type Poisoning**
    - *Description*: Attacker attempts to update their user_auth metadata, replacing a string field with a 1MB nested dictionary of garbage characters.
    - *Target Path*: `/users_auth/attacker@gmail.com`
    - *Method*: `update`
    - *Payload*: `{ "password": { "garbage": "1MB string..." } }`
    - *Expected Outcome*: `PERMISSION_DENIED`

11. **Payload 11: Fake Verification Status Bypass**
    - *Description*: An attacker tries to write credentials pretending their email is verified without passing standard validation.
    - *Target Path*: `/users_auth/attacker@gmail.com`
    - *Method*: `create`
    - *Expected Outcome*: `PERMISSION_DENIED`

12. **Payload 12: Orphaned Auth Creation**
    - *Description*: An unauthenticated client attempts to seed dummy auth documents.
    - *Target Path*: `/users_auth/anonymous@gmail.com`
    - *Method*: `create`
    - *Expected Outcome*: `PERMISSION_DENIED`
