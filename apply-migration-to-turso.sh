#!/bin/bash

# Script to apply safe migration to Turso database
# Usage: ./apply-migration-to-turso.sh

set -e

echo "🚀 Applying safe migration to Turso database..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable is not set"
    echo ""
    echo "Please set DATABASE_URL to your Turso database:"
    echo "  export DATABASE_URL='libsql://your-db-name-username.turso.io?authToken=your-token'"
    echo ""
    echo "Or if you have Vercel CLI installed:"
    echo "  vercel env pull .env.production"
    echo "  export DATABASE_URL=\$(grep DATABASE_URL .env.production | cut -d '=' -f2-)"
    exit 1
fi

# Check if migration file exists
MIGRATION_FILE="prisma/migrations/20260119150000_add_claim_metadata_fields_safe/migration.sql"
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "📄 Migration file: $MIGRATION_FILE"
echo "🔗 Database: ${DATABASE_URL%%\?*}"  # Show URL without token
echo ""

# Apply migration using Prisma
echo "⏳ Applying migration..."
npx prisma db execute --file "$MIGRATION_FILE" --schema prisma/schema.prisma

echo ""
echo "✅ Migration applied successfully!"
echo ""
echo "📊 Verifying migration..."
echo "   Run 'npx prisma studio' to verify the changes"
