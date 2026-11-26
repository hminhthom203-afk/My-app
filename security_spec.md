# Security Specification — Ăn Kẹo Hong

## 1. Data Invariants
1. **Single Like Per User**: A user (`request.auth.uid`) can hold at most one document under `characters/{charId}/likes/{userId}` where `userId == request.auth.uid`, and `likesCount` on `characters/{charId}` must change atomically by `+1` or `-1` in the same batch (`existsAfter`/`getAfter`).
2. **Comment Ownership & Parent Existence**: Comments under `characters/{charId}/comments/{commentId}` can only be created by verified signed-in users for an existing character (`exists(...)`), with `authorUid == request.auth.uid`. Only the comment owner (modifying only `content` and `updatedAt`) or admin can edit/delete a comment.
3. **Admin Exclusivity**: Only the verified admin (`hminhthom203@gmail.com` with `email_verified == true`) can create, edit, or delete characters and music tracks.
4. **View Count Integrity**: Opening a character detail page may only increment `viewsCount` by exactly `+1` (`incoming().viewsCount == existing().viewsCount + 1`) with no other fields modified.
5. **PII Isolation**: User profiles (`users/{userId}`) containing `email` are readable/writable only by the owning user or admin; public `comments` do not store emails.

## 2. Dirty Dozen Payloads (Must All Return PERMISSION_DENIED)
1. **Unauthenticated Like**: Guest creates `characters/mochi/likes/anon` -> DENIED (`!isSignedIn()`).
2. **Spoofed Like UID**: User A creates `characters/mochi/likes/userB` -> DENIED (`userId == request.auth.uid`).
3. **Desynced Like Without Batch**: User A creates `characters/mochi/likes/userA` without incrementing `characters/mochi.likesCount` -> DENIED (`getAfter(...)` check).
4. **Double-Increment Like Attack**: User A updates `characters/mochi.likesCount` by `+5` -> DENIED (`likesCount == existing().likesCount + 1`).
5. **Unverified Email Spoof**: User with `email: 'hminhthom203@gmail.com'`, `email_verified: false` tries to create a character -> DENIED (`email_verified == true`).
6. **Non-Admin Character Create**: Normal viewer tries to create `characters/hacked` -> DENIED (`isAdmin()`).
7. **Shadow Field Injection on Comment**: User creates comment with extra `isAdmin: true` field -> DENIED (`keys().hasOnly(...)`).
8. **Comment Author Impersonation**: User A creates comment with `authorUid: 'userB'` -> DENIED (`authorUid == request.auth.uid`).
9. **Editing Someone Else's Comment**: User B updates User A's comment -> DENIED (`existing().authorUid == request.auth.uid`).
10. **Changing Comment `authorUid` or `createdAt` on Edit**: User A edits own comment and changes `createdAt` -> DENIED (`affectedKeys().hasOnly(['content', 'updatedAt'])`).
11. **Oversized Document ID Poisoning**: Creating a doc with 200-char ID or invalid characters -> DENIED (`isValidId()`).
12. **PII Leak Read**: User A reads `users/userB` -> DENIED (`request.auth.uid == userId || isAdmin()`).
