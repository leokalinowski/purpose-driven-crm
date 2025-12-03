#!/bin/bash
# Deploy branding fields migration to Supabase

MIGRATION_FILE="supabase/migrations/20251203113229_add_agent_branding_fields.sql"
PROJECT_REF="cguoaokqwgqvzkqqezcq"

echo "🚀 Deploying migration: $MIGRATION_FILE"
echo ""

# Option 1: Try Supabase CLI if linked
if command -v supabase &> /dev/null || npx supabase --version &> /dev/null; then
    echo "Using Supabase CLI..."
    npx supabase db push --linked
    exit $?
fi

# Option 2: If you have SUPABASE_ACCESS_TOKEN set
if [ ! -z "$SUPABASE_ACCESS_TOKEN" ]; then
    echo "Using Supabase CLI with access token..."
    export SUPABASE_ACCESS_TOKEN
    npx supabase link --project-ref $PROJECT_REF
    npx supabase db push --linked
    exit $?
fi

# Option 3: Manual instructions
echo "⚠️  No Supabase CLI credentials found."
echo ""
echo "To deploy manually:"
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_REF/sql/new"
echo "2. Copy the contents of: $MIGRATION_FILE"
echo "3. Paste and click 'Run'"
echo ""
echo "Or set SUPABASE_ACCESS_TOKEN and run this script again."
echo ""
echo "Migration file:"
cat "$MIGRATION_FILE"

