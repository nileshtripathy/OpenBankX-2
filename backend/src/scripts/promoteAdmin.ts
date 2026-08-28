/**
 * Promotes an existing user to role="admin". Run once to bootstrap your
 * first admin account (there's intentionally no API endpoint for this -
 * self-service admin promotion would defeat the purpose of role-based
 * authorization).
 *
 * Usage:
 *   npx ts-node src/scripts/promoteAdmin.ts user@example.com
 */
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';

async function main() {
  const email = process.argv[2];
  if (!email) {
    console.error('Usage: ts-node src/scripts/promoteAdmin.ts <email>');
    process.exit(1);
  }

  await connectDB();

  const user = await User.findOneAndUpdate(
    { email: email.toLowerCase().trim() },
    { role: 'admin' },
    { new: true }
  );

  if (!user) {
    console.error(`No user found with email "${email}"`);
  } else {
    console.log(`✓ ${user.email} (${user._id}) is now an admin`);
  }

  await disconnectDB();
  process.exit(user ? 0 : 1);
}

main().catch((err) => {
  console.error('Failed to promote admin:', err);
  process.exit(1);
});
