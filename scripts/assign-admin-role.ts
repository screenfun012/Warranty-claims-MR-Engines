/**
 * Script to assign ADMIN role to natasa.stefanovic@mrgroup.rs
 * Run with: npx tsx scripts/assign-admin-role.ts
 */

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
  return users;
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
  console.log('=== Assigning ADMIN role to Natasa ===\n');

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

  // 3. Find the ADMIN role
  const adminRole = allRoles.find((r: any) => r.name === NEW_ROLE);
  if (!adminRole) {
    console.error(`   ✗ Role "${NEW_ROLE}" not found in Auth0!`);
    process.exit(1);
  }
  console.log(`   ✓ ADMIN role found: ${adminRole.id}\n`);

  // 4. Get user from Auth0
  console.log(`3. Finding user ${TARGET_EMAIL} in Auth0...`);
  const auth0Users = await getUserByEmail(token, TARGET_EMAIL);
  
  if (!auth0Users || auth0Users.length === 0) {
    console.error(`   ✗ User NOT FOUND in Auth0!`);
    console.log('   The user needs to sign up/login first to exist in Auth0.');
    process.exit(1);
  }
  
  console.log(`   Found ${auth0Users.length} user(s):`);
  auth0Users.forEach((u: any) => {
    console.log(`   - ID: ${u.user_id}`);
    console.log(`     Email: ${u.email}`);
    console.log(`     Name: ${u.name || u.nickname || 'N/A'}`);
    console.log(`     Created: ${u.created_at}`);
    console.log(`     Last Login: ${u.last_login || 'Never'}`);
  });
  console.log('');

  // Process each user (in case there are duplicates)
  for (const auth0User of auth0Users) {
    console.log(`4. Processing user: ${auth0User.user_id}`);
    
    // Get current roles
    console.log('   Getting current roles...');
    const currentRoles = await getUserRoles(token, auth0User.user_id);
    if (currentRoles.length > 0) {
      console.log('   Current roles:');
      currentRoles.forEach((r: any) => console.log(`   - ${r.name}`));
    } else {
      console.log('   Current roles: NONE');
    }

    // Check if already has ADMIN
    const hasAdmin = currentRoles.some((r: any) => r.name === NEW_ROLE);
    if (hasAdmin) {
      console.log(`   ✓ User already has ${NEW_ROLE} role\n`);
      continue;
    }

    // Assign ADMIN role
    console.log(`   Assigning ${NEW_ROLE} role...`);
    await assignUserRole(token, auth0User.user_id, adminRole.id);
    console.log(`   ✓ ${NEW_ROLE} role assigned\n`);

    // Verify
    await new Promise((resolve) => setTimeout(resolve, 500));
    const newRoles = await getUserRoles(token, auth0User.user_id);
    console.log('   New roles:');
    newRoles.forEach((r: any) => console.log(`   - ${r.name}`));
    console.log('');
  }

  console.log('=== Done! ===');
  console.log(`User ${TARGET_EMAIL} now has ${NEW_ROLE} role in Auth0.`);
  console.log('');
  console.log('IMPORTANT: Natasa needs to:');
  console.log('1. Log OUT of the application');
  console.log('2. Log back IN to get the new role');
  console.log('');
  console.log('Also, you may need to clear your browser cache or do a hard refresh.');
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});
