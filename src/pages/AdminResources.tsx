import Layout from '@/components/layout/Layout';
import ResourcesManager from '@/components/admin/ResourcesManager';
import { useUserRole } from '@/hooks/useUserRole';
import { Navigate } from 'react-router-dom';
import { FolderOpen } from 'lucide-react';

export default function AdminResources() {
  const { isAdmin, loading } = useUserRole();

  if (loading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <FolderOpen className="h-8 w-8 text-primary" />
            Resources Management
          </h1>
          <p className="text-muted-foreground mt-1">Upload and manage resources available to all agents</p>
        </div>
        <ResourcesManager />
      </div>
    </Layout>
  );
}
