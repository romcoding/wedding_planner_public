/**
 * Frontend permissions helper
 * Checks if user has required permissions based on role
 */

// Define permissions for each role (should match backend)
const PERMISSIONS = {
  guest: [
    'view_own_profile',
    'update_own_profile',
    'view_own_rsvp',
    'update_own_rsvp',
  ],
  vendor: [
    'view_own_profile',
    'update_own_profile',
    'view_assigned_tasks',
    'update_assigned_tasks',
    'view_assigned_costs',
  ],
  planner: [
    'view_own_profile',
    'update_own_profile',
    'view_guests',
    'view_tasks',
    'create_tasks',
    'update_tasks',
    'view_costs',
    'create_costs',
    'update_costs',
    'view_events',
    'create_events',
    'update_events',
    'view_invitations',
    'send_invitations',
    'view_analytics',
  ],
  admin: [
    'view_own_profile',
    'update_own_profile',
    'view_guests',
    'create_guests',
    'update_guests',
    'delete_guests',
    'view_tasks',
    'create_tasks',
    'update_tasks',
    'delete_tasks',
    'view_costs',
    'create_costs',
    'update_costs',
    'delete_costs',
    'view_events',
    'create_events',
    'update_events',
    'delete_events',
    'view_invitations',
    'create_invitations',
    'send_invitations',
    'update_invitations',
    'view_venues',
    'create_venues',
    'update_venues',
    'delete_venues',
    'view_content',
    'create_content',
    'update_content',
    'delete_content',
    'view_analytics',
    'view_security_events',
    'manage_users',
  ],
  super_admin: [
    // All permissions from admin plus:
    'manage_all_users',
    'delete_users',
    'view_all_security_events',
    'manage_system_settings',
  ]
}

export function hasPermission(userRole, permission) {
  if (!userRole) return false
  
  // Super admin has all permissions
  if (userRole === 'super_admin') return true
  
  const rolePermissions = PERMISSIONS[userRole] || []
  return rolePermissions.includes(permission)
}

export function hasRole(userRole, requiredRole) {
  const roleHierarchy = {
    guest: 0,
    vendor: 1,
    planner: 2,
    admin: 3,
    super_admin: 4
  }
  
  const userLevel = roleHierarchy[userRole] || 0
  const requiredLevel = roleHierarchy[requiredRole] || 0
  
  return userLevel >= requiredLevel
}

export function getUserPermissions(userRole) {
  if (userRole === 'super_admin') {
    // Return all permissions
    const allPerms = new Set()
    Object.values(PERMISSIONS).forEach(perms => {
      perms.forEach(perm => allPerms.add(perm))
    })
    return Array.from(allPerms)
  }
  
  return PERMISSIONS[userRole] || []
}
