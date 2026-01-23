/**
 * Script to fix user role for natasa.stefanovic@mrgroup.rs
 * Run with: npx tsx scripts/fix-user-role.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const AUTH0_DOMAIN = 'mrengines-warrenty.eu.auth0.com';
const AUTH0_CLIENT_ID = 'EgvAbBiya279LpuLQajcprxJR5ZlDw3j';
const AUTH0_CLIENT_SECRET = 'xVPcFaWXOaFpqImnx-UupOXWcw6EtF41WKAniLW-Sfn_Z14wR9U6Ao5vXgyI9YN4';

const TARGET_EMAIL = 'natasa.stefanovic@mrgroup.rs';
const NEW_ROLE = 'ADMIN';

async function getManagementToken(): Promise<string> {
  const response = await fetch(`https://${AUTH0_DOMAIN}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: AUTH0_CLIENT_ID,
      client_secret: AUTH0_CLIENT_SECRET,
      audience: `https://${AUTH0_DOMAIN}/api/v2/`,
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get token: ${await response.text()}`);
  }

  const data = await response.json();
  return data.access_token;
}

async function getUserByEmail(token: string, email: string) {
  const response = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users-by-email?email=${encodeURIComponent(email)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get user: ${await response.text()}`);
  }

  const users = await response.json();
  return users[0] || null;
}

async function getUserRoles(token: string, userId: string) {
  const response = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to get roles: ${await response.text()}`);
  }

  return response.json();
}

async function getAllRoles(token: string) {
  const response = await fetch(`https://${AUTH0_DOMAIN}/api/v2/roles`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to get all roles: ${await response.text()}`);
  }

  return response.json();
}

async function removeUserRoles(token: string, userId: string, roleIds: string[]) {
  if (roleIds.length === 0) return;

  const response = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: roleIds }),
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to remove roles: ${await response.text()}`);
  }
}

async function assignUserRole(token: string, userId: string, roleId: string) {
  const response = await fetch(
    `https://${AUTH0_DOMAIN}/api/v2/users/${encodeURIComponent(userId)}/roles`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ roles: [roleId] }),
    }
  );

  if (!response.ok && response.status !== 204) {
    throw new Error(`Failed to assign role: ${await response.text()}`);
  }
}

async function main() {
  console.log('=== Fixing user role ===\n');

  // 1. Get Management API token
  console.log('1. Getting Auth0 Management API token...');
  const token = await getManagementToken();
  console.log('   ✓ Token obtained\n');

  // 2. Get all available roles
  console.log('2. Getting all available roles from Auth0...');
  const allRoles = await getAllRoles(token);
  console.log('   Available roles:');
  allRoles.forEach((r: any) => console.log(`   - ${r.name} (${r.id})`));
  console.log('');

  // 3. Find the target role
  const targetRole = allRoles.find((r: any) => r.name === NEW_ROLE);
  if (!targetRole) {
    console.error(`   ✗ Role "${NEW_ROLE}" not found in Auth0!`);
    console.log('   Please create it in Auth0 Dashboard first.');
    process.exit(1);
  }
  console.log(`   ✓ Target role found: ${targetRole.name} (${targetRole.id})\n`);

  // 4. Get user from Auth0
  console.log(`3. Finding user ${TARGET_EMAIL} in Auth0...`);
  const auth0User = await getUserByEmail(token, TARGET_EMAIL);
  if (!auth0User) {
    console.error(`   ✗ User not found in Auth0!`);
    process.exit(1);
  }
  console.log(`   ✓ User found: ${auth0User.user_id}\n`);

  // 5. Get current roles
  console.log('4. Getting current user roles...');
  const currentRoles = await getUserRoles(token, auth0User.user_id);
  console.log('   Current roles:');
  currentRoles.forEach((r: any) => console.log(`   - ${r.name} (${r.id})`));
  console.log('');

  // 6. Remove all current roles
  if (currentRoles.length > 0) {
    console.log('5. Removing current roles...');
    const roleIds = currentRoles.map((r: any) => r.id);
    await removeUserRoles(token, auth0User.user_id, roleIds);
    console.log('   ✓ Roles removed\n');
  }

  // Wait a bit to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 500));

  // 7. Assign new role
  console.log(`6. Assigning new role "${NEW_ROLE}"...`);
  await assignUserRole(token, auth0User.user_id, targetRole.id);
  console.log('   ✓ Role assigned\n');

  // 8. Verify new roles
  console.log('7. Verifying new roles...');
  await new Promise((resolve) => setTimeout(resolve, 500));
  const newRoles = await getUserRoles(token, auth0User.user_id);
  console.log('   New roles:');
  newRoles.forEach((r: any) => console.log(`   - ${r.name} (${r.id})`));
  console.log('');

  // 9. Update database
  console.log('8. Updating role in database...');
  const dbUser = await prisma.user.update({
    where: { email: TARGET_EMAIL },
    data: { role: NEW_ROLE },
  });
  console.log(`   ✓ Database updated: ${dbUser.email} -> ${dbUser.role}\n`);

  // 10. Check activity logs
  console.log('9. Checking activity logs in database...');
  const activityCount = await prisma.activityLog.count();
  console.log(`   Total activities: ${activityCount}`);
  
  const recentActivities = await prisma.activityLog.findMany({
    take: 5,
    orderBy: { createdAt: 'desc' },
  });
  
  if (recentActivities.length > 0) {
    console.log('   Recent activities:');
    recentActivities.forEach((a) => {
      console.log(`   - ${a.action} ${a.entityType} "${a.entityName}" by ${a.userEmail || 'system'} at ${a.createdAt}`);
    });
  } else {
    console.log('   No activities found in database!');
  }
  console.log('');

  console.log('=== Done! ===');
  console.log(`User ${TARGET_EMAIL} now has role: ${NEW_ROLE}`);
  console.log('The user should log out and log back in to see the changes.');

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Error:', error);
  prisma.$disconnect();
  process.exit(1);
});
