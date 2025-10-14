# Workspace Authorization System

## Overview

The AI Gateway implements workspace-scoped admin keys and authorization. **All admin keys are workspace-specific**, providing secure, isolated access to workspace-specific resources.

## Key Features

### 1. Workspace-Specific Admin Keys
- **Every admin key is associated with a workspace** (workspaceId is required)
- When creating a workspace, a unique admin key is automatically generated
- The key is shown **only once** during creation - save it securely
- Keys are workspace-scoped and only grant access to their associated workspace
- No global admin keys exist - all keys are isolated to their workspace

### 2. Bootstrap Admin Key
- Bootstrap script creates initial workspace AND workspace-specific admin key
- This key only has access to the bootstrap workspace
- To manage multiple workspaces, use the admin key for each workspace

### 3. Authorization Middleware
- New `workspaceAuth` middleware verifies admin key permissions
- Checks if the admin key has access to the requested workspace
- Returns `403 Forbidden` if permission is denied

## Database Changes

### Schema Update
The `admin_keys` table now includes:
```typescript
workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' })
```

- **Required field**: All admin keys must be associated with a workspace
- **Cascade delete**: Deleting a workspace removes its admin keys
- **Indexed**: For efficient workspace-based lookups

## API Behavior

### Workspace Operations

**List Workspaces** (No workspace header required):
- `GET /v1/admin/workspaces` - Returns only the workspace associated with the admin key
- Each admin key can only see its own workspace

**Create Workspace** (No workspace header required):
- `POST /v1/admin/workspaces` - Creates new workspace with dedicated admin key
- Returns the generated admin key (shown only once)

**Workspace-Specific Operations** (Requires workspace auth):
- All other workspace endpoints require `x-axon-workspace-id` header
- Admin key must match the requested workspace
- Provider keys, virtual keys, prompts, users, etc.

### Response Changes

**Creating a Workspace** now returns:
```json
{
  "status": "success",
  "data": {
    "workspace": {
      "id": "workspace-uuid",
      "name": "Production",
      "description": "...",
      ...
    },
    "adminKey": {
      "id": "key-uuid",
      "plainKey": "ak_..."
    }
  }
}
```

The `plainKey` is **only returned once**. Store it securely.

## Admin Panel Updates

### Workspace Creation Flow
1. User creates workspace via UI or quick-create button
2. System generates workspace and admin key
3. **Modal displays the admin key** with:
   - Warning banner (only shown once)
   - Copy-to-clipboard button
   - Monospace display for easy reading
4. User must acknowledge saving the key

### Top Bar Features
- Quick-create button (+) next to workspace selector
- Immediate admin key display after creation
- Seamless workspace switching

## Migration Guide

### For Existing Installations

**Database Migration:**
```bash
# The workspaceId field is now required (NOT NULL)
# Existing admin keys must be associated with a workspace
# You may need to recreate admin keys with workspace associations
```

**Important:** If upgrading from a version without workspace-scoped keys:
1. Run bootstrap script to create initial workspace with admin key
2. Existing admin keys without workspaceId will need to be recreated
3. Each workspace needs its own admin key

**Testing:**
1. Bootstrap creates workspace with associated admin key
2. Create a new workspace - verify admin key is generated
3. Try accessing workspace with wrong key - should get 403
4. Each admin key can only see and manage its own workspace

## Security Best Practices

1. **Save Admin Keys Securely**
   - Use password managers or secret vaults
   - Never commit keys to version control
   - Rotate keys periodically
   - Each workspace has its own admin key - keep them separate

2. **Workspace Isolation**
   - Each workspace's data is completely isolated
   - Admin keys are strictly scoped to their workspace
   - No cross-workspace access is possible
   - Audit access logs regularly

3. **Key Management**
   - Each workspace should have dedicated administrators
   - Share admin keys only with authorized team members for that workspace
   - Delete unused keys promptly
   - Create new workspaces for different teams/projects

## Logging

All authorization events are logged with consistent format:
```
[timestamp] [WorkspaceAuth] [INFO/WARN] message
```

Examples:
- `Global admin key accessing workspace: workspace-id`
- `Workspace-specific admin key authorized for workspace: workspace-id`
- `Insufficient permissions: admin key X attempted to access workspace Y`

## Error Responses

**403 Forbidden** - Insufficient Permissions:
```json
{
  "status": "failure",
  "message": "Insufficient permissions for this workspace"
}
```

**401 Unauthorized** - Invalid/Missing Admin Key:
```json
{
  "status": "failure",
  "message": "Admin authentication required"
}
```

## Implementation Details

### Middleware Chain
```
adminKeyAuth → workspaceContext → workspaceAuth → handler
```

1. **adminKeyAuth**: Validates admin key, sets `c.adminKey`
2. **workspaceContext**: Loads workspace from header
3. **workspaceAuth**: Verifies permission to access workspace
4. **handler**: Executes business logic

### Permission Logic
```typescript
if (no workspaceId in request) {
  continue; // Operations like listing/creating workspaces
}

// All admin keys have workspaceId (required field)
if (adminKey.workspaceId !== requestedWorkspaceId) {
  return 403; // Insufficient permissions
}

continue; // Authorized
```

## Usage Examples

### Creating a Workspace with cURL
```bash
# Use admin key from an existing workspace (like bootstrap workspace)
curl -X POST http://localhost:8787/v1/admin/workspaces \
  -H "x-axon-admin-key: ak_bootstrap_or_existing_workspace_key" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production",
    "description": "Production workspace"
  }'
```

Response includes the new workspace's admin key (save it!).

### Using Admin Key to Access Workspace
```bash
# Admin key can only access its own workspace
curl http://localhost:8787/v1/admin/provider-keys \
  -H "x-axon-admin-key: ak_workspace_key" \
  -H "x-axon-workspace-id: matching-workspace-uuid"
```

### Listing Workspaces
```bash
# Returns only the workspace associated with the admin key
curl http://localhost:8787/v1/admin/workspaces \
  -H "x-axon-admin-key: ak_workspace_key"
```

## Troubleshooting

**Problem**: Getting 403 errors after creating workspace
- **Solution**: Ensure you're using the correct admin key for that workspace and the workspace ID header matches

**Problem**: Admin key not showing after workspace creation
- **Solution**: Key only displays once. You'll need to create another workspace or manage the existing one with the current key

**Problem**: Cannot access any workspaces with bootstrap key
- **Solution**: Bootstrap key is tied to the bootstrap workspace. Use that workspace's admin key to create additional workspaces

**Problem**: Cannot see other workspaces when listing
- **Solution**: This is by design - each admin key only sees its own workspace for security isolation

## Future Enhancements

Potential improvements:
- Admin key regeneration API
- Admin key expiration policies
- Role-based permissions within workspaces
- Multi-workspace admin keys (allow access to specific set of workspaces)
- Audit trail for admin key usage

