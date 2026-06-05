# Security Specification - LuxeFlow POS

## Data Invariants
1. **Authentication**: All read/write operations (except potentially public product views if any, but currently app is internal) require a valid authenticated user.
2. **Product Integrity**: Products must have a name, SKU, and non-negative stock and prices.
3. **Order Integrity**: Orders must contain at least one item and have a total amount matching the sum of items.
4. **User Roles**: Only admins can delete products or view all shop settings (if complex RBAC is added). For now, basic staff/admin roles.
5. **Timestamp Integrity**: `createdAt` and `updatedAt` must be set by the server.

## The "Dirty Dozen" Payloads (Unauthorized/Illegal attempts)

1. **Unauthenticated Read**: Attempting to read `products` without a login.
2. **Identity Spoofing**: User A trying to write a product with `ownerId` set to User B.
3. **Negative Stock**: Creating a product with `stock: -5`.
4. **Price Manipulation**: Updating an order's `totalAmount` to be `0` while items exist.
5. **SKU Duplication**: (Harder to enforce purely in rules without a central index, but can be checked via exists).
6. **Orphaned Order**: Creating an order for a `productId` that does not exist.
7. **Bypassing Terminal State**: Changing an order status from `completed` to `pending`.
8. **Shadow Field Injection**: Adding `isPromoted: true` to a product when that field isn't in the schema.
9. **Admin Elevation**: User trying to update their own `role` to `admin`.
10. **Resource Poisoning**: Sending a 1MB string for a product name.
11. **Timestamp Faking**: Providing a client-side `createdAt` date from 2001.
12. **Public PII Access**: Authenticated User A trying to read User B's private profile.

## Test Runner Plan
Since I cannot run a full Jest/Vitest suite easily in this turn-by-turn mode without setting up the whole test env, I will focus on the hardened rule definitions and use manual verification/linting.
